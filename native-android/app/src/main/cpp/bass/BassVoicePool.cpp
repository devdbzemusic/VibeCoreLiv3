#include "BassVoicePool.h"
#include <algorithm>

namespace vibecore {

// ─── Init ─────────────────────────────────────────────────────────────────────

void BassVoicePool::init(const BassWavetable* wt, int sampleRate) {
    mSampleRate = sampleRate;
    for (int i = 0; i < kBassMaxVoices; ++i) {
        mVoices[i].init(wt, sampleRate);
    }
    // Initialize free list (all voices free, stack: kBassMaxVoices-1 at top)
    mFreeCount = kBassMaxVoices;
    for (int i = 0; i < kBassMaxVoices; ++i) {
        mFreeList[i] = kBassMaxVoices - 1 - i; // reverse order: 15,14,13…0
    }
}

// ─── Max voices by mode ───────────────────────────────────────────────────────

int32_t BassVoicePool::maxVoices(const BassParams& params) const noexcept {
    switch (params.voiceMode) {
    case BassVoiceMode::Mono:   return 1;
    case BassVoiceMode::Legato: return 1;
    case BassVoiceMode::Poly4:  return 4;
    case BassVoiceMode::Poly8:  return 8;
    default:                    return 1;
    }
}

// ─── Find voice playing a given note ─────────────────────────────────────────

int32_t BassVoicePool::findVoice(uint8_t note) const noexcept {
    for (int i = 0; i < kBassMaxVoices; ++i) {
        if (mVoices[i].isActive() && mVoices[i].noteNumber() == note) return i;
    }
    return -1;
}

// ─── Steal the oldest / releasing voice ──────────────────────────────────────

int32_t BassVoicePool::stealVoice() noexcept {
    // Prefer voices already in Release
    int32_t oldestRelease = -1;
    int32_t oldestAge     = -1;

    for (int i = 0; i < kBassMaxVoices; ++i) {
        if (!mVoices[i].isActive()) continue;
        if (mVoices[i].voiceState() == BassVoiceState::Release) {
            if (mVoices[i].ageFrames() > oldestAge) {
                oldestAge     = mVoices[i].ageFrames();
                oldestRelease = i;
            }
        }
    }
    if (oldestRelease >= 0) return oldestRelease;

    // No releasing voice — steal the oldest active voice
    int32_t oldestActive = -1;
    oldestAge = -1;
    for (int i = 0; i < kBassMaxVoices; ++i) {
        if (!mVoices[i].isActive()) continue;
        if (mVoices[i].ageFrames() > oldestAge) {
            oldestAge     = mVoices[i].ageFrames();
            oldestActive  = i;
        }
    }
    return oldestActive;
}

// ─── Allocate ─────────────────────────────────────────────────────────────────

int32_t BassVoicePool::allocateVoice(const BassParams& params) noexcept {
    const int32_t max = maxVoices(params);

    // Count current active voices
    int32_t activeCount = 0;
    for (int i = 0; i < kBassMaxVoices; ++i) {
        if (mVoices[i].isActive()) ++activeCount;
    }

    // If at limit, steal
    if (activeCount >= max) {
        const int32_t stolen = stealVoice();
        if (stolen >= 0) {
            mVoices[stolen].forceOff();
            // Re-add to free list
            mFreeList[mFreeCount++] = stolen;
        }
    }

    // Pop from free list
    if (mFreeCount > 0) {
        return mFreeList[--mFreeCount];
    }

    // Fallback: steal regardless of voice count
    return stealVoice();
}

// ─── NoteOn ───────────────────────────────────────────────────────────────────

void BassVoicePool::noteOn(const BassTrigger& trig, const BassParams& params) noexcept {
    // Legato mode: if a voice is already playing, just retrigger it (no new alloc)
    if (params.voiceMode == BassVoiceMode::Legato) {
        int32_t existing = -1;
        for (int i = 0; i < kBassMaxVoices; ++i) {
            if (mVoices[i].isActive()) { existing = i; break; }
        }
        if (existing >= 0 && !trig.retrigger) {
            // Legato: just update pitch, no envelope retrigger
            BassTrigger legatoTrig = trig;
            legatoTrig.glideFromPitch = mLastPitch;
            mVoices[existing].noteOn(legatoTrig, params);
            mLastPitch = mVoices[existing].isActive()
                       ? static_cast<float>(trig.note) : mLastPitch;
            mLastNote  = trig.note;
            return;
        }
    }

    const int32_t idx = allocateVoice(params);
    if (idx < 0) return;  // Should never happen

    // Build trigger with glide info
    BassTrigger actualTrig = trig;
    if (params.glideMs > 1.0f) {
        actualTrig.glideFromPitch = mLastPitch;
    }

    mVoices[idx].noteOn(actualTrig, params);
    mLastNote  = trig.note;

    // Approximate last pitch (will be refined by voice itself)
    const float kA4Hz = 440.0f;
    mLastPitch = kA4Hz * std::pow(2.0f, (static_cast<float>(trig.note) - 69.0f) / 12.0f);
}

// ─── NoteOff ──────────────────────────────────────────────────────────────────

void BassVoicePool::noteOff(uint8_t note, int32_t sampleOffset) noexcept {
    const int32_t idx = findVoice(note);
    if (idx >= 0) {
        mVoices[idx].noteOff(sampleOffset);
    }
}

void BassVoicePool::allNotesOff() noexcept {
    for (auto& v : mVoices) {
        if (v.isActive()) v.forceOff();
    }
    mFreeCount = kBassMaxVoices;
    for (int i = 0; i < kBassMaxVoices; ++i) {
        mFreeList[i] = kBassMaxVoices - 1 - i;
    }
}

// ─── Render frame ─────────────────────────────────────────────────────────────

void BassVoicePool::renderFrame(float& outL, float& outR, const BassParams& params) noexcept {
    outL = outR = 0.0f;
    for (int i = 0; i < kBassMaxVoices; ++i) {
        if (!mVoices[i].isActive()) continue;

        float vL = 0.0f, vR = 0.0f;
        mVoices[i].renderFrame(vL, vR, params);

        if (!mVoices[i].isActive()) {
            // Voice just finished — return to free list
            mFreeList[mFreeCount++] = i;
        }

        outL += vL;
        outR += vR;
    }
}

// ─── Parameter propagation ────────────────────────────────────────────────────

void BassVoicePool::applyFilterParams(const BassParams& params) noexcept {
    for (auto& v : mVoices) if (v.isActive()) v.applyFilterParams(params);
}

void BassVoicePool::applyEnvParams(const BassParams& params) noexcept {
    for (auto& v : mVoices) if (v.isActive()) v.applyEnvParams(params);
}

void BassVoicePool::applyLFOParams(const BassParams& params) noexcept {
    for (auto& v : mVoices) if (v.isActive()) v.applyLFOParams(params);
}

// ─── Tempo sync ───────────────────────────────────────────────────────────────

void BassVoicePool::onBeat(double bpm) noexcept {
    for (auto& v : mVoices) if (v.isActive()) v.onBeat(bpm);
}

void BassVoicePool::onBar(double bpm, int beatsPerBar) noexcept {
    for (auto& v : mVoices) if (v.isActive()) v.onBar(bpm, beatsPerBar);
}

// ─── Stats ────────────────────────────────────────────────────────────────────

int32_t BassVoicePool::activeVoiceCount() const noexcept {
    int32_t count = 0;
    for (const auto& v : mVoices) if (v.isActive()) ++count;
    return count;
}

} // namespace vibecore
