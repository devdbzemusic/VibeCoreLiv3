#pragma once
/**
 * Diagnostics.h — Structured diagnostic reporting for VibeCore platform.
 *
 * Collects and formats:
 *   - Engine state snapshot
 *   - Performance metrics
 *   - Device capabilities
 *   - Session state
 *   - Graph topology
 *   - Known issues / warnings
 *
 * Thread ownership: UI Thread (reads atomics from PerformanceMonitor).
 * Never call from Audio Thread.
 */

#include "PerformanceMonitor.h"
#include "AudioDeviceManager.h"
#include "AudioSessionManager.h"
#include <string>
#include <vector>

namespace vibecore {

struct DiagnosticEntry {
    enum class Level { Info, Warning, Error };
    Level       level;
    std::string component;
    std::string message;
};

struct DiagnosticReport {
    std::string            timestamp;
    PerformanceStats       performance;
    DeviceCapabilities     device;
    SessionState           sessionState;
    std::vector<DiagnosticEntry> entries;
    std::string            formatted;  // human-readable summary
};

class Diagnostics {
public:
    Diagnostics(PerformanceMonitor& perfMon,
                AudioDeviceManager& devMgr,
                AudioSessionManager& sessMgr);

    /**
     * Collect a full diagnostic snapshot.
     * Call on UI Thread only.
     */
    DiagnosticReport collect();

    /**
     * Returns a compact single-line status string suitable for TopBar display.
     * e.g. "48kHz | 96fr | 1.2ms | CPU 8% | ✓"
     */
    std::string statusLine();

    /**
     * Log the full report to Android logcat (VLOG_I).
     */
    void logReport();

private:
    void checkPerformanceWarnings(DiagnosticReport& report);
    void checkDeviceWarnings(DiagnosticReport& report);
    void checkSessionWarnings(DiagnosticReport& report);

    PerformanceMonitor&  mPerfMon;
    AudioDeviceManager&  mDevMgr;
    AudioSessionManager& mSessMgr;
};

} // namespace vibecore
