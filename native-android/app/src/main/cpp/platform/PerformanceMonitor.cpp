#include "PerformanceMonitor.h"
#include <time.h>
#include <algorithm>

namespace vibecore {

static int64_t nowNs() noexcept {
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return static_cast<int64_t>(ts.tv_sec) * 1'000'000'000LL + ts.tv_nsec;
}

void PerformanceMonitor::prepare(int32_t sampleRate, int32_t framesPerCallback) {
    mSampleRate        = sampleRate;
    mFramesPerCallback = framesPerCallback;
    mCallbackBudgetMs  = (static_cast<double>(framesPerCallback) / sampleRate) * 1000.0;
    reset();
}

void PerformanceMonitor::onCallbackStart() noexcept {
    mCallbackStartNs.store(nowNs(), std::memory_order_relaxed);
}

void PerformanceMonitor::onCallbackEnd() noexcept {
    const int64_t start    = mCallbackStartNs.load(std::memory_order_relaxed);
    const int64_t durationNs = nowNs() - start;

    // Accumulate for rolling average
    const int64_t count = mCallbackCount.fetch_add(1, std::memory_order_relaxed) + 1;
    const int64_t prevTotal = mTotalDurationNs.fetch_add(durationNs, std::memory_order_relaxed);
    (void)prevTotal;

    // Track max (non-atomic compare-exchange loop)
    int64_t currentMax = mMaxDurationNs.load(std::memory_order_relaxed);
    while (durationNs > currentMax) {
        if (mMaxDurationNs.compare_exchange_weak(currentMax, durationNs,
            std::memory_order_relaxed, std::memory_order_relaxed)) {
            break;
        }
    }
    (void)count;
}

void PerformanceMonitor::onXRun() noexcept {
    mXrunCount.fetch_add(1, std::memory_order_relaxed);
}

void PerformanceMonitor::setEstimatedLatencyMs(double latencyMs) noexcept {
    mEstimatedLatencyUs.store(static_cast<int64_t>(latencyMs * 1000.0),
                               std::memory_order_relaxed);
}

PerformanceStats PerformanceMonitor::getStats() const noexcept {
    PerformanceStats s;
    s.sampleRate        = mSampleRate;
    s.framesPerCallback = mFramesPerCallback;
    s.xrunCount         = mXrunCount.load(std::memory_order_relaxed);

    const int64_t count = mCallbackCount.load(std::memory_order_relaxed);
    const int64_t total = mTotalDurationNs.load(std::memory_order_relaxed);
    const int64_t maxNs = mMaxDurationNs.load(std::memory_order_relaxed);

    if (count > 0) {
        s.avgCallbackDurationMs = static_cast<double>(total) / count / 1e6;
        s.maxCallbackDurationMs = static_cast<double>(maxNs) / 1e6;
        const double budgetNs = mCallbackBudgetMs * 1e6;
        s.cpuUsageFraction = budgetNs > 0.0
            ? (static_cast<double>(total) / count) / budgetNs
            : 0.0;
    }

    const int64_t latUs = mEstimatedLatencyUs.load(std::memory_order_relaxed);
    s.estimatedLatencyMs = static_cast<double>(latUs) / 1000.0;
    return s;
}

void PerformanceMonitor::reset() noexcept {
    mCallbackStartNs.store(0, std::memory_order_relaxed);
    mXrunCount.store(0, std::memory_order_relaxed);
    mTotalDurationNs.store(0, std::memory_order_relaxed);
    mMaxDurationNs.store(0, std::memory_order_relaxed);
    mCallbackCount.store(0, std::memory_order_relaxed);
    mEstimatedLatencyUs.store(0, std::memory_order_relaxed);
}

} // namespace vibecore
