#include "StepSequencer.h"
#include <algorithm>

namespace vibecore {

// ─── Setup ────────────────────────────────────────────────────────────────────

void StepSequencer::configure(int32_t trackIndex, int32_t sampleRate) noexcept {
    mTrackIndex  = trackIndex;
    mSampleRate  = sampleRate;
}

void StepSequencer::resetToStart() noexcept {
    mCurrentStep      = 0;
    mNextStepTick     = 0;
    mRoll             = {};
    mTransportRunning = true;
    if (mPendingPattern) {
        mPattern = mPendingPattern;
        mPendingPattern = nullptr;
    }
}

void StepSequencer::setPattern(const Pattern* pattern) noexcept {
    mPendingPattern = pattern;  // apply on next bar
    if (!mTransportRunning) {
        mPattern = pattern;     // if stopped, apply immediately
        mPendingPattern = nullptr;
    }
}

void StepSequencer::onBar() noexcept {
    if (mPendingPattern) {
        mPattern = mPendingPattern;
        mPendingPattern = nullptr;
    }
}

void StepSequencer::onTransportStop() noexcept {
    mTransportRunning = false;
    mRoll = {};
}

// ─── onTick — main sequencer logic ────────────────────────────────────────────

int32_t StepSequencer::onTick(int64_t absoluteTick,
                               int32_t sampleOffset,
                               TriggerQueue& queue,
                               uint32_t& rng) noexcept {
    if (!mPattern || mPattern->length == 0) return 0;
    int32_t triggered = 0;

    // ── Continue a pending roll ───────────────────────────────────────────
    if (mRoll.active && absoluteTick >= mRoll.nextRollTick) {
        Trigger rt;
        rt.sampleOffset = sampleOffset;
        rt.sampleId     = mSampleId;
        rt.trackIndex   = static_cast<uint8_t>(mTrackIndex);
        rt.note         = mRoll.note;
        rt.velocity     = static_cast<uint8_t>(mRoll.velocity);
        rt.chokeGroup   = mChokeGroup;
        rt.choke        = false;
        if (queue.push(rt)) triggered++;

        mRoll.hitsLeft--;
        if (mRoll.hitsLeft <= 0) {
            mRoll.active = false;
        } else {
            mRoll.nextRollTick += mRoll.spacingTicks;
        }
    }

    // ── Check if the next step fires at this tick ─────────────────────────
    if (absoluteTick < mNextStepTick) return triggered;

    const int32_t stepIdx   = mCurrentStep % mPattern->length;
    const Step&   step      = mPattern->steps[stepIdx];

    // Advance sequencer regardless of whether the step fires
    const int32_t baseSize  = mPattern->stepSizeTicks;
    const int64_t swingTick = applySwing(mNextStepTick, stepIdx, baseSize, mPattern->swing);
    const int32_t humanOff  = humanizeOffset(mPattern->humanize, baseSize, rng);
    const int64_t fireTick  = swingTick + step.microTiming + humanOff;

    // Advance state for next step
    mCurrentStep++;
    if (mCurrentStep % mPattern->length == 0) {
        // Pattern wrapped — recalculate pattern start
    }
    mNextStepTick += baseSize;
    // Re-add swing for odd steps (affects the NEXT step calculation)
    // Swing delayed odd steps: step 0 fires early, step 1 fires late relative to baseline
    // This model is: even steps are on-grid, odd steps are delayed by swing%
    // mNextStepTick is already the grid tick — swing is applied per-step above.

    // ── Check if this step should fire ───────────────────────────────────
    if (absoluteTick < fireTick) return triggered;  // not yet (micro-timing / swing)
    if (!step.active || step.muted) return triggered;

    // Probability gate
    if (step.probability < 100) {
        const uint32_t rand8 = xorshift(rng) & 0xFF;
        if (static_cast<uint32_t>(rand8) > static_cast<uint32_t>(step.probability * 255 / 100)) {
            return triggered;
        }
    }

    // ── Flam: fire pre-hit slightly before main hit ───────────────────────
    scheduleFlam(step, fireTick, sampleOffset, queue);

    // ── Main hit ──────────────────────────────────────────────────────────
    const Trigger t = buildTrigger(step, sampleOffset);
    if (queue.push(t)) triggered++;

    // ── Roll: schedule additional hits ───────────────────────────────────
    if (step.rollCount > 0) {
        scheduleRoll(step, fireTick, sampleOffset, queue);
    }

    return triggered;
}

// ─── Private helpers ──────────────────────────────────────────────────────────

int64_t StepSequencer::applySwing(int64_t baseTick, int32_t stepIndex,
                                    int32_t stepSizeTicks, uint8_t swing) const noexcept {
    if (swing == 0 || (stepIndex % 2 == 0)) return baseTick;
    // Swing adds a fraction of step size to odd steps
    // swing 50 = no swing (50% on, 50% off)
    // swing 75 = late: odd step delayed by (75-50)/100 * stepSizeTicks
    const int32_t swingPercent = static_cast<int32_t>(swing) - 50;
    if (swingPercent <= 0) return baseTick;
    return baseTick + static_cast<int64_t>(swingPercent * stepSizeTicks / 100);
}

int32_t StepSequencer::humanizeOffset(uint8_t humanize, int32_t stepSizeTicks,
                                       uint32_t& rng) const noexcept {
    if (humanize == 0) return 0;
    const int32_t maxOff = humanize * stepSizeTicks / 200;  // ±half the humanize range
    const int32_t raw    = static_cast<int32_t>(xorshift(rng) % static_cast<uint32_t>(maxOff * 2 + 1));
    return raw - maxOff;
}

void StepSequencer::scheduleFlam(const Step& step, int64_t /*stepTick*/,
                                   int32_t baseOffset, TriggerQueue& queue) noexcept {
    if (!step.flam) return;
    // Flam: a softer pre-hit before the main hit
    // In sample-offset terms: flamOffset ticks earlier = fewer samples earlier
    // Since we're within the same callback, offset by -flamOffset samples equivalent
    // For simplicity: flam fires at sampleOffset - 1 (if sampleOffset > 0) at 60% velocity
    const int32_t flamSampleOffset = (baseOffset > 0) ? baseOffset - 1 : 0;
    Trigger ft;
    ft.sampleOffset = flamSampleOffset;
    ft.sampleId     = mSampleId;
    ft.trackIndex   = static_cast<uint8_t>(mTrackIndex);
    ft.note         = step.note;
    ft.velocity     = static_cast<uint8_t>(step.velocity * 60 / 100);
    ft.chokeGroup   = mChokeGroup;
    ft.choke        = false;
    queue.push(ft);
}

void StepSequencer::scheduleRoll(const Step& step, int64_t /*stepTick*/,
                                   int32_t /*baseOffset*/, TriggerQueue& /*queue*/) noexcept {
    // Set up roll state for subsequent ticks to consume
    mRoll.active       = true;
    mRoll.hitsLeft     = step.rollCount;
    mRoll.velocity     = step.velocity * 70 / 100;  // rolls slightly quieter
    mRoll.note         = step.note;
    mRoll.spacingTicks = step.rollSpacingTicks > 0 ? step.rollSpacingTicks : 240;
    // nextRollTick will be set on the first onTick after this
    // Use mNextStepTick - stepSize + spacing as starting point
    mRoll.nextRollTick = mNextStepTick - mPattern->stepSizeTicks + mRoll.spacingTicks;
}

Trigger StepSequencer::buildTrigger(const Step& step, int32_t sampleOffset) const noexcept {
    Trigger t;
    t.sampleOffset = sampleOffset;
    t.sampleId     = mSampleId;
    t.trackIndex   = static_cast<uint8_t>(mTrackIndex);
    t.note         = step.note;
    t.velocity     = step.accent ? step.accentVelocity : step.velocity;
    t.chokeGroup   = mChokeGroup;
    t.choke        = false;
    return t;
}

} // namespace vibecore
