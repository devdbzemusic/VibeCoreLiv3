#pragma once
/**
 * VoiceHarmonizer.h — Harmonizer + Doubler for VibeCore Voice.
 *
 * Harmonizer: up to kVoiceHarmonyVoices independent pitch-shifted copies
 * of the processed voice signal, each with semitone offset, level, pan.
 *
 * Doubler: two detuned copies (± detuneCents) spread across the stereo
 * field for classic vocal doubling.
 *
 * Thread model: process on Audio Thread only.
 */

#include "VoiceTypes.h"
#include "VoicePitchShifter.h"

namespace vibecore {

class VoiceHarmonizer {
public:
    void setSampleRate(int sr) noexcept {
        for (auto& s : mShifters) s.setSampleRate(sr);
        mDoubleUp.setSampleRate(sr);
        mDoubleDown.setSampleRate(sr);
    }

    void setParams(const VoiceHarmonizerParams& h, const VoiceDoublerParams& d) noexcept {
        mParams  = h;
        mDoubler = d;
        for (int i = 0; i < kVoiceHarmonyVoices; ++i)
            mShifters[i].setSemitones(h.voices[i].semitones);
        mDoubleUp.setSemitones  ( d.detuneCents / 100.0f);
        mDoubleDown.setSemitones(-d.detuneCents / 100.0f);
    }

    void reset() noexcept {
        for (auto& s : mShifters) s.reset();
        mDoubleUp.reset();
        mDoubleDown.reset();
    }

    // in: mono source (pre-harmonizer mix). Adds harmony/double to l/r.
    void process(float in, float& l, float& r, float harmonyLevelMod) noexcept {
        if (mParams.enabled) {
            float master = mParams.masterLevel + harmonyLevelMod;
            if (master < 0.0f) master = 0.0f;
            if (master > 1.5f) master = 1.5f;
            for (int i = 0; i < kVoiceHarmonyVoices; ++i) {
                const VoiceHarmonyVoiceDef& v = mParams.voices[i];
                if (v.level <= 0.0f) continue;
                const float s  = mShifters[i].processSample(in) * v.level * master;
                const float a  = (v.pan + 1.0f) * 0.5f * 1.5707963f;
                l += s * std::cos(a);
                r += s * std::sin(a);
            }
        }
        if (mDoubler.enabled && mDoubler.level > 0.0f) {
            const float up   = mDoubleUp.processSample(in)   * mDoubler.level;
            const float down = mDoubleDown.processSample(in) * mDoubler.level;
            const float w = mDoubler.widthSpread;
            l += up   * (0.5f + 0.5f * w) + down * (0.5f - 0.5f * w);
            r += down * (0.5f + 0.5f * w) + up   * (0.5f - 0.5f * w);
        }
    }

private:
    VoiceHarmonizerParams mParams  = {};
    VoiceDoublerParams    mDoubler = {};
    VoicePitchShifter     mShifters[kVoiceHarmonyVoices];
    VoicePitchShifter     mDoubleUp, mDoubleDown;
};

} // namespace vibecore
