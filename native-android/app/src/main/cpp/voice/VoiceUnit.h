#pragma once
/**
 * VoiceUnit.h — One playable voice unit for VibeCore Voice.
 *
 * Modes served:
 *   Sample     — plays the active sample slot at the trigger note's ratio
 *                (one-shot / loop / slice), sample-accurate start offset.
 *   Instrument — same sample engine, tonally repitched from root note,
 *                glide, mono/legato/poly enforced by the pool.
 *   Texture    — deterministic filtered noise source (no sample needed).
 *
 * Per unit: amp env (env0), mod env (env1), 2 LFOs, mod matrix evaluation.
 *
 * Thread model: ALL methods on Audio Thread only.
 */

#include "VoiceTypes.h"
#include "VoiceSampleBank.h"
#include "VoiceMod.h"
#include <cmath>

namespace vibecore {

struct VoiceModValues {
    float pitchCents   = 0.0f;
    float formantSemis = 0.0f;
    float cutoffHz     = 0.0f;
    float volume       = 0.0f;
    float pan          = 0.0f;
    float harmonyLevel = 0.0f;
    float breathLevel  = 0.0f;
    float stereoWidth  = 0.0f;
};

class VoiceUnit {
public:
    void init(int sampleRate) noexcept;

    void applyParams(const VoiceParams& p) noexcept;   // env/LFO defs
    void noteOn (const VoiceTrigger& trig, const VoiceParams& p,
                 const VoiceSampleSlot& slot, float glideFromHz) noexcept;
    void noteOff() noexcept;
    void kill() noexcept;   // hard stop (stealing) — 2 ms fade to avoid click

    // Stealing: start the 2 ms kill fade NOW and begin this note when the
    // fade completes (click-free replacement instead of instant overwrite).
    void noteOnDeferred(const VoiceTrigger& trig,
                        const VoiceSampleSlot& slot) noexcept;

    // True if this unit currently reads from the given sample buffer.
    bool usesData(const float* data) const noexcept {
        return mActive && data != nullptr &&
               (mData == data || (mHasPending && mPendingSlot.data == data));
    }

    // Render one stereo frame ADDED into l/r. Returns amp env value (for breath gating).
    // `mod` supplies per-buffer modulation offsets (texture cutoff etc.).
    float renderFrame(float& l, float& r, const VoiceParams& p,
                      const VoiceModValues& mod) noexcept;

    // Evaluate this unit's contribution to global mod destinations.
    void accumulateMod(const VoiceParams& p, VoiceModValues& out) noexcept;

    void syncBeat(double bpm) noexcept              { mLfo[0].syncBeat(bpm);        mLfo[1].syncBeat(bpm); }
    void syncBar (double bpm, int beatsPerBar) noexcept { mLfo[0].syncBar(bpm, beatsPerBar); mLfo[1].syncBar(bpm, beatsPerBar); }

    bool     isActive()  const noexcept { return mActive; }
    bool     isReleasing() const noexcept { return mEnv[0].isReleasing(); }
    uint8_t  note()      const noexcept { return mNote; }
    int32_t  ageFrames() const noexcept { return mAge; }
    float    currentHz() const noexcept { return mCurrentHz; }

private:
    float readSample() noexcept;
    float textureSample(const VoiceParams& p, float cutoffOffsetHz) noexcept;

    // Sample playback
    const float* mData      = nullptr;
    int32_t      mLength    = 0;
    double       mPlayPos   = 0.0;
    double       mBaseInc   = 1.0;    // rate-corrected, pre pitch-ratio
    int32_t      mLoopStart = 0;
    int32_t      mLoopEnd   = 0;
    VoicePlayMode mPlayMode = VoicePlayMode::OneShot;

    // Pitch / glide
    float mCurrentHz  = 261.63f;
    float mTargetHz   = 261.63f;
    float mGlideCoeff = 1.0f;
    float mRootHz     = 261.63f;

    // Texture noise state
    uint32_t mRng = 0x7EC0FFEE;
    float mTx1 = 0, mTx2 = 0, mTy1 = 0, mTy2 = 0;   // texture filter biquad state
    float mTb0 = 0, mTb1 = 0, mTb2 = 0, mTa1 = 0, mTa2 = 0;
    float mTexCutoff = -1.0f, mTexRes = -1.0f;      // cached to detect change

    // Modulators
    VoiceEnvelope mEnv[kVoiceMaxEnvelopes];
    VoiceLFO      mLfo[kVoiceMaxLFOs];

    // State
    bool    mActive   = false;
    bool    mKilling  = false;
    float   mKillGain = 1.0f;
    uint8_t mNote     = 60;
    float   mVelocity = 1.0f;
    int32_t mAge      = 0;
    int32_t mStartDelay = 0;   // sample-accurate trigger offset
    int     mSampleRate = 48000;
    VoiceGlobalMode mMode = VoiceGlobalMode::Instrument;

    // Deferred note (steal-with-fade)
    bool            mHasPending = false;
    VoiceTrigger    mPendingTrig = {};
    VoiceSampleSlot mPendingSlot = {};
};

} // namespace vibecore
