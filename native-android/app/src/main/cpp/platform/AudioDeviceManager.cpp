#include "AudioDeviceManager.h"
#include "VibeCoreLog.h"
#include "../threads/ThreadModel.h"
#include <oboe/Oboe.h>

namespace vibecore {

AudioDeviceManager::AudioDeviceManager() {
    // Set safe defaults; real values filled after queryCapabilities()
    mCapabilities.sampleRate        = 48000;
    mCapabilities.burstFrames       = 96;
    mCapabilities.supportsAAudio    = oboe::AudioStreamBuilder::isAAudioRecommended();
    mCapabilities.supportsExclusive = false;
    mCapabilities.supportsADPF      = false; // set by engine after ADPF probe
}

DeviceCapabilities AudioDeviceManager::queryCapabilities() {
    VIBECORE_ASSERT_NOT_AUDIO_THREAD();

    mCapabilities.sampleRate     = getOptimalSampleRate();
    mCapabilities.burstFrames    = getOptimalBurstSize();
    mCapabilities.supportsAAudio = oboe::AudioStreamBuilder::isAAudioRecommended();

    // Probe exclusive mode by attempting to open a test stream
    oboe::AudioStreamBuilder builder;
    // Oboe-Builder-Setter geben AudioStreamBuilder* zurück → Pointer-Chaining.
    builder.setDirection(oboe::Direction::Output)
           ->setPerformanceMode(oboe::PerformanceMode::LowLatency)
           ->setSharingMode(oboe::SharingMode::Exclusive)
           ->setFormat(oboe::AudioFormat::Float)
           ->setChannelCount(oboe::ChannelCount::Stereo)
           ->setSampleRate(mCapabilities.sampleRate);

    std::shared_ptr<oboe::AudioStream> testStream;
    oboe::Result result = builder.openStream(testStream);
    if (result == oboe::Result::OK) {
        mCapabilities.supportsExclusive =
            (testStream->getSharingMode() == oboe::SharingMode::Exclusive);
        testStream->close();
    } else {
        mCapabilities.supportsExclusive = false;
    }

    mCapabilitiesQueried = true;

    VLOG_I("Device capabilities: sampleRate=%d burst=%d AAudio=%s Exclusive=%s",
           mCapabilities.sampleRate,
           mCapabilities.burstFrames,
           mCapabilities.supportsAAudio  ? "yes" : "no",
           mCapabilities.supportsExclusive ? "yes" : "no");

    return mCapabilities;
}

int32_t AudioDeviceManager::getOptimalBurstSize() {
    // Oboe's recommended approach: open a low-latency stream and read burst
    oboe::DefaultStreamValues::FramesPerBurst =
        oboe::DefaultStreamValues::FramesPerBurst; // triggers lazy init

    int32_t burst = oboe::DefaultStreamValues::FramesPerBurst;
    if (burst <= 0) burst = 96; // safe fallback
    VLOG_D("Optimal burst size: %d frames", burst);
    return burst;
}

int32_t AudioDeviceManager::getOptimalSampleRate() {
    int32_t sr = oboe::DefaultStreamValues::SampleRate;
    if (sr <= 0) sr = 48000;
    VLOG_D("Optimal sample rate: %d Hz", sr);
    return sr;
}

void AudioDeviceManager::setDeviceChangeCallback(DeviceChangeCallback cb) {
    mChangeCallback = std::move(cb);
}

void AudioDeviceManager::onDeviceChange() {
    VIBECORE_ASSERT_NOT_AUDIO_THREAD();
    VLOG_I("Audio device change detected — re-querying capabilities");
    queryCapabilities();
    if (mChangeCallback) {
        mChangeCallback(mCapabilities);
    }
}

} // namespace vibecore
