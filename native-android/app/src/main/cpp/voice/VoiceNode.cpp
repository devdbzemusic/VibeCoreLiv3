#include "VoiceNode.h"
#include "../platform/VibeCoreLog.h"
#include "../platform/sync/MusicalPosition.h"
#include <algorithm>
#include <cmath>
#include <cstring>

namespace vibecore {

// ─── Constructor ──────────────────────────────────────────────────────────────

VoiceNode::VoiceNode(NodeId id) : AudioNode(id, "VoiceNode") {}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

void VoiceNode::prepare(int sampleRate, int maxFramesPerCallback) {
    mSampleRate = sampleRate;
    mMaxFrames  = maxFramesPerCallback;

    mPool.init(sampleRate);
    mPool.applyParams(mParams);
    mPitchShift.setSampleRate(sampleRate);
    mFormant.setSampleRate(sampleRate);
    mHarmonizer.setSampleRate(sampleRate);
    mGate.setSampleRate(sampleRate);
    mDeEsser.setSampleRate(sampleRate);
    mCompressor.setSampleRate(sampleRate);
    mEQ.setSampleRate(sampleRate);
    mBreath.setSampleRate(sampleRate);

    if (maxFramesPerCallback > kVoiceRenderBufferSize) {
        VLOG_E("VoiceNode: maxFramesPerCallback %d exceeds kVoiceRenderBufferSize %d",
               maxFramesPerCallback, kVoiceRenderBufferSize);
    }

    mPrepared = true;
    VLOG_I("VoiceNode: prepared sr=%d maxFrames=%d", sampleRate, maxFramesPerCallback);
}

void VoiceNode::reset() {
    mPool.hardStop();
    mPitchShift.reset();
    mFormant.reset();
    mHarmonizer.reset();
    mGate.reset();
    mDeEsser.reset();
    mCompressor.reset();
    mEQ.reset();
    mBreath.reset();
    memset(mBufL, 0, sizeof(mBufL));
    memset(mBufR, 0, sizeof(mBufR));
    mActiveUnits.store(0, std::memory_order_relaxed);
    mOutputLevel.store(0.0f, std::memory_order_relaxed);
    mInputEnv = 0.0f;
    VLOG_I("VoiceNode: reset");
}

// ─── Command processing ───────────────────────────────────────────────────────

void VoiceNode::drainCommandQueue() noexcept {
    VoiceCommand cmd;
    while (mCommandQueue.pop(cmd)) applyCommand(cmd);
}

void VoiceNode::applyCommand(const VoiceCommand& cmd) noexcept {
    switch (cmd.type) {
    // ── Mode ─────────────────────────────────────────────────────────────
    case VoiceCommandType::SetGlobalMode:
        mParams.mode = static_cast<VoiceGlobalMode>(cmd.payload.u8.mode);
        mPool.allNotesOff();   // clean release on mode switch — no clicks
        break;
    case VoiceCommandType::SetPolyMode:
        mParams.polyMode = static_cast<VoicePolyMode>(cmd.payload.u8.mode);
        break;
    case VoiceCommandType::SetPlayMode:
        mParams.playMode = static_cast<VoicePlayMode>(cmd.payload.u8.mode);
        break;

    // ── Master ───────────────────────────────────────────────────────────
    case VoiceCommandType::SetVolume:     mParams.volume  = cmd.payload.f32.value; break;
    case VoiceCommandType::SetDryWet:     mParams.dryWet  = cmd.payload.f32.value; break;
    case VoiceCommandType::SetMonitor:    mParams.monitor = cmd.payload.f32.value; break;
    case VoiceCommandType::SetGlideMs:    mParams.glideMs = cmd.payload.f32.value; break;
    case VoiceCommandType::SetActiveSlot: mParams.activeSampleSlot = cmd.payload.i32.value; break;
    case VoiceCommandType::SetRootNote:   mParams.rootNote = cmd.payload.i32.value; break;

    // ── Pitch / Formant ──────────────────────────────────────────────────
    case VoiceCommandType::SetPitchSemitones:
        mParams.pitch.pitchSemitones = cmd.payload.f32.value;
        mPitchShift.setSemitones(cmd.payload.f32.value);
        break;
    case VoiceCommandType::SetPitchEnabled:
        mParams.pitch.pitchEnabled = cmd.payload.i32.value != 0;
        break;
    case VoiceCommandType::SetFormantSemitones:
        mParams.pitch.formantSemitones = cmd.payload.f32.value;
        mFormant.setShiftSemitones(cmd.payload.f32.value);
        break;
    case VoiceCommandType::SetFormantEnabled:
        mParams.pitch.formantEnabled = cmd.payload.i32.value != 0;
        break;

    // ── Harmonizer / Doubler ─────────────────────────────────────────────
    case VoiceCommandType::SetHarmonyVoice: {
        const int i = cmd.payload.harmony.index;
        if (i >= 0 && i < kVoiceHarmonyVoices) {
            mParams.harmonizer.voices[i] = cmd.payload.harmony.def;
            mHarmonizer.setParams(mParams.harmonizer, mParams.doubler);
        }
        break;
    }
    case VoiceCommandType::SetHarmonyMaster:
        mParams.harmonizer.masterLevel = cmd.payload.f32.value;
        mHarmonizer.setParams(mParams.harmonizer, mParams.doubler);
        break;
    case VoiceCommandType::SetHarmonyEnabled:
        mParams.harmonizer.enabled = cmd.payload.i32.value != 0;
        mHarmonizer.setParams(mParams.harmonizer, mParams.doubler);
        break;
    case VoiceCommandType::SetDoubler:
        mParams.doubler = cmd.payload.doubler.p;
        mHarmonizer.setParams(mParams.harmonizer, mParams.doubler);
        break;

    // ── Dynamics ─────────────────────────────────────────────────────────
    case VoiceCommandType::SetGate:
        mParams.gate = cmd.payload.gate.p;
        mGate.setParams(mParams.gate);
        break;
    case VoiceCommandType::SetDeEsser:
        mParams.deEsser = cmd.payload.deEsser.p;
        mDeEsser.setParams(mParams.deEsser);
        break;
    case VoiceCommandType::SetCompressor:
        mParams.compressor = cmd.payload.compressor.p;
        mCompressor.setParams(mParams.compressor);
        break;
    case VoiceCommandType::SetEQ:
        mParams.eq = cmd.payload.eq.p;
        mEQ.setParams(mParams.eq);
        break;

    // ── Breath ───────────────────────────────────────────────────────────
    case VoiceCommandType::SetBreath:
        mParams.breath = cmd.payload.breath.p;
        mBreath.setParams(mParams.breath);
        break;

    // ── Texture filter ───────────────────────────────────────────────────
    case VoiceCommandType::SetTextureCutoff: mParams.textureCutoffHz  = cmd.payload.f32.value; break;
    case VoiceCommandType::SetTextureRes:    mParams.textureResonance = cmd.payload.f32.value; break;

    // ── Envelopes / LFOs ─────────────────────────────────────────────────
    case VoiceCommandType::SetEnv0:
        mParams.env0 = cmd.payload.env.adsr;
        mPool.applyParams(mParams);
        break;
    case VoiceCommandType::SetEnv1:
        mParams.env1 = cmd.payload.env.adsr;
        mPool.applyParams(mParams);
        break;
    case VoiceCommandType::SetLFO0:
        mParams.lfo0 = cmd.payload.lfo.def;
        mPool.applyParams(mParams);
        break;
    case VoiceCommandType::SetLFO1:
        mParams.lfo1 = cmd.payload.lfo.def;
        mPool.applyParams(mParams);
        break;

    // ── Macros ───────────────────────────────────────────────────────────
    case VoiceCommandType::SetMacro1: mParams.macro1 = cmd.payload.f32.value; break;
    case VoiceCommandType::SetMacro2: mParams.macro2 = cmd.payload.f32.value; break;

    // ── Mod matrix ───────────────────────────────────────────────────────
    case VoiceCommandType::SetModRoute: {
        const int idx = cmd.payload.modRoute.routeIndex;
        if (idx >= 0 && idx < kVoiceModRoutes)
            mParams.modMatrix[idx] = cmd.payload.modRoute.route;
        break;
    }

    // ── 3D Stereo ────────────────────────────────────────────────────────
    case VoiceCommandType::SetStereoWidth:   mParams.stereo3D.stereoWidth = cmd.payload.f32.value; break;
    case VoiceCommandType::SetStereoMidGain: mParams.stereo3D.midGain     = cmd.payload.f32.value; break;
    case VoiceCommandType::SetStereoSideGain:mParams.stereo3D.sideGain    = cmd.payload.f32.value; break;
    case VoiceCommandType::SetStereoPan:     mParams.stereo3D.pan         = cmd.payload.f32.value; break;
    case VoiceCommandType::SetStereoEnabled: mParams.stereo3D.enabled     = cmd.payload.i32.value != 0; break;

    // ── Triggers ─────────────────────────────────────────────────────────
    case VoiceCommandType::NoteOn: {
        VoiceTrigger trig;
        trig.note         = cmd.payload.trigger.note;
        trig.velocity     = cmd.payload.trigger.velocity;
        trig.sampleSlot   = cmd.payload.trigger.slot;
        trig.sliceIndex   = cmd.payload.trigger.slice;
        trig.retrigger    = cmd.payload.trigger.retrigger;
        trig.sampleOffset = cmd.payload.trigger.sampleOffset;
        mPool.noteOn(trig, mParams, mBank);
        break;
    }
    case VoiceCommandType::NoteOff:
        mPool.noteOff(cmd.payload.trigger.note);
        break;
    case VoiceCommandType::AllNotesOff:
        mPool.allNotesOff();
        break;

    // ── Sample management ────────────────────────────────────────────────
    case VoiceCommandType::SetSampleData: {
        // Fade out any unit still reading the outgoing buffer BEFORE the
        // slot is replaced (UI reclaims the retired buffer epochs later).
        const int s = cmd.payload.sample.slot;
        if (s >= 0 && s < kVoiceSampleSlots) {
            mPool.killUsing(mBank.slot(s).data);
            mBank.set(s,
                      cmd.payload.sample.data,
                      cmd.payload.sample.lengthFrames,
                      cmd.payload.sample.sampleRate,
                      cmd.payload.sample.rootNote);
        }
        break;
    }
    case VoiceCommandType::ClearSample: {
        const int s = cmd.payload.i32.value;
        if (s >= 0 && s < kVoiceSampleSlots) {
            mPool.killUsing(mBank.slot(s).data);
            mBank.clear(s);
        }
        break;
    }
    case VoiceCommandType::SetSliceMarkers:
        mBank.setSlices(cmd.payload.slices.slot,
                        cmd.payload.slices.count,
                        cmd.payload.slices.start);
        break;

    // ── Live input gate ──────────────────────────────────────────────────
    case VoiceCommandType::SetLiveInputActive:
        mInput.setActive(cmd.payload.i32.value != 0);
        break;

    // ── Full param snapshot ──────────────────────────────────────────────
    case VoiceCommandType::SetAllParams:
        mParams = cmd.payload.allParams.params;
        mPool.applyParams(mParams);
        mPitchShift.setSemitones(mParams.pitch.pitchSemitones);
        mFormant.setShiftSemitones(mParams.pitch.formantSemitones);
        mHarmonizer.setParams(mParams.harmonizer, mParams.doubler);
        mGate.setParams(mParams.gate);
        mDeEsser.setParams(mParams.deEsser);
        mCompressor.setParams(mParams.compressor);
        mEQ.setParams(mParams.eq);
        mBreath.setParams(mParams.breath);
        break;

    default:
        break;
    }
}

// ─── 3D Stereo (M/S width + constant-power pan) ──────────────────────────────

void VoiceNode::applyStereo3D(float* l, float* r, int numFrames,
                              float widthMod, float panMod) noexcept {
    const Voice3DParams& p = mParams.stereo3D;
    if (!p.enabled) return;

    float width = p.stereoWidth + widthMod;
    if (width < 0.0f) width = 0.0f;
    if (width > 2.0f) width = 2.0f;

    float pan = p.pan + panMod;
    if (pan < -1.0f) pan = -1.0f;
    if (pan >  1.0f) pan =  1.0f;

    const float angle = (pan + 1.0f) * 0.5f * 1.5707963f;
    const float gl = std::cos(angle);
    const float gr = std::sin(angle);

    for (int i = 0; i < numFrames; ++i) {
        const float mid  = (l[i] + r[i]) * 0.5f * p.midGain;
        const float side = (l[i] - r[i]) * 0.5f * p.sideGain * width;
        float L = mid + side;
        float R = mid - side;
        l[i] = L * gl * 1.41421356f;
        r[i] = R * gr * 1.41421356f;
    }
}

// ─── Process ──────────────────────────────────────────────────────────────────

void VoiceNode::process(const float* /*inputBuffer*/, float* outputBuffer,
                        int numFrames, int numChannels) noexcept {
    if (!mPrepared || numFrames <= 0) return;
    if (numFrames > kVoiceRenderBufferSize) numFrames = kVoiceRenderBufferSize;

    // 1. Drain command queue
    drainCommandQueue();

    // 2. Zero work buffers
    memset(mBufL, 0, numFrames * sizeof(float));
    memset(mBufR, 0, numFrames * sizeof(float));

    const bool liveMode = mParams.mode == VoiceGlobalMode::Live;

    // 3. Global modulation snapshot (per buffer, from previous-frame
    //    modulator states — smooth enough at ≤ 2048 frames)
    VoiceModValues mod = {};
    mPool.accumulateMod(mParams, mod);

    // 4. Source
    float inputRms = 0.0f;
    if (liveMode) {
        mInput.readNonBlocking(mIn, numFrames);
        const float envAtk = 0.15f, envRel = 0.0008f;
        for (int i = 0; i < numFrames; ++i) {
            const float x = mIn[i];
            mDry[i]  = x;
            mBufL[i] = x;
            mBufR[i] = x;
            const float ax = std::fabs(x);
            mInputEnv += (ax - mInputEnv) * (ax > mInputEnv ? envAtk : envRel);
            inputRms += x * x;
        }
        mInputLevel.store(std::sqrt(inputRms / static_cast<float>(numFrames)),
                          std::memory_order_relaxed);
    } else {
        for (int i = 0; i < numFrames; ++i) {
            float l = 0.0f, r = 0.0f;
            const float env = mPool.renderFrame(l, r, mParams, mod);
            mBufL[i] = l;
            mBufR[i] = r;
            mDry[i]  = env;   // repurposed: per-sample env for breath gating
        }
    }

    // 5. Pitch shift (global)
    if (mParams.pitch.pitchEnabled) {
        const float totalSemis = mParams.pitch.pitchSemitones + mod.pitchCents / 100.0f;
        mPitchShift.setSemitones(totalSemis);
        for (int i = 0; i < numFrames; ++i)
            mPitchShift.processStereo(mBufL[i], mBufR[i]);
    }

    // 6. Formant shift
    if (mParams.pitch.formantEnabled) {
        mFormant.setShiftSemitones(mParams.pitch.formantSemitones + mod.formantSemis);
        for (int i = 0; i < numFrames; ++i)
            mFormant.processStereo(mBufL[i], mBufR[i]);
    }

    // 7. Harmonizer + Doubler (feeds off the processed mono sum)
    if (mParams.harmonizer.enabled || mParams.doubler.enabled) {
        for (int i = 0; i < numFrames; ++i) {
            const float mono = (mBufL[i] + mBufR[i]) * 0.5f;
            mHarmonizer.process(mono, mBufL[i], mBufR[i], mod.harmonyLevel);
        }
    }

    // 8. Breath layer
    if (mParams.breath.enabled) {
        for (int i = 0; i < numFrames; ++i) {
            const float gateEnv = liveMode ? mInputEnv : mDry[i];
            float b = mBreath.process(gateEnv);
            b *= (1.0f + mod.breathLevel);
            mBufL[i] += b;
            mBufR[i] += b;
        }
    }

    // 9. Dynamics chain: Gate → De-Esser → Compressor → EQ
    for (int i = 0; i < numFrames; ++i) {
        mGate.processStereo(mBufL[i], mBufR[i]);
        mDeEsser.processStereo(mBufL[i], mBufR[i]);
        mCompressor.processStereo(mBufL[i], mBufR[i]);
        mEQ.processStereo(mBufL[i], mBufR[i]);
    }

    // 10. 3D Stereo
    applyStereo3D(mBufL, mBufR, numFrames, mod.stereoWidth, mod.pan);

    // 11. Volume + dry/wet + write to output bus
    float vol = mParams.volume * (1.0f + mod.volume);
    if (vol < 0.0f) vol = 0.0f;
    if (vol > 2.0f) vol = 2.0f;

    const float wet = liveMode ? mParams.dryWet : 1.0f;
    const float dry = liveMode ? (1.0f - mParams.dryWet) * mParams.monitor : 0.0f;

    if (numChannels >= 2) {
        for (int i = 0; i < numFrames; ++i) {
            outputBuffer[i * numChannels + 0] += (mBufL[i] * wet + mDry[i] * dry * static_cast<float>(liveMode)) * vol;
            outputBuffer[i * numChannels + 1] += (mBufR[i] * wet + mDry[i] * dry * static_cast<float>(liveMode)) * vol;
        }
    } else if (numChannels == 1) {
        for (int i = 0; i < numFrames; ++i)
            outputBuffer[i] += ((mBufL[i] + mBufR[i]) * 0.5f * wet) * vol;
    }

    // 12. Atomics
    mActiveUnits.store(mPool.activeCount(), std::memory_order_relaxed);

    float rms = 0.0f;
    for (int i = 0; i < numFrames; ++i) {
        const float s = (mBufL[i] + mBufR[i]) * 0.5f;
        rms += s * s;
    }
    mOutputLevel.store(std::sqrt(rms / static_cast<float>(numFrames)),
                       std::memory_order_relaxed);

    // 13. Epoch — UI-side sample reclamation waits on this counter.
    mProcessEpoch.fetch_add(1, std::memory_order_release);
}

// ─── Sync callbacks ───────────────────────────────────────────────────────────

void VoiceNode::onTransportStart(int32_t /*sampleOffset*/) noexcept {
    mIsPlaying.store(true, std::memory_order_relaxed);
}

void VoiceNode::onTransportStop(int32_t /*sampleOffset*/) noexcept {
    mIsPlaying.store(false, std::memory_order_relaxed);
    mPool.allNotesOff();   // release — click-free stop, clean tails
}

void VoiceNode::onTick(int64_t /*tick*/, const MusicalPosition& /*pos*/,
                       int32_t /*sampleOffset*/) noexcept {
    // Triggers arrive via notifyGrooveTrigger from GrooveNode (zero latency).
}

void VoiceNode::onBeat(int64_t /*beat*/, const MusicalPosition& /*pos*/,
                       int32_t /*sampleOffset*/) noexcept {
    mPool.syncBeat(mCurrentBpm);
}

void VoiceNode::onBar(int64_t /*bar*/, const MusicalPosition& /*pos*/,
                      int32_t /*sampleOffset*/) noexcept {
    mPool.syncBar(mCurrentBpm, mBeatsPerBar);
}

void VoiceNode::onLoop(int64_t /*loopCount*/, int32_t /*sampleOffset*/) noexcept {
    // No special action on loop for voice.
}

void VoiceNode::onTempoChanged(double newBpm, int32_t /*sampleOffset*/) noexcept {
    mCurrentBpm = newBpm;
}

// ─── Groove integration ───────────────────────────────────────────────────────

void VoiceNode::notifyGrooveTrigger(const VoiceTrigger& trig) noexcept {
    if (trig.noteOn) mPool.noteOn(trig, mParams, mBank);
    else             mPool.noteOff(trig.note);
}

} // namespace vibecore
