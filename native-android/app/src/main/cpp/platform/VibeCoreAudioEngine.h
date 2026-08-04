#pragma once
/**
 * VibeCoreAudioEngine.h — The single Oboe audio engine for VibeCore Univers.
 *
 * Architecture (Phase 2 — Sync integrated):
 *   VibeCoreAudioEngine
 *     ├── AudioDeviceManager    (device query + hotplug)
 *     ├── AudioSessionManager   (focus + lifecycle state machine)
 *     ├── PerformanceMonitor    (latency + CPU tracking)
 *     ├── Diagnostics           (UI-readable status)
 *     ├── VibeCoreSync          (ONE global clock — PPQ 1920)
 *     └── AudioGraphManager     (node topology + render dispatch)
 *
 * Audio callback order (Audio Thread):
 *   1. drainCommandQueue()        — apply parameter changes
 *   2. sync.processCallback()     — generate TickEventBuffer
 *   3. graph.dispatchSyncEvents() — route events to all AudioNodes
 *   4. graph.process()            — render audio
 *   5. perfMon.onCallbackEnd()    — measure duration
 *
 * Thread model unchanged from Phase 1 (see ADR-002).
 * SyncCommand queue: UI → VibeCoreSync → Audio Thread.
 */

#include <oboe/Oboe.h>
#include <atomic>
#include <memory>

#include "AudioDeviceManager.h"
#include "AudioSessionManager.h"
#include "PerformanceMonitor.h"
#include "Diagnostics.h"
#include "sync/VibeCoreSync.h"
#include "../graph/AudioGraphManager.h"
#include "../threads/AudioThreadSafeQueue.h"

namespace vibecore {

// Engine-level commands (master gain, etc.)
// Sync commands go directly to VibeCoreSync via its own queue.
struct AudioCommand {
    enum class Type : uint8_t {
        SetMasterGain = 0,
        // Phase 3+: SetNodeParam, ...
    };
    Type  type;
    float value;
};
static_assert(std::is_trivially_copyable<AudioCommand>::value, "");

class VibeCoreAudioEngine : public oboe::AudioStreamDataCallback,
                            public oboe::AudioStreamErrorCallback {
public:
    VibeCoreAudioEngine();
    ~VibeCoreAudioEngine() override;

    VibeCoreAudioEngine(const VibeCoreAudioEngine&)            = delete;
    VibeCoreAudioEngine& operator=(const VibeCoreAudioEngine&) = delete;

    // ── Lifecycle (UI Thread) ─────────────────────────────────────────────
    bool start();
    void stop();
    bool isRunning() const noexcept;

    // ── Transport (UI Thread → VibeCoreSync command queue) ────────────────
    void transportPlay();
    void transportStop();
    bool transportIsPlaying() const noexcept;

    // ── Tempo / Time Signature (UI Thread) ────────────────────────────────
    void setTempo(double bpm);
    void setTimeSignature(int32_t numerator, int32_t denominator);

    // ── Loop (UI Thread) ──────────────────────────────────────────────────
    void setLoopEnabled(bool enabled);
    void setLoopPoints(int64_t startTick, int64_t endTick);

    // ── Playhead (UI Thread) ──────────────────────────────────────────────
    void setPosition(int64_t absoluteTick);
    int64_t currentTick() const noexcept;
    MusicalPosition currentPosition() const noexcept;
    double currentBpm() const noexcept;

    // ── Engine parameters (UI Thread → engine command queue) ──────────────
    void setMasterGain(float gain);

    // ── Device / Session events (UI Thread) ───────────────────────────────
    void onDeviceChange();
    void onAudioFocusGained();
    void onAudioFocusLost(bool transient);

    // ── Diagnostics (UI Thread) ───────────────────────────────────────────
    double estimatedLatencyMs() const noexcept;
    std::string diagnosticStatusLine();
    DiagnosticReport collectDiagnostics();

    // ── Graph access (UI Thread, before stream start) ─────────────────────
    AudioGraphManager& graph() { return *mGraph; }
    VibeCoreSync&      sync()  { return *mSync;  }

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
    void drainCommandQueue() noexcept;

    // Platform subsystems
    AudioDeviceManager               mDeviceMgr;
    AudioSessionManager              mSessionMgr;
    PerformanceMonitor               mPerfMon;
    std::unique_ptr<Diagnostics>     mDiagnostics;
    std::unique_ptr<VibeCoreSync>    mSync;
    std::unique_ptr<AudioGraphManager> mGraph;

    // Oboe stream
    std::shared_ptr<oboe::AudioStream> mStream;

    // Engine-level audio-thread state
    std::atomic<float>   mMasterGain{1.0f};
    std::atomic<bool>    mRestartRequested{false};

    // Engine command queue (UI → Audio Thread)
    AudioThreadSafeQueue<AudioCommand, 128> mCommandQueue;

    // Absolute sample counter (Audio Thread only — no atomic needed)
    int64_t mAbsoluteSamplePos{0};

    // Stream config (set at open, read-only during callback)
    int32_t mSampleRate{48000};
    int32_t mFramesPerCallback{96};
    int32_t mChannelCount{2};
};

} // namespace vibecore
