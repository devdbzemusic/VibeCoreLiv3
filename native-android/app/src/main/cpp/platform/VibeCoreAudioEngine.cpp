#include "VibeCoreAudioEngine.h"
#include "VibeCoreLog.h"
#include "../graph/MixerNode.h"
#include <cstring>

namespace vibecore {

// ─── Construction ────────────────────────────────────────────────────────────

VibeCoreAudioEngine::VibeCoreAudioEngine() {
    mDiagnostics = std::make_unique<Diagnostics>(mPerfMon, mDeviceMgr, mSessionMgr);
    mGraph       = std::make_unique<AudioGraphManager>();

    // Register device change callback
    mDeviceMgr.setDeviceChangeCallback([this](const DeviceCapabilities&) {
        // Device changed while running → request restart
        if (isRunning()) {
            VLOG_W("Device changed while running — requesting stream restart");
            mRestartRequested.store(true, std::memory_order_release);
        }
    });

    // Register session state callback
    mSessionMgr.setStateCallback([this](SessionState prev, SessionState next) {
        if (next == SessionState::Error) {
            VLOG_E("Session entered Error state — requesting restart");
            mRestartRequested.store(true, std::memory_order_release);
        }
    });

    VLOG_PHASE("INIT", "VibeCoreAudioEngine constructed");
}

VibeCoreAudioEngine::~VibeCoreAudioEngine() {
    stop();
    VLOG_PHASE("SHUTDOWN", "VibeCoreAudioEngine destroyed");
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

bool VibeCoreAudioEngine::start() {
    VIBECORE_ASSERT_NOT_AUDIO_THREAD();

    if (isRunning()) {
        VLOG_W("start() called while already running — ignoring");
        return true;
    }

    VLOG_PHASE("START", "Starting VibeCoreAudioEngine");

    // 1. Query device capabilities
    const auto caps = mDeviceMgr.queryCapabilities();
    mSampleRate         = caps.sampleRate;
    mFramesPerCallback  = caps.burstFrames;
    mChannelCount       = 2;

    // 2. Prepare performance monitor
    mPerfMon.prepare(mSampleRate, mFramesPerCallback);

    // 3. Prepare graph (Phase 1: empty graph, outputs silence)
    mGraph->prepare(mSampleRate, mFramesPerCallback);

    // 4. Open and start the Oboe stream
    if (!openStream()) {
        mSessionMgr.onStreamError("Failed to open audio stream");
        return false;
    }

    mRestartRequested.store(false, std::memory_order_release);
    mSessionMgr.onStreamStarted();
    VLOG_PHASE("START", "Engine running: %d Hz / %d frames / %d ch",
               mSampleRate, mFramesPerCallback, mChannelCount);
    return true;
}

void VibeCoreAudioEngine::stop() {
    VIBECORE_ASSERT_NOT_AUDIO_THREAD();
    if (!isRunning()) return;

    VLOG_PHASE("STOP", "Stopping VibeCoreAudioEngine");
    closeStream();
    mGraph->reset();
    mPerfMon.reset();
    mSessionMgr.onStreamStopped();
}

bool VibeCoreAudioEngine::isRunning() const noexcept {
    return mSessionMgr.isRunning();
}

// ─── Parameter control ────────────────────────────────────────────────────────

void VibeCoreAudioEngine::setMasterGain(float gain) {
    mCommandQueue.push({AudioCommand::Type::SetMasterGain, gain});
}

void VibeCoreAudioEngine::setTempo(float bpm) {
    mCommandQueue.push({AudioCommand::Type::SetTempo, bpm});
}

// ─── Device / session events ─────────────────────────────────────────────────

void VibeCoreAudioEngine::onDeviceChange() {
    mDeviceMgr.onDeviceChange();
    // Device manager's callback will set mRestartRequested if needed
}

void VibeCoreAudioEngine::onAudioFocusGained() {
    mSessionMgr.onAudioFocusGained();
}

void VibeCoreAudioEngine::onAudioFocusLost(bool transient) {
    mSessionMgr.onAudioFocusLost(transient);
}

// ─── Diagnostics ─────────────────────────────────────────────────────────────

double VibeCoreAudioEngine::estimatedLatencyMs() const noexcept {
    return mPerfMon.getStats().estimatedLatencyMs;
}

std::string VibeCoreAudioEngine::diagnosticStatusLine() {
    return mDiagnostics->statusLine();
}

DiagnosticReport VibeCoreAudioEngine::collectDiagnostics() {
    return mDiagnostics->collect();
}

// ─── Oboe callback — AUDIO THREAD ────────────────────────────────────────────

oboe::DataCallbackResult VibeCoreAudioEngine::onAudioReady(
        oboe::AudioStream* /*stream*/,
        void*              audioData,
        int32_t            numFrames) {

    mPerfMon.onCallbackStart();

    // 1. Drain command queue (UI → Audio parameter changes)
    drainCommandQueue();

    // 2. Dispatch graph (Phase 1: outputs silence)
    mGraph->process(
        static_cast<float*>(audioData),
        numFrames,
        mChannelCount);

    // 3. Update latency estimate
    if (mStream) {
        auto timestampResult = mStream->calculateLatencyMillis();
        if (timestampResult.isOk()) {
            mPerfMon.setEstimatedLatencyMs(timestampResult.value());
        }
    }

    mPerfMon.onCallbackEnd();

    return oboe::DataCallbackResult::Continue;
}

void VibeCoreAudioEngine::onErrorAfterClose(oboe::AudioStream* /*stream*/,
                                             oboe::Result result) {
    VLOG_AUDIO_E("Stream error after close: %s", oboe::convertToText(result));
    mRestartRequested.store(true, std::memory_order_release);
    // NOTE: Do not call mSessionMgr here (audio thread / error thread)
    // UI thread polls mRestartRequested and calls restartIfNeeded()
}

// ─── Private helpers ─────────────────────────────────────────────────────────

bool VibeCoreAudioEngine::openStream() {
    const auto& caps = mDeviceMgr.capabilities();

    oboe::AudioStreamBuilder builder;
    builder.setDirection(oboe::Direction::Output)
           .setPerformanceMode(oboe::PerformanceMode::LowLatency)
           .setSharingMode(caps.supportsExclusive
               ? oboe::SharingMode::Exclusive
               : oboe::SharingMode::Shared)
           .setFormat(oboe::AudioFormat::Float)
           .setChannelCount(oboe::ChannelCount::Stereo)
           .setSampleRate(mSampleRate)
           .setFramesPerDataCallback(mFramesPerCallback)
           .setDataCallback(this)
           .setErrorCallback(this);

    oboe::Result result = builder.openStream(mStream);

    if (result != oboe::Result::OK) {
        VLOG_E("Failed to open stream: %s", oboe::convertToText(result));
        return false;
    }

    // Log actual stream properties (may differ from requested)
    VLOG_I("Stream opened: %d Hz | %d frames | %s | %s",
           mStream->getSampleRate(),
           mStream->getFramesPerBurst(),
           mStream->getAudioApi() == oboe::AudioApi::AAudio ? "AAudio" : "OpenSL ES",
           mStream->getSharingMode() == oboe::SharingMode::Exclusive ? "Exclusive" : "Shared");

    result = mStream->requestStart();
    if (result != oboe::Result::OK) {
        VLOG_E("Failed to start stream: %s", oboe::convertToText(result));
        mStream->close();
        mStream.reset();
        return false;
    }

    return true;
}

void VibeCoreAudioEngine::closeStream() {
    if (mStream) {
        mStream->requestStop();
        mStream->close();
        mStream.reset();
    }
}

void VibeCoreAudioEngine::restartIfNeeded() {
    VIBECORE_ASSERT_NOT_AUDIO_THREAD();
    if (!mRestartRequested.load(std::memory_order_acquire)) return;
    VLOG_I("Restarting stream after error/device change");
    stop();
    start();
}

void VibeCoreAudioEngine::drainCommandQueue() noexcept {
    AudioCommand cmd;
    while (mCommandQueue.pop(cmd)) {
        switch (cmd.type) {
            case AudioCommand::Type::SetMasterGain:
                mMasterGain.store(cmd.value, std::memory_order_relaxed);
                break;
            case AudioCommand::Type::SetTempo:
                mTempo.store(cmd.value, std::memory_order_relaxed);
                break;
        }
    }
}

} // namespace vibecore
