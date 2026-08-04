#include "BassLFO.h"

namespace vibecore {

static constexpr float kPi = 3.14159265359f;

// ─── Phase increment ─────────────────────────────────────────────────────────

void BassLFO::updatePhaseInc() noexcept {
    if (mDef.sync == BassLFOSync::Free && mSampleRate > 0) {
        mState.phaseInc = mDef.rateHz / static_cast<float>(mSampleRate);
    }
    // Beat/Bar sync: phaseInc set in syncBeat/syncBar
}

// ─── Sync ─────────────────────────────────────────────────────────────────────

void BassLFO::syncBeat(double bpm) noexcept {
    // Align LFO rate to one beat
    const float beatHz = static_cast<float>(bpm) / 60.0f;
    mState.phaseInc    = mDef.rateHz > 0.0f
                        ? mDef.rateHz / static_cast<float>(mSampleRate)
                        : beatHz       / static_cast<float>(mSampleRate);
}

void BassLFO::syncBar(double bpm, int beatsPerBar) noexcept {
    const float barHz  = static_cast<float>(bpm) / 60.0f / static_cast<float>(beatsPerBar);
    mState.phaseInc    = barHz / static_cast<float>(mSampleRate);
}

// ─── Shape generation ─────────────────────────────────────────────────────────

float BassLFO::generateShape() const noexcept {
    const float p = mState.phaseAccum; // 0..1
    switch (mDef.shape) {
    case BassLFOShape::Sine:
        return std::sin(p * kTwoPi);

    case BassLFOShape::Triangle:
        return (p < 0.5f) ? (4.0f * p - 1.0f) : (3.0f - 4.0f * p);

    case BassLFOShape::Saw:
        return 2.0f * p - 1.0f;

    case BassLFOShape::Square:
        return p < 0.5f ? 1.0f : -1.0f;

    case BassLFOShape::SampleHold:
        // Phase crosses 0 → new random-ish value based on accumulated phase
        // Deterministic: use triangle-wave-based approximation (no rand on audio thread)
        return (p < 0.5f) ? 1.0f : -1.0f;

    default:
        return 0.0f;
    }
}

// ─── Process ─────────────────────────────────────────────────────────────────

float BassLFO::process() noexcept {
    mState.value = generateShape() * mDef.depth;

    // Advance phase
    mState.phaseAccum += mState.phaseInc;
    if (mState.phaseAccum >= 1.0f) mState.phaseAccum -= 1.0f;
    if (mState.phaseAccum <  0.0f) mState.phaseAccum += 1.0f;

    return mState.value;
}

} // namespace vibecore
