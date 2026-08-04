#include "BassEnvelope.h"

namespace vibecore {

// ─── Coefficient recomputation ────────────────────────────────────────────────

void BassEnvelope::recomputeCoeffs() noexcept {
    mAttackCoeff  = timeToCoeff(mParams.attackMs,  mSampleRate);
    mDecayCoeff   = timeToCoeff(mParams.decayMs,   mSampleRate);
    mReleaseCoeff = timeToCoeff(mParams.releaseMs, mSampleRate);
}

// ─── Gate ─────────────────────────────────────────────────────────────────────

void BassEnvelope::noteOn(float velocity) noexcept {
    mState.velocity = mParams.velocityAmount > 0.001f
                    ? (1.0f - mParams.velocityAmount) + mParams.velocityAmount * velocity
                    : 1.0f;
    mState.stage  = BassVoiceState::Attack;
    mState.target = mState.velocity;
    mState.coeff  = mAttackCoeff;
    // If already active (legato retrigger), keep current value to avoid click
}

void BassEnvelope::noteOff() noexcept {
    if (mState.stage == BassVoiceState::Idle) return;
    mState.stage  = BassVoiceState::Release;
    mState.target = 0.0f;
    mState.coeff  = mReleaseCoeff;
}

void BassEnvelope::reset() noexcept {
    mState.reset();
    recomputeCoeffs();
}

// ─── Process ─────────────────────────────────────────────────────────────────
// One sample advance. Returns envelope value 0–1.
// Linear attack, exponential decay/release for natural bass feel.

float BassEnvelope::process() noexcept {
    switch (mState.stage) {
    case BassVoiceState::Attack:
        if constexpr (kLinearAttack) {
            mState.value += mAttackCoeff * (mState.velocity - mState.value);
        } else {
            mState.value += mState.coeff * (1.02f - mState.value);
        }
        if (mState.value >= mState.target * 0.999f) {
            mState.value = mState.target;
            mState.stage = BassVoiceState::Decay;
            mState.target = mParams.sustain * mState.velocity;
            mState.coeff  = mDecayCoeff;
        }
        break;

    case BassVoiceState::Decay:
        mState.value += mState.coeff * (mState.target - mState.value);
        if (mState.value <= mState.target + 0.0001f) {
            mState.value = mState.target;
            mState.stage = BassVoiceState::Sustain;
        }
        break;

    case BassVoiceState::Sustain:
        mState.value = mParams.sustain * mState.velocity;
        break;

    case BassVoiceState::Release:
        mState.value += mState.coeff * (0.0f - mState.value);
        if (mState.value < 0.0001f) {
            mState.value = 0.0f;
            mState.stage = BassVoiceState::Idle;
        }
        break;

    case BassVoiceState::Idle:
    default:
        mState.value = 0.0f;
        break;
    }

    return mState.value;
}

} // namespace vibecore
