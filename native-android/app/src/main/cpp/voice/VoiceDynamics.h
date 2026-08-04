#pragma once
/**
 * VoiceDynamics.h — Gate, De-Esser, Compressor for VibeCore Voice.
 *
 * All three are envelope-follower based, per-sample, stereo-linked.
 *   Gate:       downward expander with hard floor, attack/release smoothing.
 *   De-Esser:   sibilance band (HP-detected) triggers a dynamic peaking cut.
 *   Compressor: feedforward, peak-detected, log-domain gain computer.
 *
 * Thread model: process on Audio Thread only.
 */

#include "VoiceTypes.h"
#include <cmath>

namespace vibecore {

// ─── Gate ─────────────────────────────────────────────────────────────────────

class VoiceGate {
public:
    void setSampleRate(int sr) noexcept { mSampleRate = sr; update(); }
    void setParams(const VoiceGateParams& p) noexcept { mParams = p; update(); }
    void reset() noexcept { mEnv = 0.0f; mGain = 0.0f; }

    void processStereo(float& l, float& r) noexcept {
        if (!mParams.enabled) return;
        const float in = std::fabs(l) > std::fabs(r) ? std::fabs(l) : std::fabs(r);
        // Envelope follower
        mEnv = in > mEnv ? in : mEnv * mEnvRelease + 1e-25f;
        const float target = mEnv >= mThreshLin ? 1.0f : 0.0f;
        mGain += (target - mGain) * (target > mGain ? mAttackCoeff : mReleaseCoeff);
        l *= mGain; r *= mGain;
    }

private:
    void update() noexcept {
        mThreshLin    = std::pow(10.0f, mParams.thresholdDb / 20.0f);
        mAttackCoeff  = coeff(mParams.attackMs);
        mReleaseCoeff = coeff(mParams.releaseMs);
        mEnvRelease   = 1.0f - coeff(50.0f);
    }
    float coeff(float ms) const noexcept {
        if (ms < 0.05f) return 1.0f;
        return 1.0f - std::exp(-1.0f / (ms * 0.001f * static_cast<float>(mSampleRate)));
    }

    VoiceGateParams mParams = {};
    int   mSampleRate = 48000;
    float mThreshLin = 0.003f, mAttackCoeff = 1.0f, mReleaseCoeff = 0.01f;
    float mEnvRelease = 0.999f;
    float mEnv = 0.0f, mGain = 0.0f;
};

// ─── De-Esser ─────────────────────────────────────────────────────────────────

class VoiceDeEsser {
public:
    void setSampleRate(int sr) noexcept { mSampleRate = sr; update(); }
    void setParams(const VoiceDeEsserParams& p) noexcept { mParams = p; update(); }
    void reset() noexcept {
        mHx1L = mHy1L = mHx1R = mHy1R = 0.0f;
        mEnv = 0.0f;
        mPk = {};
    }

    void processStereo(float& l, float& r) noexcept;

private:
    struct PkState {
        float x1L = 0, x2L = 0, y1L = 0, y2L = 0;
        float x1R = 0, x2R = 0, y1R = 0, y2R = 0;
    };

    void update() noexcept;

    VoiceDeEsserParams mParams = {};
    int   mSampleRate = 48000;

    // 1-pole HP sibilance detector
    float mHpCoeff = 0.9f;
    float mHx1L = 0, mHy1L = 0, mHx1R = 0, mHy1R = 0;

    // Detector envelope
    float mEnv = 0.0f;
    float mAtk = 0.5f, mRel = 0.01f;
    float mThreshLin = 0.04f;

    // Dynamic peaking cut (coefficients recomputed when reduction changes step)
    float mB0 = 1, mB1 = 0, mB2 = 0, mA1 = 0, mA2 = 0;
    float mCurRedDb = 0.0f;
    PkState mPk = {};
};

// ─── Compressor ───────────────────────────────────────────────────────────────

class VoiceCompressor {
public:
    void setSampleRate(int sr) noexcept { mSampleRate = sr; update(); }
    void setParams(const VoiceCompressorParams& p) noexcept { mParams = p; update(); }
    void reset() noexcept { mEnvDb = -120.0f; }

    void processStereo(float& l, float& r) noexcept {
        if (!mParams.enabled) return;
        const float in = std::fabs(l) > std::fabs(r) ? std::fabs(l) : std::fabs(r);
        const float inDb = 20.0f * std::log10(in + 1e-9f);
        const float c = inDb > mEnvDb ? mAtk : mRel;
        mEnvDb += (inDb - mEnvDb) * c;
        float gr = 0.0f;
        if (mEnvDb > mParams.thresholdDb) {
            gr = (mEnvDb - mParams.thresholdDb) * (1.0f - 1.0f / mParams.ratio);
        }
        const float g = std::pow(10.0f, (mParams.makeupDb - gr) / 20.0f);
        l *= g; r *= g;
    }

private:
    void update() noexcept {
        mAtk = coeff(mParams.attackMs);
        mRel = coeff(mParams.releaseMs);
    }
    float coeff(float ms) const noexcept {
        if (ms < 0.05f) return 1.0f;
        return 1.0f - std::exp(-1.0f / (ms * 0.001f * static_cast<float>(mSampleRate)));
    }

    VoiceCompressorParams mParams = {};
    int   mSampleRate = 48000;
    float mAtk = 0.5f, mRel = 0.01f;
    float mEnvDb = -120.0f;
};

} // namespace vibecore
