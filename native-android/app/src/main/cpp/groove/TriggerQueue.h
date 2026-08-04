#pragma once
/**
 * TriggerQueue.h — Lock-free fixed-size trigger queue for the Groove Engine.
 *
 * Filled by GrooveNode::onTick()  (Audio Thread — sync callback phase)
 * Drained by GrooveNode::process() (Audio Thread — render phase)
 *
 * Both producer and consumer run on the Audio Thread in the SAME callback,
 * so there is NO actual thread concurrency here. This is a simple
 * sequential single-threaded queue — still fixed-size, still zero-allocation.
 *
 * Capacity = kMaxTriggers (256).
 * At 300 BPM with 1/32 steps, 16 tracks, max rolls:
 *   16 tracks × (1 + 8 rolls + 1 flam) ≈ 160 triggers per callback.
 *   256 is a safe upper bound.
 *
 * AUDIO THREAD ONLY. Zero allocation.
 */

#include "GrooveTypes.h"
#include <array>
#include <cstdint>

namespace vibecore {

class TriggerQueue {
public:
    TriggerQueue() { clear(); }

    void clear() noexcept { mHead = mTail = 0; }

    /** Called from onTick() — schedule a trigger within the current callback. */
    bool push(const Trigger& t) noexcept {
        if (size() >= kMaxTriggers - 1) return false;
        mBuf[mTail % kMaxTriggers] = t;
        mTail++;
        return true;
    }

    /** Called from process() — consume the next trigger. */
    bool pop(Trigger& out) noexcept {
        if (mHead == mTail) return false;
        out = mBuf[mHead % kMaxTriggers];
        mHead++;
        return true;
    }

    int32_t size() const noexcept { return mTail - mHead; }
    bool    empty() const noexcept { return mHead == mTail; }

private:
    std::array<Trigger, kMaxTriggers> mBuf = {};
    int32_t mHead = 0;
    int32_t mTail = 0;
};

} // namespace vibecore
