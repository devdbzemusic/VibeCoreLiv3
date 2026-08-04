#include "VoiceInput.h"
#include "../platform/VibeCoreLog.h"
#include <thread>
#include <chrono>

namespace vibecore {

bool VoiceInput::open(int sampleRate, int framesPerCallback) noexcept {
    if (mStream) return true;

    oboe::AudioStreamBuilder builder;
    builder.setDirection(oboe::Direction::Input)
           ->setPerformanceMode(oboe::PerformanceMode::LowLatency)
           ->setSharingMode(oboe::SharingMode::Exclusive)
           ->setFormat(oboe::AudioFormat::Float)
           ->setChannelCount(1)
           ->setSampleRate(sampleRate)
           ->setSampleRateConversionQuality(oboe::SampleRateConversionQuality::Medium)
           ->setFramesPerDataCallback(framesPerCallback);
    // NO data callback — non-blocking pull from the output callback.

    const oboe::Result res = builder.openStream(mStream);
    if (res != oboe::Result::OK) {
        VLOG_E("VoiceInput: open failed: %s", oboe::convertToText(res));
        mStream.reset();
        return false;
    }

    mChannels = mStream->getChannelCount();
    const oboe::Result start = mStream->requestStart();
    if (start != oboe::Result::OK) {
        VLOG_E("VoiceInput: start failed: %s", oboe::convertToText(start));
        mStream->close();
        mStream.reset();
        return false;
    }

    VLOG_I("VoiceInput: opened sr=%d ch=%d burst=%d",
           mStream->getSampleRate(), mChannels,
           mStream->getFramesPerBurst());
    return true;
}

void VoiceInput::close() noexcept {
    if (!mStream) return;

    // 1. Gate off — after this, the Audio Thread will not START a new read.
    mActive.store(false, std::memory_order_release);

    // 2. Wait (UI thread, bounded) until any in-flight read has finished.
    //    A read is at most one burst (~2 ms); 100 ms is a generous ceiling.
    for (int i = 0; i < 1000 && mReading.load(std::memory_order_acquire); ++i) {
        std::this_thread::sleep_for(std::chrono::microseconds(100));
    }

    mStream->requestStop();
    mStream->close();
    mStream.reset();
    VLOG_I("VoiceInput: closed");
}

int VoiceInput::readNonBlocking(float* dst, int numFrames) noexcept {
    // Publish "reading" FIRST, then check the gate — close() clears the gate
    // and then waits for mReading == false, so this ordering guarantees the
    // stream cannot be destroyed under us.
    mReading.store(true, std::memory_order_seq_cst);
    if (!mActive.load(std::memory_order_seq_cst) || !mStream) {
        mReading.store(false, std::memory_order_release);
        for (int i = 0; i < numFrames; ++i) dst[i] = 0.0f;
        return 0;
    }

    // Mono stream — direct read, timeout 0 (never blocks the audio thread)
    const auto result = mStream->read(dst, numFrames, 0 /* timeoutNs */);
    int read = result ? result.value() : 0;
    mReading.store(false, std::memory_order_release);
    if (read < 0) read = 0;
    for (int i = read; i < numFrames; ++i) dst[i] = 0.0f;
    return read;
}

} // namespace vibecore
