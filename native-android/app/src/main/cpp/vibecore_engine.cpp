// VibeCore — Oboe realtime engine implementation.
#include "vibecore_engine.h"

#include <android/log.h>
#include <cmath>
#include <cstring>
#include <unistd.h>

#define TAG "VibeCore"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO,  TAG, __VA_ARGS__)
#define LOGW(...) __android_log_print(ANDROID_LOG_WARN,   TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR,  TAG, __VA_ARGS__)

namespace vibecore {

AudioEngine::AudioEngine() = default;

AudioEngine::~AudioEngine() { stop(); }

int AudioEngine::start() {
    if (mStream && mStream->getState() == oboe::StreamState::Started) return 0;
    oboe::AudioStreamBuilder builder;
    builder.setPerformanceMode(oboe::PerformanceMode::LowLatency)
           .setSharingMode(oboe::SharingMode::Exclusive)
           .setFormat(oboe::AudioFormat::Float)
           .setChannelCount(oboe::ChannelCount::Stereo)
           .setSampleRate(mSampleRate)
           .setDataCallback(this)
           .setErrorCallback(this);

    auto result = builder.openStream(mStream);
    if (result != oboe::Result::OK) {
        LOGW("Exclusive stream failed (%s), retrying with Shared", convertToText(result));
        builder.setSharingMode(oboe::SharingMode::Shared);
        result = builder.openStream(mStream);
        if (result != oboe::Result::OK) {
            LOGE("Failed to open stream: %s", convertToText(result));
            return -1;
        }
    }

    mSampleRate   = mStream->getSampleRate();
    mChannelCount = mStream->getChannelCount();

    // Puffer auf 1 Burst setzen → niedrigste Latenz (SynthMark: 96 Frames = 2 ms).
    int32_t burst = mStream->getFramesPerBurst();
    mStream->setBufferSizeInFrames(burst);
    LOGI("Buffer = 1 burst (%d frames, %.2f ms @ %d Hz)",
         burst, 1000.0f * burst / mSampleRate, mSampleRate);

    result = mStream->requestStart();
    if (result != oboe::Result::OK) {
        LOGE("requestStart failed: %s", convertToText(result));
        return -1;
    }
    LOGI("Oboe stream started: %d Hz, %d ch, %s",
         mSampleRate, mChannelCount,
         mStream->getSharingMode() == oboe::SharingMode::Exclusive ? "Exclusive" : "Shared");
    return 0;
}

void AudioEngine::stop() {
#if defined(__ANDROID_API__) && __ANDROID_API__ >= 31
    if (mHintSession) { APerformanceHint_closeSession(mHintSession); mHintSession = nullptr; }
#endif
    mAffinitySet = false;
    if (mStream) {
        mStream->stop();
        mStream->close();
        mStream.reset();
    }
    for (auto& v : mVoices) v.active = false;
}

int AudioEngine::reopen() {
    stop();
    return start();
}

void AudioEngine::setTempo(double bpm)  { mTempo.store(bpm < 1.0 ? 1.0 : bpm); }
void AudioEngine::setMasterGain(float g) { mMasterGain.store(g < 0.0f ? 0.0f : (g > 2.0f ? 2.0f : g)); }

int AudioEngine::configure(int framesPerBurst, int bigCpuIndex, bool enableAdpf) {
    if (framesPerBurst > 0) mFramesPerBurst = framesPerBurst;
    mBigCpuIndex = bigCpuIndex;
    mAdpf = enableAdpf;
    LOGI("configure: burst=%d bigCpu=%d adpf=%d", mFramesPerBurst, mBigCpuIndex, mAdpf ? 1 : 0);
    return 0;
}

int AudioEngine::loadSample(int slot, const float* data, int frames, int channels, int sampleRate) {
    if (slot < 0 || slot >= kMaxSampleSlots || !data || frames <= 0 || channels < 1 || channels > 2)
        return -1;
    SampleBuffer& sb = mSamples[slot];
    sb.channels = channels;
    sb.sampleRate = sampleRate;
    sb.data.assign(data, data + (size_t)frames * channels);
    return 0;
}

void AudioEngine::trigger(int slot, float semitones, float velocity, bool loop) {
    if (slot < 0 || slot >= kMaxSampleSlots) return;
    const SampleBuffer* sb = &mSamples[slot];
    if (sb->data.empty()) return;

    // Freie Stimme suchen.
    Voice* target = nullptr;
    for (auto& v : mVoices) {
        if (!v.active) { target = &v; break; }
    }
    if (!target) target = &mVoices[0]; // Overflow: älteste überschreiben.

    // Pitch-Ratio inkl. Sample-Rate-Konvertierung zum Stream.
    double srRatio = (double)mSampleRate / (double)sb->sampleRate;
    double pitchRatio = srRatio * std::pow(2.0, (double)semitones / 12.0);

    target->sample = sb;
    target->playPos = 0.0;
    target->pitchRatio = pitchRatio;
    target->gain = (velocity < 0.0f ? 0.0f : (velocity > 1.0f ? 1.0f : velocity));
    target->loop = loop;
    target->active = true;
}

int AudioEngine::getOutputLatencyMs() const {
    if (!mStream) return -1;
    auto r = mStream->getTimestamp();
    if (r) {
        // Geschätzte Ausgabelatenz aus Puffergröße + Frame-Position.
        int32_t burst = mStream->getFramesPerBurst();
        int32_t buf = mStream->getBufferSizeInFrames();
        double ms = 1000.0 * (buf + burst) / (double)mStream->getSampleRate();
        return (int)ms;
    }
    // Fallback: Pufferdauer.
    return (int)(1000.0 * mStream->getBufferSizeInFrames() / (double)mStream->getSampleRate());
}

// Lindear-interpoliertes Mixen einer Stimme in den Ausgabepuffer.
void AudioEngine::mixVoice(Voice& v, float* out, int32_t frames, int outChannels) {
    const SampleBuffer* sb = v.sample;
    if (!sb || sb->data.empty()) { v.active = false; return; }

    const int srcCh = sb->channels;
    const double srcFrames = (double)(sb->data.size() / srcCh);
    const float* src = sb->data.data();
    const double ratio = v.pitchRatio;

    for (int32_t i = 0; i < frames; i++) {
        if (!v.active) return;
        double pos = v.playPos;
        if (pos >= srcFrames - 1.0) {
            if (v.loop) {
                v.playPos = std::fmod(pos, srcFrames);
                pos = v.playPos;
            } else {
                v.active = false;
                return;
            }
        }
        int i0 = (int)pos;
        int i1 = std::min(i0 + 1, (int)srcFrames - 1);
        double frac = pos - (double)i0;

        float l = (float)((1.0 - frac) * src[i0 * srcCh] + frac * src[i1 * srcCh]);
        float r = (srcCh > 1)
            ? (float)((1.0 - frac) * src[i0 * srcCh + 1] + frac * src[i1 * srcCh + 1])
            : l;

        l *= v.gain;
        r *= v.gain;

        if (outChannels == 2) {
            out[i * 2]     += l;
            out[i * 2 + 1] += r;
        } else {
            out[i] += (l + r) * 0.5f;
        }
        v.playPos += ratio;
    }
}

oboe::DataCallbackResult AudioEngine::onAudioReady(oboe::AudioStream* /*stream*/,
                                                    void* audioData,
                                                    int32_t numFrames) {
    // Erster Callback auf dem Audio-Thread: Big-Core-Affinität + ADPF-Session.
    if (!mAffinitySet) {
        cpu_set_t mask; CPU_ZERO(&mask);
        if (mBigCpuIndex >= 0 && mBigCpuIndex < CPU_SETSIZE) CPU_SET(mBigCpuIndex, &mask);
        if (mBigCpuIndex + 1 >= 0 && mBigCpuIndex + 1 < CPU_SETSIZE) CPU_SET(mBigCpuIndex + 1, &mask);
        sched_setaffinity(0, sizeof(mask), &mask);
        mAffinitySet = true;
#if defined(__ANDROID_API__) && __ANDROID_API__ >= 31
        if (mAdpf && !mHintSession && mStream) {
            int32_t tid = (int32_t)gettid();
            int32_t burst = mStream->getFramesPerBurst();
            int64_t sr = (int64_t)mStream->getSampleRate();
            mHintTargetNs = (int64_t)burst * 1000000000LL / sr;
            APerformanceHintManager* mgr = APerformanceHint_getManager();
            if (mgr) mHintSession = APerformanceHint_createSession(mgr, &tid, 1, mHintTargetNs);
            LOGI("Audio thread pinned to big cores (CPU #%d/#%d), ADPF %s",
                 mBigCpuIndex, mBigCpuIndex + 1, mHintSession ? "on" : "off");
        }
#endif
    }

    auto t0 = std::chrono::steady_clock::now();

    float* out = static_cast<float*>(audioData);
    std::memset(out, 0, sizeof(float) * (size_t)numFrames * mChannelCount);

    for (auto& v : mVoices) {
        if (v.active) mixVoice(v, out, numFrames, mChannelCount);
    }

    float master = mMasterGain.load();
    for (int32_t i = 0; i < numFrames * mChannelCount; i++) out[i] *= master;

    auto t1 = std::chrono::steady_clock::now();
    int64_t workNs = std::chrono::duration_cast<std::chrono::nanoseconds>(t1 - t0).count();
#if defined(__ANDROID_API__) && __ANDROID_API__ >= 31
    if (mHintSession) APerformanceHint_reportActualWorkDuration(mHintSession, workNs);
#endif

    if (mRestartRequested.exchange(false)) reopen();
    return oboe::DataCallbackResult::Continue;
}

void AudioEngine::onErrorAfterClose(oboe::AudioStream* /*stream*/, oboe::Result result) {
    LOGW("Stream error: %s — requesting reopen", convertToText(result));
    mRestartRequested.store(true);
}

} // namespace vibecore