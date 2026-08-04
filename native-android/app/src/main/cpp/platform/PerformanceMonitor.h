#pragma once
/**
 * PerformanceMonitor.h — Real-time audio performance tracking.
 *
 * Tracks on the Audio Thread (lock-free, zero allocation):
 *   - Callback duration (nanoseconds, rolling average over 512 callbacks)
 *   - XRun count (underruns + overruns)
 *   - Estimated output latency (ms)
 *   - CPU usage per callback (fraction of budget)
 *
 * Metrics are exposed as atomics, readable from any thread (UI for display).
 *
 * Thread ownership:
 *   update()    → Audio Thread ONLY
 *   getStats()  → any thread (reads atomics)
 */

#include <atomic>
#include <cstdint>
#include <array>

namespace vibecore {

struct PerformanceStats {
    double  avgCallbackDurationMs  = 0.0;
    double  maxCallbackDurationMs  = 0.0;
    double  cpuUsageFraction       = 0.0;  // 0.0 – 1.0 (fraction of callback budget)
    double  estimatedLatencyMs     = 0.0;
    int64_t xrunCount              = 0;
    int32_t sampleRate             = 48000;
    int32_t framesPerCallback      = 96;
};

class PerformanceMonitor {
public:
    PerformanceMonitor() = default;

    /** Call once before stream starts (UI thread). */
    void prepare(int32_t sampleRate, int32_t framesPerCallback);

    /**
     * Called at the START of each audio callback.
     * Records the callback entry timestamp.
     * Audio Thread only.
     */
    void onCallbackStart() noexcept;

    /**
     * Called at the END of each audio callback.
     * Computes duration, updates rolling average, checks budget.
     * Audio Thread only.
     */
    void onCallbackEnd() noexcept;

    /** Call when Oboe reports an XRun. Audio Thread or UI Thread. */
    void onXRun() noexcept;

    /** Update estimated latency (from Oboe timestamp). Audio Thread. */
    void setEstimatedLatencyMs(double latencyMs) noexcept;

    /**
     * Read current stats snapshot. Safe from any thread.
     * Values are approximate (no fence guarantee between fields).
     */
    PerformanceStats getStats() const noexcept;

    /** Reset all counters (UI Thread, call when stream stops). */
    void reset() noexcept;

private:
    static constexpr int kWindowSize = 512;
    static constexpr int kWindowMask = kWindowSize - 1;

    std::atomic<int64_t>  mCallbackStartNs{0};
    std::atomic<int64_t>  mXrunCount{0};
    std::atomic<int64_t>  mTotalDurationNs{0};
    std::atomic<int64_t>  mMaxDurationNs{0};
    std::atomic<int64_t>  mCallbackCount{0};
    std::atomic<int64_t>  mEstimatedLatencyUs{0}; // microseconds

    int32_t mSampleRate{48000};
    int32_t mFramesPerCallback{96};
    double  mCallbackBudgetMs{2.0}; // 96/48000 * 1000
};

} // namespace vibecore
