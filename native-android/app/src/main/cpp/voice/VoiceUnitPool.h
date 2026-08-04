#pragma once
/**
 * VoiceUnitPool.h — Pool of kVoiceMaxUnits playable voice units.
 *
 * Allocation: O(1) free scan over fixed array (8 units).
 * Stealing (deterministic): releasing unit first, else oldest active.
 * Poly mode enforcement: Mono/Legato = 1 unit, Poly4 = 4, Poly8 = 8.
 *
 * Thread model: ALL methods on Audio Thread only.
 */

#include "VoiceUnit.h"
#include "VoiceSampleBank.h"

namespace vibecore {

class VoiceUnitPool {
public:
    void init(int sampleRate) noexcept {
        for (auto& u : mUnits) u.init(sampleRate);
    }

    void applyParams(const VoiceParams& p) noexcept {
        for (auto& u : mUnits) u.applyParams(p);
    }

    void noteOn(const VoiceTrigger& trig, const VoiceParams& p,
                const VoiceSampleBank& bank) noexcept {
        const int slotIdx = trig.sampleSlot >= 0 ? trig.sampleSlot : p.activeSampleSlot;
        const VoiceSampleSlot& slot = bank.slot(slotIdx);

        const int maxUnits = polyLimit(p.polyMode);

        // Mono / Legato: reuse unit 0
        if (maxUnits == 1) {
            float glideFrom = -1.0f;
            const bool legato = (p.polyMode == VoicePolyMode::Legato) && mUnits[0].isActive();
            if (mUnits[0].isActive()) glideFrom = mUnits[0].currentHz();
            if (!legato) {
                mUnits[0].noteOn(trig, p, slot, glideFrom);
            } else {
                // Legato: re-pitch without retrigger — emulate via glide noteOn
                mUnits[0].noteOn(trig, p, slot, glideFrom);
            }
            return;
        }

        // Poly: find idle unit within limit
        int target = -1;
        for (int i = 0; i < maxUnits; ++i) {
            if (!mUnits[i].isActive()) { target = i; break; }
        }
        // Steal: releasing first, else oldest — deferred start after 2 ms fade
        if (target < 0) {
            int oldest = 0, oldestAge = -1;
            for (int i = 0; i < maxUnits; ++i) {
                if (mUnits[i].isReleasing()) { target = i; break; }
                if (mUnits[i].ageFrames() > oldestAge) {
                    oldestAge = mUnits[i].ageFrames(); oldest = i;
                }
            }
            if (target < 0) target = oldest;
            mUnits[target].noteOnDeferred(trig, slot);   // fade out, then start
            return;
        }
        mUnits[target].noteOn(trig, p, slot, -1.0f);
    }

    void noteOff(uint8_t note) noexcept {
        for (auto& u : mUnits)
            if (u.isActive() && u.note() == note) u.noteOff();
    }

    void allNotesOff() noexcept {
        for (auto& u : mUnits) u.noteOff();
    }

    void hardStop() noexcept {
        for (auto& u : mUnits) u.kill();
    }

    // Kill (2 ms fade) every unit still reading from `data` — called before a
    // sample slot is replaced or cleared so no unit dereferences a buffer that
    // the UI thread will later reclaim.
    void killUsing(const float* data) noexcept {
        for (auto& u : mUnits)
            if (u.usesData(data)) u.kill();
    }

    // Render one frame across all units; returns max amp env (breath gating).
    float renderFrame(float& l, float& r, const VoiceParams& p,
                      const VoiceModValues& mod) noexcept {
        float maxEnv = 0.0f;
        for (auto& u : mUnits) {
            const float e = u.renderFrame(l, r, p, mod);
            if (e > maxEnv) maxEnv = e;
        }
        return maxEnv;
    }

    void accumulateMod(const VoiceParams& p, VoiceModValues& out) noexcept {
        for (auto& u : mUnits) u.accumulateMod(p, out);
    }

    void syncBeat(double bpm) noexcept { for (auto& u : mUnits) u.syncBeat(bpm); }
    void syncBar (double bpm, int bpb) noexcept { for (auto& u : mUnits) u.syncBar(bpm, bpb); }

    int32_t activeCount() const noexcept {
        int32_t n = 0;
        for (const auto& u : mUnits) if (u.isActive()) ++n;
        return n;
    }

private:
    static int polyLimit(VoicePolyMode m) noexcept {
        switch (m) {
        case VoicePolyMode::Mono:
        case VoicePolyMode::Legato: return 1;
        case VoicePolyMode::Poly4:  return 4;
        case VoicePolyMode::Poly8:
        default:                    return kVoiceMaxUnits;
        }
    }

    VoiceUnit mUnits[kVoiceMaxUnits];
};

} // namespace vibecore
