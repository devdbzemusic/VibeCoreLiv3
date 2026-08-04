#include "BassNode.h"
#include "../platform/VibeCoreLog.h"
#include <algorithm>
#include <cmath>
#include <cstring>

namespace vibecore {

// ─── Constructor ──────────────────────────────────────────────────────────────

BassNode::BassNode(NodeId id) : AudioNode(id, "BassNode") {}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

void BassNode::prepare(int sampleRate, int maxFramesPerCallback) {
    mSampleRate = sampleRate;
    mWavetable.init(sampleRate);
    mVoicePool.init(&mWavetable, sampleRate);

    if (maxFramesPerCallback > kBassRenderBufferSize) {
        VLOG_E("BassNode: maxFramesPerCallback %d exceeds kBassRenderBufferSize %d",
               maxFramesPerCallback, kBassRenderBufferSize);
    }

    mPrepared = true;
    VLOG_I("BassNode: prepared sr=%d maxFrames=%d", sampleRate, maxFramesPerCallback);
}

void BassNode::reset() {
    mVoicePool.allNotesOff();
    memset(mBufL, 0, sizeof(mBufL));
    memset(mBufR, 0, sizeof(mBufR));
    mActiveVoiceCount.store(0, std::memory_order_relaxed);
    mOutputLevel.store(0.0f, std::memory_order_relaxed);
    VLOG_I("BassNode: reset");
}

// ─── Command processing ───────────────────────────────────────────────────────

void BassNode::drainCommandQueue() noexcept {
    BassCommand cmd;
    while (mCommandQueue.pop(cmd)) {
        applyCommand(cmd);
    }
}

void BassNode::applyCommand(const BassCommand& cmd) noexcept {
    switch (cmd.type) {
    // ── Oscillator ────────────────────────────────────────────────────────
    case BassCommandType::SetWaveform:
        mParams.waveform = cmd.payload.waveform.waveform;
        break;
    case BassCommandType::SetMorphPos:
        mParams.morphPos = cmd.payload.f32.value;
        break;
    case BassCommandType::SetDetune:
        mParams.detune = cmd.payload.f32.value;
        break;
    case BassCommandType::SetOctave:
        mParams.octave = cmd.payload.f32.value;
        break;
    case BassCommandType::SetSemi:
        mParams.semi = cmd.payload.f32.value;
        break;
    case BassCommandType::SetFine:
        mParams.fine = cmd.payload.f32.value;
        break;

    // ── Voice ─────────────────────────────────────────────────────────────
    case BassCommandType::SetVoiceMode:
        mParams.voiceMode = cmd.payload.voiceMode.mode;
        break;
    case BassCommandType::SetGlideMs:
        mParams.glideMs = cmd.payload.f32.value;
        break;
    case BassCommandType::SetVolume:
        mParams.volume = cmd.payload.f32.value;
        break;
    case BassCommandType::SetPan:
        mParams.pan = cmd.payload.f32.value;
        mParams.stereo3D.pan = cmd.payload.f32.value;
        break;

    // ── Filter ────────────────────────────────────────────────────────────
    case BassCommandType::SetFilterType:
        mParams.filterType = cmd.payload.filterType.type;
        mVoicePool.applyFilterParams(mParams);
        break;
    case BassCommandType::SetCutoff:
        mParams.cutoffHz = cmd.payload.f32.value;
        mVoicePool.applyFilterParams(mParams);
        break;
    case BassCommandType::SetResonance:
        mParams.resonance = cmd.payload.f32.value;
        mVoicePool.applyFilterParams(mParams);
        break;
    case BassCommandType::SetFilterDrive:
        mParams.filterDrive = cmd.payload.f32.value;
        mVoicePool.applyFilterParams(mParams);
        break;

    // ── Envelope 0 ───────────────────────────────────────────────────────
    case BassCommandType::SetEnv0Attack:  mParams.env0.attackMs  = cmd.payload.f32.value; break;
    case BassCommandType::SetEnv0Decay:   mParams.env0.decayMs   = cmd.payload.f32.value; break;
    case BassCommandType::SetEnv0Sustain: mParams.env0.sustain   = cmd.payload.f32.value; break;
    case BassCommandType::SetEnv0Release: mParams.env0.releaseMs = cmd.payload.f32.value; break;
    case BassCommandType::SetEnv0VelAmt:  mParams.env0.velocityAmount = cmd.payload.f32.value; break;

    // ── Envelope 1 ───────────────────────────────────────────────────────
    case BassCommandType::SetEnv1Attack:  mParams.env1.attackMs  = cmd.payload.f32.value; break;
    case BassCommandType::SetEnv1Decay:   mParams.env1.decayMs   = cmd.payload.f32.value; break;
    case BassCommandType::SetEnv1Sustain: mParams.env1.sustain   = cmd.payload.f32.value; break;
    case BassCommandType::SetEnv1Release: mParams.env1.releaseMs = cmd.payload.f32.value; break;
    case BassCommandType::SetEnv1VelAmt:  mParams.env1.velocityAmount = cmd.payload.f32.value; break;

    // ── LFO 0 ────────────────────────────────────────────────────────────
    case BassCommandType::SetLFO0Shape:   mParams.lfo0.shape   = cmd.payload.lfo.shape;   break;
    case BassCommandType::SetLFO0Rate:    mParams.lfo0.rateHz  = cmd.payload.lfo.rateHz;  break;
    case BassCommandType::SetLFO0Depth:   mParams.lfo0.depth   = cmd.payload.lfo.depth;   break;
    case BassCommandType::SetLFO0Sync:    mParams.lfo0.sync    = cmd.payload.lfo.sync;    break;
    case BassCommandType::SetLFO0Retrig:  mParams.lfo0.retrigger = cmd.payload.lfo.retrigger; break;

    // ── LFO 1 ────────────────────────────────────────────────────────────
    case BassCommandType::SetLFO1Shape:   mParams.lfo1.shape   = cmd.payload.lfo.shape;   break;
    case BassCommandType::SetLFO1Rate:    mParams.lfo1.rateHz  = cmd.payload.lfo.rateHz;  break;
    case BassCommandType::SetLFO1Depth:   mParams.lfo1.depth   = cmd.payload.lfo.depth;   break;
    case BassCommandType::SetLFO1Sync:    mParams.lfo1.sync    = cmd.payload.lfo.sync;    break;
    case BassCommandType::SetLFO1Retrig:  mParams.lfo1.retrigger = cmd.payload.lfo.retrigger; break;

    // ── Mod matrix ───────────────────────────────────────────────────────
    case BassCommandType::SetModRoute: {
        const int idx = cmd.payload.modRoute.routeIndex;
        if (idx >= 0 && idx < kBassModRoutes) {
            mParams.modMatrix[idx] = cmd.payload.modRoute.route;
        }
        break;
    }

    // ── 3D Stereo ────────────────────────────────────────────────────────
    case BassCommandType::SetStereoWidth:
        mParams.stereo3D.stereoWidth = cmd.payload.f32.value;
        break;
    case BassCommandType::SetStereoMidGain:
        mParams.stereo3D.midGain = cmd.payload.f32.value;
        break;
    case BassCommandType::SetStereoSideGain:
        mParams.stereo3D.sideGain = cmd.payload.f32.value;
        break;
    case BassCommandType::SetStereoEnabled:
        mParams.stereo3D.enabled = cmd.payload.i32.value != 0;
        break;

    // ── Triggers ─────────────────────────────────────────────────────────
    case BassCommandType::NoteOn: {
        BassTrigger trig;
        trig.note         = cmd.payload.trigger.note;
        trig.velocity     = cmd.payload.trigger.velocity;
        trig.retrigger    = cmd.payload.trigger.retrigger;
        trig.sampleOffset = cmd.payload.trigger.sampleOffset;
        trig.glideFromPitch = cmd.payload.trigger.glideFromPitch;
        mVoicePool.noteOn(trig, mParams);
        break;
    }
    case BassCommandType::NoteOff:
        mVoicePool.noteOff(cmd.payload.trigger.note,
                           cmd.payload.trigger.sampleOffset);
        break;
    case BassCommandType::AllNotesOff:
        mVoicePool.allNotesOff();
        break;

    // ── Full param snapshot ───────────────────────────────────────────────
    case BassCommandType::SetAllParams:
        mParams = cmd.payload.allParams.params;
        mVoicePool.applyFilterParams(mParams);
        mVoicePool.applyEnvParams(mParams);
        mVoicePool.applyLFOParams(mParams);
        break;

    default:
        break;
    }
}

// ─── Process ──────────────────────────────────────────────────────────────────

void BassNode::process(const float* /*inputBuffer*/, float* outputBuffer,
                       int numFrames, int numChannels) noexcept {
    if (!mPrepared || numFrames <= 0) return;

    // 1. Drain command queue (UI → Audio Thread state sync)
    drainCommandQueue();

    // 2. Zero render buffers
    memset(mBufL, 0, numFrames * sizeof(float));
    memset(mBufR, 0, numFrames * sizeof(float));

    // 3. Render all voices — sample by sample for correct modulation
    for (int i = 0; i < numFrames; ++i) {
        mVoicePool.renderFrame(mBufL[i], mBufR[i], mParams);
    }

    // 4. 3D Stereo post-processing
    Bass3DStereo::processBuffer(mBufL, mBufR, numFrames, mParams.stereo3D);

    // 5. Write to output bus (interleaved or planar depending on numChannels)
    if (numChannels >= 2) {
        for (int i = 0; i < numFrames; ++i) {
            outputBuffer[i * numChannels + 0] += mBufL[i];
            outputBuffer[i * numChannels + 1] += mBufR[i];
        }
    } else if (numChannels == 1) {
        for (int i = 0; i < numFrames; ++i) {
            outputBuffer[i] += (mBufL[i] + mBufR[i]) * 0.5f;
        }
    }

    // 6. Update atomics (approximate — one per buffer is fine)
    mActiveVoiceCount.store(mVoicePool.activeVoiceCount(), std::memory_order_relaxed);

    // Compute RMS output level for VU meter
    float rms = 0.0f;
    for (int i = 0; i < numFrames; ++i) {
        const float s = (mBufL[i] + mBufR[i]) * 0.5f;
        rms += s * s;
    }
    rms = std::sqrt(rms / static_cast<float>(numFrames));
    mOutputLevel.store(rms, std::memory_order_relaxed);
}

// ─── Sync callbacks ───────────────────────────────────────────────────────────

void BassNode::onTransportStart(int32_t /*sampleOffset*/) noexcept {
    mIsPlaying.store(true, std::memory_order_relaxed);
}

void BassNode::onTransportStop(int32_t /*sampleOffset*/) noexcept {
    mIsPlaying.store(false, std::memory_order_relaxed);
    mVoicePool.allNotesOff();
}

void BassNode::onTick(int64_t /*tick*/, const MusicalPosition& /*pos*/,
                      int32_t /*sampleOffset*/) noexcept {
    // Piano Roll triggers are dispatched here by GrooveNode integration
    // (via notifyGrooveTrigger). onTick itself does not trigger directly.
}

void BassNode::onBeat(int64_t /*beat*/, const MusicalPosition& pos,
                      int32_t /*sampleOffset*/) noexcept {
    mVoicePool.onBeat(pos.bpm);
}

void BassNode::onBar(int64_t /*bar*/, const MusicalPosition& pos,
                     int32_t /*sampleOffset*/) noexcept {
    mVoicePool.onBar(pos.bpm, pos.beatsPerBar);
}

void BassNode::onLoop(int64_t /*loopCount*/, int32_t /*sampleOffset*/) noexcept {
    // No special action needed on loop for bass
}

void BassNode::onTempoChanged(double newBpm, int32_t /*sampleOffset*/) noexcept {
    mCurrentBpm = newBpm;
}

// ─── Groove integration ───────────────────────────────────────────────────────

void BassNode::notifyGrooveTrigger(const BassTrigger& trig) noexcept {
    // Direct call from GrooveNode — already on Audio Thread
    if (trig.noteOn) {
        mVoicePool.noteOn(trig, mParams);
    } else {
        mVoicePool.noteOff(trig.note, trig.sampleOffset);
    }
}

} // namespace vibecore
