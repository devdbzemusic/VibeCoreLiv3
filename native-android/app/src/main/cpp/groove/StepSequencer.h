#pragma once
/**
 * StepSequencer.h — Per-track step sequencer for VibeCore Groove.
 *
 * One StepSequencer instance per track.
 * Owned and operated exclusively by the Audio Thread.
 *
 * Receives onTick() events from VibeCore Sync and decides
 * whether a step fires at that tick, applying:
 *   · Swing (odd-step delay)
 *   · Humanize (random micro-timing jitter via seeded xorshift)
 *   · Probability (per-step chance gate)
 *   · Roll (multiple hits within one step duration)
 *   · Flam (pre-hit before the main hit)
 *   · Micro Timing (per-step tick offset)
 *
 * Output: writes Trigger structs into TriggerQueue.
 *
 * AUDIO THREAD ONLY. Zero allocation. Zero locking.
 */

#include "GrooveTypes.h"
#include "TriggerQueue.h"
#include <cstdint>

namespace vibecore {

class StepSequencer {
public:
    StepSequencer() = default;

    // ── Audio Thread setup ────────────────────────────────────────────────

    /** Call when track layout changes or at prepare() time. */
    void configure(int32_t trackIndex, int32_t sampleRate) noexcept;

    /** Reset to start of pattern. Called on transport start / loop. */
    void resetToStart() noexcept;

    /** Update pattern pointer (double-buffer: apply atomically on bar boundary). */
    void setPattern(const Pattern* pattern) noexcept;

    /** Set sample ID to use for triggers on this track. */
    void setSampleId(int32_t id) noexcept { mSampleId = id; }

    /** Set choke group. */
    void setChokeGroup(uint8_t group) noexcept { mChokeGroup = group; }

    // ── Tick processing (Audio Thread — called from GrooveNode::onTick) ──

    /**
     * Called every tick.
     * If a step fires at this tick (+ all roll/flam sub-events), pushes
     * Trigger(s) to the queue.
     *
     * Returns: number of triggers pushed (0 if nothing fired).
     */
    int32_t onTick(int64_t absoluteTick,
                   int32_t sampleOffset,
                   TriggerQueue& queue,
                   uint32_t& rng) noexcept;

    /** Called when transport stops. Silences pending rolls. */
    void onTransportStop() noexcept;

    /** Called when tempo changes. Recalculates derived timing values. */
    void onTempoChanged(double newBpm) noexcept { (void)newBpm; }

    /** Called on bar boundary. Can be used to apply queued pattern changes. */
    void onBar() noexcept;

    // ── Query ──────────────────────────────────────────────────────────────
    int32_t currentStep() const noexcept { return mCurrentStep; }
    int32_t patternLength() const noexcept { return mPattern ? mPattern->length : 0; }
    bool    isActive() const noexcept { return mPattern != nullptr; }

private:
    const Pattern* mPattern          = nullptr;
    const Pattern* mPendingPattern   = nullptr; // applied on next bar
    int32_t        mTrackIndex       = 0;
    int32_t        mSampleRate       = 48000;
    int32_t        mSampleId         = -1;
    uint8_t        mChokeGroup       = 0;

    // Step state (Audio Thread)
    int32_t  mCurrentStep      = 0;
    int64_t  mNextStepTick     = 0;  // absolute tick when the next step fires
    bool     mTransportRunning = false;

    // Pending roll state
    struct RollState {
        bool    active       = false;
        int32_t hitsLeft     = 0;
        int64_t nextRollTick = 0;
        int16_t velocity     = 100;
        uint8_t note         = 60;
        int32_t spacingTicks = 240;
    } mRoll;

    // Compute the tick at which a given step fires
    int64_t computeStepTick(int32_t stepIndex, int64_t patternStartTick) const noexcept;

    // Apply swing offset to a step tick (odd steps get delayed)
    int64_t applySwing(int64_t baseTick, int32_t stepIndex, int32_t stepSizeTicks, uint8_t swing) const noexcept;

    // Apply humanize: random offset ±humanize% of stepSizeTicks
    int32_t humanizeOffset(uint8_t humanize, int32_t stepSizeTicks, uint32_t& rng) const noexcept;

    // Schedule a step's roll hits starting from a tick
    void scheduleRoll(const Step& step, int64_t stepTick,
                      int32_t baseOffset, TriggerQueue& queue) noexcept;

    // Schedule a flam pre-hit
    void scheduleFlam(const Step& step, int64_t stepTick,
                      int32_t baseOffset, TriggerQueue& queue) noexcept;

    // Build a trigger from a step
    Trigger buildTrigger(const Step& step, int32_t sampleOffset) const noexcept;

    // Deterministic xorshift helper
    static uint32_t xorshift(uint32_t& state) noexcept {
        state ^= state << 13;
        state ^= state >> 17;
        state ^= state << 5;
        return state;
    }
};

} // namespace vibecore
