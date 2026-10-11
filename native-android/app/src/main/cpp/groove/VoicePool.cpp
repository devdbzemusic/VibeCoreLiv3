#include "VoicePool.h"
#include <cstring>
#include <cmath>

namespace vibecore {

VoicePool::VoicePool() {
    mVoices.fill(Voice{});
    mSamples.fill(SampleBuffer{});
    mTrackVolume.fill(100);
    mTrackPan.fill(0);
}

void VoicePool::prepare(int32_t sampleRate, int32_t /*maxFrames*/) noexcept {
    mSampleRate     = sampleRate;
    // 10 ms release
    mDefaultRelease = 1.0f / (0.010f * static_cast<float>(sampleRate));
    reset();
}

void VoicePool::reset() noexcept {
    for (auto& v : mVoices) v = Voice{};
    mStolenCount = 0;
}

void VoicePool::registerSample(int32_t sampleId, const SampleBuffer& buf) noexcept {
    if (sampleId < 0 || sampleId >= kMaxSamples) return;
    mSamples[sampleId] = buf;
}

// ── Trigger ────────────────────────────────────────────────────────────────────

void VoicePool::trigger(const Trigger& t) noexcept {
    if (t.sampleId < 0 || t.sampleId >= kMaxSamples) return;
    const SampleBuffer& buf = mSamples[t.sampleId];
    if (!buf.valid || buf.data == nullptr || buf.length == 0) return;

    // 1. Choke group: silence all voices in this group first
    if (t.chokeGroup > 0) chokeGroup(t.chokeGroup);

    // 2. Find a voice
    int32_t idx = findIdleVoice();
    if (idx < 0) {
        idx = findStealVoice(t.trackIndex, t.chokeGroup);
        if (idx >= 0) mStolenCount++;
    }
    if (idx < 0) return;  // no voice available — drop (should not happen with 64 voices)

    // 3. Configure voice
    Voice& v        = mVoices[idx];
    v.state         = VoiceState::Playing;
    v.trackIndex    = t.trackIndex;
    v.chokeGroup    = t.chokeGroup;
    v.note          = t.note;
    v.sampleId      = t.sampleId;
    v.buffer        = &buf;
    v.readPosQ16    = 0;
    v.startOffset   = t.sampleOffset;
    v.envelope      = 1.0f;
    v.volume        = static_cast<float>(t.velocity) / 127.0f;
    v.targetVolume  = v.volume;
    v.envRelease    = mDefaultRelease;

    // Playback increment must account for BOTH musical pitch and the source
    // sample-rate relative to the active output stream. Without the rate ratio,
    // a 44.1 kHz sample rendered by a 48 kHz stream plays too slowly/flat.
    // note 60 = unity musical pitch; equal source/output rates = 65536 Q16.
    const float semitones      = static_cast<float>(t.note) - 60.0f;
    const float pitchRatio     = powf(2.0f, semitones / 12.0f);
    const float sourceRate     = buf.sampleRate > 0 ? static_cast<float>(buf.sampleRate)
                                                    : static_cast<float>(mSampleRate);
    const float outputRate     = mSampleRate > 0 ? static_cast<float>(mSampleRate) : 48000.0f;
    const float sampleRateRatio = sourceRate / outputRate;
    v.pitchStepQ16 = static_cast<int64_t>(pitchRatio * sampleRateRatio * 65536.0f);
}

void VoicePool::setTrackVolume(int32_t track, uint8_t volume) noexcept {
    if (track < 0 || track >= kMaxTracks) return;
    mTrackVolume[track] = volume;
}

void VoicePool::setTrackPan(int32_t track, int8_t pan) noexcept {
    if (track < 0 || track >= kMaxTracks) return;
    mTrackPan[track] = pan < -100 ? -100 : (pan > 100 ? 100 : pan);
}

// ── Render ─────────────────────────────────────────────────────────────────────

void VoicePool::process(float* outputBuffer, int32_t numFrames, int32_t numChannels) noexcept {
    for (auto& v : mVoices) {
        if (!v.isActive()) continue;
        renderVoice(v, outputBuffer, numFrames, numChannels);
    }
}

void VoicePool::renderVoice(Voice& v, float* out, int32_t numFrames, int32_t numChannels) noexcept {
    const SampleBuffer* buf = v.buffer;
    if (!buf || !buf->data || buf->length == 0) { v.state = VoiceState::Idle; return; }

    const int32_t startFrame = v.startOffset;   // voice starts at this frame
    const int32_t trackIndex = v.trackIndex < kMaxTracks ? v.trackIndex : 0;
    const float   gain       = v.volume * (static_cast<float>(mTrackVolume[trackIndex]) / 127.0f);
    const float   pan        = static_cast<float>(mTrackPan[trackIndex]) / 100.0f;
    const float   leftGain   = pan > 0.0f ? 1.0f - pan : 1.0f;
    const float   rightGain  = pan < 0.0f ? 1.0f + pan : 1.0f;
    const int64_t step       = v.pitchStepQ16;
    const bool    stereo     = (numChannels >= 2);

    for (int32_t f = startFrame; f < numFrames; ++f) {
        const int32_t readInt  = static_cast<int32_t>(v.readPosQ16 >> 16);
        const float   frac     = static_cast<float>(v.readPosQ16 & 0xFFFF) * (1.0f / 65536.0f);

        if (readInt >= buf->length) {
            if (buf->looping && buf->loopEnd > buf->loopStart) {
                const int64_t loopLen = static_cast<int64_t>(buf->loopEnd - buf->loopStart) << 16;
                v.readPosQ16 = (static_cast<int64_t>(buf->loopStart) << 16)
                              + (v.readPosQ16 - (static_cast<int64_t>(buf->loopEnd) << 16)) % loopLen;
            } else {
                v.state = VoiceState::Idle;
                break;
            }
        }

        // Linear interpolation between adjacent samples
        const float s0 = buf->data[readInt];
        const float s1 = (readInt + 1 < buf->length) ? buf->data[readInt + 1] : 0.0f;
        const float sample = (s0 + (s1 - s0) * frac) * gain * v.envelope;

        const int32_t base = f * numChannels;
        out[base]     += sample * leftGain;
        if (stereo) out[base + 1] += sample * rightGain;

        v.readPosQ16 += step;

        // Release envelope
        if (v.state == VoiceState::Releasing) {
            v.envelope -= v.envRelease;
            if (v.envelope <= 0.0f) {
                v.envelope = 0.0f;
                v.state    = VoiceState::Idle;
                break;
            }
        }
    }
    v.startOffset = 0;  // after first callback, start from frame 0
}

// ── Private ────────────────────────────────────────────────────────────────────

int32_t VoicePool::findIdleVoice() const noexcept {
    for (int32_t i = 0; i < kMaxVoices; ++i) {
        if (mVoices[i].state == VoiceState::Idle) return i;
    }
    return -1;
}

int32_t VoicePool::findStealVoice(uint8_t trackIndex, uint8_t chokeGrp) const noexcept {
    // Priority: same track first, then any
    int32_t bestIdx  = -1;
    int64_t bestPos  = INT64_MAX;

    // Pass 1: same track
    for (int32_t i = 0; i < kMaxVoices; ++i) {
        const Voice& v = mVoices[i];
        if (!v.isActive()) continue;
        if (v.trackIndex == trackIndex && v.readPosQ16 < bestPos) {
            bestPos = v.readPosQ16; bestIdx = i;
        }
    }
    if (bestIdx >= 0) return bestIdx;

    // Pass 2: same choke group
    if (chokeGrp > 0) {
        bestPos = INT64_MAX;
        for (int32_t i = 0; i < kMaxVoices; ++i) {
            const Voice& v = mVoices[i];
            if (v.chokeGroup == chokeGrp && v.readPosQ16 < bestPos) {
                bestPos = v.readPosQ16; bestIdx = i;
            }
        }
        if (bestIdx >= 0) return bestIdx;
    }

    // Pass 3: oldest voice globally
    bestPos = INT64_MAX;
    for (int32_t i = 0; i < kMaxVoices; ++i) {
        const Voice& v = mVoices[i];
        if (v.isActive() && v.readPosQ16 < bestPos) {
            bestPos = v.readPosQ16; bestIdx = i;
        }
    }
    return bestIdx;
}

void VoicePool::chokeGroup(uint8_t group) noexcept {
    if (group == 0) return;
    for (auto& v : mVoices) {
        if (v.isActive() && v.chokeGroup == group) {
            v.state = VoiceState::Releasing;
            // Fast 5 ms choke release
            v.envRelease = 1.0f / (0.005f * static_cast<float>(mSampleRate));
        }
    }
}

int32_t VoicePool::activeVoiceCount() const noexcept {
    int32_t count = 0;
    for (const auto& v : mVoices) if (v.isActive()) ++count;
    return count;
}

} // namespace vibecore
