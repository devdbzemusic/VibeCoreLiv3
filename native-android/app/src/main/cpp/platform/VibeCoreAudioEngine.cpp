#include "VibeCoreAudioEngine.h"
#include "VibeCoreLog.h"
#include "../graph/MixerNode.h"
#include "../threads/ThreadModel.h"
#include <cstring>

namespace vibecore {

// ─── Construction ─────────────────────────────────────────────────────────────

VibeCoreAudioEngine::VibeCoreAudioEngine() {
    // Subsystems constructed with default sample rate; real value set in start()
    mSync        = std::make_unique<VibeCoreSync>(48000);
    mDiagnostics = std::make_unique<Diagnostics>(mPerfMon, mDeviceMgr, mSessionMgr);
    mGraph       = std::make_unique<AudioGraphManager>();

    mDeviceMgr.setDeviceChangeCallback([this](const DeviceCapabilities&) {
        if (isRunning()) {
            mRestartRequested.store(true, std::memory_order_release);
        }
    });

    mSessionMgr.setStateCallback([this](SessionState, SessionState next) {
        if (next == SessionState::Error) {
            mRestartRequested.store(true, std::memory_order_release);
        }
    });

    VLOG_PHASE("INIT", "VibeCoreAudioEngine constructed (Phase 2 — Sync)");
}

VibeCoreAudioEngine::~VibeCoreAudioEngine() {
    stop();
    VLOG_PHASE("SHUTDOWN", "VibeCoreAudioEngine destroyed");
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

bool VibeCoreAudioEngine::start() {
    VIBECORE_ASSERT_NOT_AUDIO_THREAD();
    if (isRunning()) return true;

    VLOG_PHASE("START", "Starting VibeCoreAudioEngine");

    const auto caps    = mDeviceMgr.queryCapabilities();
    mSampleRate        = caps.sampleRate;
    mFramesPerCallback = caps.burstFrames;
    mChannelCount      = 2;
    mAbsoluteSamplePos = 0;

    // Re-create sync with the real sample rate
    mSync = std::make_unique<VibeCoreSync>(mSampleRate);

    mPerfMon.prepare(mSampleRate, mFramesPerCallback);
    mGraph->prepare(mSampleRate, mFramesPerCallback);

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
    mSync->stop();
    closeStream();
    mGraph->reset();
    mPerfMon.reset();
    mSessionMgr.onStreamStopped();
}

bool VibeCoreAudioEngine::isRunning() const noexcept {
    return mSessionMgr.isRunning();
}

// ─── Transport ────────────────────────────────────────────────────────────────

void VibeCoreAudioEngine::transportPlay()  { mSync->play(); }
void VibeCoreAudioEngine::transportStop()  { mSync->stop(); }
bool VibeCoreAudioEngine::transportIsPlaying() const noexcept { return mSync->isPlaying(); }

// ─── Tempo / Time Signature ───────────────────────────────────────────────────

void VibeCoreAudioEngine::setTempo(double bpm) { mSync->setTempo(bpm); }
void VibeCoreAudioEngine::setTimeSignature(int32_t n, int32_t d) { mSync->setTimeSignature(n, d); }

// ─── Loop ─────────────────────────────────────────────────────────────────────

void VibeCoreAudioEngine::setLoopEnabled(bool e) { mSync->setLoopEnabled(e); }
void VibeCoreAudioEngine::setLoopPoints(int64_t s, int64_t e) { mSync->setLoopPoints(s, e); }

// ─── Playhead ─────────────────────────────────────────────────────────────────

void VibeCoreAudioEngine::setPosition(int64_t t)      { mSync->setPosition(t); }
int64_t VibeCoreAudioEngine::currentTick() const noexcept { return mSync->currentTick(); }
MusicalPosition VibeCoreAudioEngine::currentPosition() const noexcept { return mSync->currentPosition(); }
double VibeCoreAudioEngine::currentBpm() const noexcept { return mSync->currentBpm(); }

// ─── Parameters ───────────────────────────────────────────────────────────────

void VibeCoreAudioEngine::setMasterGain(float gain) {
    mCommandQueue.push({ AudioCommand::Type::SetMasterGain, gain });
}

// ─── Device / Session ─────────────────────────────────────────────────────────

void VibeCoreAudioEngine::onDeviceChange()                { mDeviceMgr.onDeviceChange(); }
void VibeCoreAudioEngine::onAudioFocusGained()            { mSessionMgr.onAudioFocusGained(); }
void VibeCoreAudioEngine::onAudioFocusLost(bool t)        { mSessionMgr.onAudioFocusLost(t); }

// ─── Diagnostics ─────────────────────────────────────────────────────────────

double VibeCoreAudioEngine::estimatedLatencyMs() const noexcept {
    return mPerfMon.getStats().estimatedLatencyMs;
}
std::string VibeCoreAudioEngine::diagnosticStatusLine() { return mDiagnostics->statusLine(); }
DiagnosticReport VibeCoreAudioEngine::collectDiagnostics() { return mDiagnostics->collect(); }

// ─── Oboe callback — AUDIO THREAD ────────────────────────────────────────────

oboe::DataCallbackResult VibeCoreAudioEngine::onAudioReady(
        oboe::AudioStream* /*stream*/,
        void*              audioData,
        int32_t            numFrames) {

    mPerfMon.onCallbackStart();

    // ── Step 1: Engine parameter changes ─────────────────────────────────
    drainCommandQueue();

    // ── Step 2: Advance sync clock → get this callback's timing events ───
    const TickEventBuffer& events =
        mSync->processCallback(mAbsoluteSamplePos, numFrames);

    // ── Step 3: Dispatch sync events to all AudioNodes ────────────────────
    mGraph->dispatchSyncEvents(events);

    // ── Step 4: Render audio graph ────────────────────────────────────────
    float* outputBuffer = static_cast<float*>(audioData);
    mGraph->process(outputBuffer, numFrames, mChannelCount);

    // ── Step 5: Apply master gain ─────────────────────────────────────────
    const float gain    = mMasterGain.load(std::memory_order_relaxed);
    const int   samples = numFrames * mChannelCount;
    if (gain != 1.0f) {
        for (int i = 0; i < samples; ++i) outputBuffer[i] *= gain;
    }

    // ── Step 6: Update latency estimate ───────────────────────────────────
    if (mStream) {
        // Oboe 1.9 ResultWithValue hat kein isOk(); Prüfung via error().
        auto ts = mStream->calculateLatencyMillis();
        if (ts.error() == oboe::Result::OK) mPerfMon.setEstimatedLatencyMs(ts.value());
    }

    mAbsoluteSamplePos += numFrames;
    mPerfMon.onCallbackEnd();

    return oboe::DataCallbackResult::Continue;
}

void VibeCoreAudioEngine::onErrorAfterClose(oboe::AudioStream*, oboe::Result result) {
    VLOG_AUDIO_E("Stream error: %s", oboe::convertToText(result));
    mRestartRequested.store(true, std::memory_order_release);
}

// ─── Private ─────────────────────────────────────────────────────────────────

bool VibeCoreAudioEngine::openStream() {
    const auto& caps = mDeviceMgr.capabilities();
    oboe::AudioStreamBuilder builder;
    // Oboe-Builder-Setter geben AudioStreamBuilder* zurück → Pointer-Chaining.
    builder.setDirection(oboe::Direction::Output)
           ->setPerformanceMode(oboe::PerformanceMode::LowLatency)
           ->setSharingMode(caps.supportsExclusive
               ? oboe::SharingMode::Exclusive : oboe::SharingMode::Shared)
           ->setFormat(oboe::AudioFormat::Float)
           ->setChannelCount(oboe::ChannelCount::Stereo)
           ->setSampleRate(mSampleRate)
           ->setFramesPerDataCallback(mFramesPerCallback)
           ->setDataCallback(this)
           ->setErrorCallback(this);

    oboe::Result r = builder.openStream(mStream);
    if (r != oboe::Result::OK) {
        VLOG_E("openStream failed: %s", oboe::convertToText(r));
        return false;
    }
    r = mStream->requestStart();
    if (r != oboe::Result::OK) {
        VLOG_E("requestStart failed: %s", oboe::convertToText(r));
        mStream->close(); mStream.reset();
        return false;
    }
    VLOG_I("Stream: %d Hz | %d fr | %s | %s",
           mStream->getSampleRate(), mStream->getFramesPerBurst(),
           mStream->getAudioApi() == oboe::AudioApi::AAudio ? "AAudio" : "OpenSL",
           mStream->getSharingMode() == oboe::SharingMode::Exclusive ? "Excl" : "Shared");
    return true;
}

void VibeCoreAudioEngine::closeStream() {
    if (mStream) { mStream->requestStop(); mStream->close(); mStream.reset(); }
}

void VibeCoreAudioEngine::drainCommandQueue() noexcept {
    AudioCommand cmd;
    while (mCommandQueue.pop(cmd)) {
        switch (cmd.type) {
            case AudioCommand::Type::SetMasterGain:
                mMasterGain.store(cmd.value, std::memory_order_relaxed);
                break;
        }
    }
}

} // namespace vibecore
