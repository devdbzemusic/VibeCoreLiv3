#pragma once
/**
 * AudioThreadSafeQueue.h — Lock-free Single-Producer / Single-Consumer queue.
 *
 * The canonical mechanism for sending commands from any control thread
 * (UI, Worker, MIDI, File I/O) to the Audio Thread.
 *
 * Guarantees:
 *   - Zero allocations after construction
 *   - No mutexes, no spinlocks
 *   - Wait-free producer (push returns false if full, never blocks)
 *   - Wait-free consumer (pop returns false if empty, never blocks)
 *   - Memory-order: release on push, acquire on pop (sequentially consistent view)
 *
 * Capacity must be a power of 2.
 * T must be trivially copyable (no dynamic allocation inside T).
 *
 * Usage:
 *   AudioThreadSafeQueue<ParameterChange, 256> queue;
 *   // Producer (UI thread):
 *   queue.push({ ParamId::MasterGain, 0.8f });
 *   // Consumer (Audio thread):
 *   ParameterChange cmd;
 *   while (queue.pop(cmd)) { applyParam(cmd); }
 */

#include <atomic>
#include <array>
#include <cstddef>
#include <type_traits>

namespace vibecore {

template<typename T, size_t Capacity>
class AudioThreadSafeQueue {
    static_assert((Capacity & (Capacity - 1)) == 0, "Capacity must be a power of 2");
    static_assert(std::is_trivially_copyable<T>::value,  "T must be trivially copyable");

public:
    AudioThreadSafeQueue() : mHead(0), mTail(0) {}

    /**
     * Push from producer thread (UI / Worker / MIDI).
     * Returns true if the item was enqueued, false if the queue is full.
     * NEVER call from the Audio Thread.
     */
    bool push(const T& item) noexcept {
        const size_t head = mHead.load(std::memory_order_relaxed);
        const size_t next = (head + 1) & kMask;
        if (next == mTail.load(std::memory_order_acquire)) {
            return false; // full
        }
        mBuffer[head] = item;
        mHead.store(next, std::memory_order_release);
        return true;
    }

    /**
     * Pop from consumer thread (Audio Thread).
     * Returns true and fills `out` if an item was available.
     * Returns false if the queue is empty.
     */
    bool pop(T& out) noexcept {
        const size_t tail = mTail.load(std::memory_order_relaxed);
        if (tail == mHead.load(std::memory_order_acquire)) {
            return false; // empty
        }
        out = mBuffer[tail];
        mTail.store((tail + 1) & kMask, std::memory_order_release);
        return true;
    }

    /** Returns approximate number of items (may be stale). */
    size_t size() const noexcept {
        const size_t h = mHead.load(std::memory_order_acquire);
        const size_t t = mTail.load(std::memory_order_acquire);
        return (h - t) & kMask;
    }

    bool empty() const noexcept { return size() == 0; }

private:
    static constexpr size_t kMask = Capacity - 1;
    std::array<T, Capacity> mBuffer;
    alignas(64) std::atomic<size_t> mHead;
    alignas(64) std::atomic<size_t> mTail;
};

} // namespace vibecore
