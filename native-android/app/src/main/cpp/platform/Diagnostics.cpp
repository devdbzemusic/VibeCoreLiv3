#include "Diagnostics.h"
#include "VibeCoreLog.h"
#include "../threads/ThreadModel.h"
#include <sstream>
#include <ctime>
#include <iomanip>

namespace vibecore {

Diagnostics::Diagnostics(PerformanceMonitor& perfMon,
                         AudioDeviceManager& devMgr,
                         AudioSessionManager& sessMgr)
    : mPerfMon(perfMon), mDevMgr(devMgr), mSessMgr(sessMgr) {}

DiagnosticReport Diagnostics::collect() {
    VIBECORE_ASSERT_NOT_AUDIO_THREAD();

    DiagnosticReport report;

    // Timestamp
    std::time_t t = std::time(nullptr);
    std::ostringstream ts;
    ts << std::put_time(std::localtime(&t), "%Y-%m-%d %H:%M:%S");
    report.timestamp    = ts.str();

    // Subsystem snapshots
    report.performance  = mPerfMon.getStats();
    report.device       = mDevMgr.capabilities();
    report.sessionState = mSessMgr.state();

    // Analysis
    checkPerformanceWarnings(report);
    checkDeviceWarnings(report);
    checkSessionWarnings(report);

    // Format human-readable summary
    std::ostringstream fmt;
    fmt << "=== VibeCore Diagnostics " << report.timestamp << " ===\n";
    fmt << "Session:  " << sessionStateToString(report.sessionState) << "\n";
    fmt << "Device:   " << report.device.sampleRate << " Hz | "
        << report.device.burstFrames << " frames | "
        << (report.device.supportsAAudio ? "AAudio" : "OpenSL ES") << " | "
        << (report.device.supportsExclusive ? "Exclusive" : "Shared") << "\n";
    fmt << "Perf:     avg=" << std::fixed << std::setprecision(2)
        << report.performance.avgCallbackDurationMs << "ms  max="
        << report.performance.maxCallbackDurationMs << "ms  CPU="
        << static_cast<int>(report.performance.cpuUsageFraction * 100) << "%\n";
    fmt << "Latency:  " << report.performance.estimatedLatencyMs << " ms\n";
    fmt << "XRuns:    " << report.performance.xrunCount << "\n";

    if (!report.entries.empty()) {
        fmt << "Warnings:\n";
        for (const auto& e : report.entries) {
            const char* lvl = e.level == DiagnosticEntry::Level::Error   ? "ERROR"
                            : e.level == DiagnosticEntry::Level::Warning ? "WARN"
                            : "INFO";
            fmt << "  [" << lvl << "] " << e.component << ": " << e.message << "\n";
        }
    }
    fmt << "==========================================";
    report.formatted = fmt.str();
    return report;
}

std::string Diagnostics::statusLine() {
    const auto& perf = mPerfMon.getStats();
    const auto& dev  = mDevMgr.capabilities();
    const auto  sess = mSessMgr.state();

    std::ostringstream s;
    s << dev.sampleRate / 1000 << "kHz | "
      << dev.burstFrames << "fr | "
      << std::fixed << std::setprecision(1) << perf.estimatedLatencyMs << "ms | "
      << "CPU " << static_cast<int>(perf.cpuUsageFraction * 100) << "% | ";

    if (perf.xrunCount > 0)
        s << "XRun:" << perf.xrunCount << " ⚠";
    else if (sess == SessionState::Running)
        s << "✓";
    else
        s << sessionStateToString(sess);
    return s.str();
}

void Diagnostics::logReport() {
    auto report = collect();
    VLOG_I("%s", report.formatted.c_str());
}

void Diagnostics::checkPerformanceWarnings(DiagnosticReport& report) {
    const auto& perf = report.performance;
    if (perf.xrunCount > 0) {
        report.entries.push_back({DiagnosticEntry::Level::Warning, "PerformanceMonitor",
            "XRun detected — audio dropout occurred"});
    }
    if (perf.cpuUsageFraction > 0.7) {
        report.entries.push_back({DiagnosticEntry::Level::Warning, "PerformanceMonitor",
            "CPU usage > 70% of callback budget"});
    }
    if (perf.estimatedLatencyMs > 20.0) {
        report.entries.push_back({DiagnosticEntry::Level::Warning, "PerformanceMonitor",
            "Estimated latency > 20ms — consider reducing buffer size"});
    }
}

void Diagnostics::checkDeviceWarnings(DiagnosticReport& report) {
    if (!report.device.supportsAAudio) {
        report.entries.push_back({DiagnosticEntry::Level::Info, "AudioDeviceManager",
            "AAudio not available — using OpenSL ES (higher latency)"});
    }
    if (!report.device.supportsExclusive) {
        report.entries.push_back({DiagnosticEntry::Level::Info, "AudioDeviceManager",
            "Exclusive mode not available — shared mode in use"});
    }
}

void Diagnostics::checkSessionWarnings(DiagnosticReport& report) {
    if (report.sessionState == SessionState::Error) {
        report.entries.push_back({DiagnosticEntry::Level::Error, "AudioSessionManager",
            "Session is in Error state — stream must be restarted"});
    }
    if (report.sessionState == SessionState::Paused ||
        report.sessionState == SessionState::Ducked) {
        report.entries.push_back({DiagnosticEntry::Level::Warning, "AudioSessionManager",
            "Audio focus lost — playback paused/ducked"});
    }
}

} // namespace vibecore
