#pragma once
/**
 * VibeCoreAudioEngine.h — The single Oboe audio engine for VibeCore Univers.
 *
 * This is the ONE audio engine. Every module (Groove, Bass, Synth, Voice,
 * FX MIX LAB) connects through the AudioGraphManager, not through a
 * separate engine instance.
 *
 * Architecture:
 *   VibeCoreAudioEngine
 *     ├── AudioDeviceManager   (device query + hotplug)
 *     ├── AudioSessionManager  (focus + lifecycle state machine)
 *     ├── PerformanceMonitor   (latency + CPU tracking)
 *     ├── Diagnostics          (UI-readable status)
 *     └── AudioGraphManager    (node topology + render dispatch)
 *           └── [nodes added by modules — none in Phase 1]
 *
 * Thread model:
 *   start()/stop()               → UI Thread
 *   onAudioReady() callback      → Audio Thread (Oboe-managed)
 *   onErrorAfterClose() callback → Oboe error thread → posts restart flag
 *   parameter changes            → AudioThreadSafeQueue (UI→Audio)
 *
 * Phase 1 constraint: No instruments, no DSP effects, no module nodes.
 * The graph renders silence. This validates the platform before Phase 2.
 */

#include <oboe/Oboe.h>
#include <atomic>
#include <memory>

#include "AudioDeviceManager.h"
#include "AudioSessionManager.h"
#include "PerformanceMonitor.h"
#include "Diagnostics.h"
#include "../graph/AudioGraphManager.h"
#include "../threads/AudioThreadSafeQueue.h"

namespace vibecore {

// Commands routed from UI/Worker/MIDI threads to Audio Thread
struct AudioCommand {
    enum class Type : uint8_t {
        SetMasterGain = 0,
        SetTempo      = 1,
        // Phase 2+: AddNode, RemoveNode, RouteSignal, SetNodeParam, ...
    };
    Type  type;
    float value;
};

class VibeCoreAudioEngine : public oboe::AudioStreamDataCallback,
                            public oboe::AudioStreamErrorCallback {
public:
    VibeCoreAudioEngine();
    ~VibeCoreAudioEngine() override;

    // Non-copyable, non-movable — singleton within the process
    VibeCoreAudioEngine(const VibeCoreAudioEngine&)            = delete;
    VibeCoreAudioEngine& operator=(const VibeCoreAudioEngine&) = delete;

    // ── Lifecycle (UI Thread) ─────────────────────────────────────────────
    bool start();
    void stop();
    bool isRunning() const noexcept;

    // ── Parameter control (UI Thread → AudioThreadSafeQueue) ─────────────
    void setMasterGain(float gain);    // 0.0 – 1.0
    void setTempo(float bpm);          // 20.0 – 300.0

    // ── Device / Session events (UI Thread) ──────────────────────────────
    void onDeviceChange();
    void onAudioFocusGained();
    void onAudioFocusLost(bool transient);

    // ── Diagnostics (UI Thread) ───────────────────────────────────────────
    double estimatedLatencyMs() const noexcept;
    std::string diagnosticStatusLine();
    DiagnosticReport collectDiagnostics();

    // ── Graph access (UI Thread, before stream start) ─────────────────────
    AudioGraphManager& graph() { return *mGraph; }

    // ── Oboe callbacks (Audio Thread) ─────────────────────────────────────
    oboe::DataCallbackResult onAudioReady(
        oboe::AudioStream* stream,
        void*              audioData,
        int32_t            numFrames) override;

    void onErrorAfterClose(
        oboe::AudioStream* stream,
        oboe::Result       result) override;

private:
    bool openStream();
    void closeStream();
    void restartIfNeeded();  // called from UI thread via poll
    void drainCommandQueue() noexcept;  // Audio Thread — processes pending commands

    // Platform subsystems
    AudioDeviceManager              mDeviceMgr;
    AudioSessionManager             mSessionMgr;
    PerformanceMonitor              mPerfMon;
    std::unique_ptr<Diagnostics>    mDiagnostics;
    std::unique_ptr<AudioGraphManager> mGraph;

    // Oboe stream
    std::shared_ptr<oboe::AudioStream> mStream;

    // Audio-thread state (atomics only)
    std::atomic<float>   mMasterGain{1.0f};
    std::atomic<float>   mTempo{120.0f};
    std::atomic<bool>    mRestartRequested{false};

    // Lock-free command queue: UI/Worker → Audio Thread
    AudioThreadSafeQueue<AudioCommand, 256> mCommandQueue;

    // Stream config (set at open, read-only during callback)
    int32_t mSampleRate{48000};
    int32_t mFramesPerCallback{96};
    int32_t mChannelCount{2};
};

} // namespace vibecore
