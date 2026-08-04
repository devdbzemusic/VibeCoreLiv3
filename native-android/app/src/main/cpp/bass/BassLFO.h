#pragma once
/**
 * BassLFO.h — Low-Frequency Oscillator for VibeCore 3D Bass.
 *
 * Design:
 *   · Shapes: Sine, Triangle, Saw, Square, Sample & Hold.
 *   · Sync modes: Free, Beat (16th note grid), Bar (bar grid).
 *   · Retrigger: optional phase reset on noteOn.
 *   · Sample-accurate phase accumulation.
 *   · beat/bar sync: tempo injected via syncTick() called from onBeat/onBar.
 *
 * Thread model: ALL methods on Audio Thread only.
 */

#include "BassTypes.h"
#include <cmath>

namespace vibecore {

class BassLFO {
public:
    void setSampleRate(int sr) noexcept { mSampleRate = sr; }

    void setDef(const BassLFODef& def) noexcept {
        mDef = def;
        updatePhaseInc();
    }

    void setShape    (BassLFOShape s) noexcept { mDef.shape = s; }
    void setRateHz   (float hz)       noexcept { mDef.rateHz = hz; updatePhaseInc(); }
    void setDepth    (float d)        noexcept { mDef.depth = d; }
    void setSync     (BassLFOSync s)  noexcept { mDef.sync = s; }
    void setRetrigger(bool r)         noexcept { mDef.retrigger = r; }

    void noteOn()  noexcept { if (mDef.retrigger) mState.phaseAccum = mDef.phase; }
    void reset()   noexcept { mState.reset(mDef.phase); }

    // Sync to beat / bar (called from AudioNode::onBeat / onBar).
    void syncBeat(double bpm) noexcept;
    void syncBar (double bpm, int beatsPerBar) noexcept;

    // Advance and return next LFO value (–depth … +depth).
    float process() noexcept;

    float value() const noexcept { return mState.value; }

private:
    static constexpr float kTwoPi = 6.28318530718f;

    float generateShape() const noexcept;
    void  updatePhaseInc() noexcept;

    BassLFODef   mDef       = {};
    BassLFOState mState     = {};
    int          mSampleRate = 48000;
};

} // namespace vibecore
