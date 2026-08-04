#pragma once
/**
 * MusicalPosition.h — Musical time position in VibeCore Sync.
 *
 * VibeCore uses PPQ = 1920 (pulses per quarter note).
 * Every position can be expressed as bars / beats / ticks or as
 * an absolute tick count from the transport start.
 *
 * Time signature: numerator/denominator (e.g. 4/4, 3/4, 7/8)
 * Bar:  one measure = numerator beats
 * Beat: one quarter note = PPQ ticks (always, regardless of denominator)
 * Tick: 1/PPQ of a quarter note
 *
 * All values are 0-based.
 *
 * Example at 4/4, PPQ=1920:
 *   absoluteTick 0    → bar 0, beat 0, tick 0
 *   absoluteTick 1920 → bar 0, beat 1, tick 0  (second quarter note)
 *   absoluteTick 7680 → bar 1, beat 0, tick 0  (second bar)
 */

#include <cstdint>

namespace vibecore {

static constexpr int32_t kPPQ = 1920;  // pulses per quarter note — FIXED, never changes

struct MusicalPosition {
    int64_t bar;           // 0-based measure number
    int32_t beat;          // 0-based beat within bar (0..numerator-1)
    int32_t tick;          // 0-based tick within beat (0..PPQ-1)
    int64_t absoluteTick;  // total ticks from transport start
    int64_t absoluteSample;// total samples from transport start

    /** True when this position is exactly on a beat boundary. */
    bool isOnBeat() const noexcept { return tick == 0; }

    /** True when this position is exactly on a bar boundary. */
    bool isOnBar()  const noexcept { return beat == 0 && tick == 0; }

    /** Compute from absolute tick given time signature numerator. */
    static MusicalPosition fromTick(int64_t absTick,
                                    int32_t numerator,
                                    int64_t absSample) noexcept {
        MusicalPosition p;
        p.absoluteTick   = absTick;
        p.absoluteSample = absSample;
        const int64_t ticksPerBar  = static_cast<int64_t>(kPPQ) * numerator;
        const int64_t ticksPerBeat = kPPQ;
        p.bar  = absTick / ticksPerBar;
        const int64_t tickInBar = absTick % ticksPerBar;
        p.beat = static_cast<int32_t>(tickInBar / ticksPerBeat);
        p.tick = static_cast<int32_t>(tickInBar % ticksPerBeat);
        return p;
    }
};

} // namespace vibecore
