// VibeCore — native Oboe realtime audio engine.
// Sample-triggered voice mixer on a low-latency AAudio/OpenSL ES output stream.
#pragma once

#include <oboe/Oboe.h>
#include <array>
#include <atomic>
#include <vector>
#include <cstdint>
#include <chrono>
#include <sched.h>
#if defined(__ANDROID_API__) && __ANDROID_API__ >= 31
#include <android/performance_hint.h>
#endif

namespace vibecore {

constexpr int kMaxSampleSlots = 64;
constexpr int kMaxVoices = 64; // Xiaomi big-core VoiceMark_90 = 214 → ausreichend Headroom
constexpr int kDefaultFramesPerBurst = 96; // SynthMark: 96 Frames = 2 ms @ 48 kHz
constexpr int kBigCpuIndexDefault = 6;    // SynthMark: BIG = CPU #6

struct SampleBuffer {
    std::vector<float> data;   // interleaved (channels * frames)
    int channels = 0;
    int sampleRate = 48000;
};

struct Voice {
    const SampleBuffer* sample = nullptr;
    double playPos = 0.0;      // position in source frames
    double pitchRatio = 1.0;   // 1.0 = original pitch
    float gain = 1.0f;
    bool active = false;
    bool loop = false;
};

// Oboe-Stream-Callback: rendert auf dem hochpriorisierten Audio-Thread.
class AudioEngine : public oboe::AudioStreamCallback {
public:
    AudioEngine();
    ~AudioEngine();

    // Lifecycle
    int  start();
    void stop();

    // Kontrolle (thread-safe via atomics/short critical sections)
    void setTempo(double bpm);
    void setMasterGain(float g);
    int  loadSample(int slot, const float* data, int frames, int channels, int sampleRate);
    void trigger(int slot, float semitones, float velocity, bool loop);
    int  getOutputLatencyMs() const;
    // Geräte-Tuning (SynthMark): Burst-Größe, Big-Core-Index, ADPF.
    int  configure(int framesPerBurst, int bigCpuIndex, bool enableAdpf);

    // Oboe Callbacks
    oboe::DataCallbackResult onAudioReady(oboe::AudioStream* stream,
                                          void* audioData,
                                          int32_t numFrames) override;
    void onErrorAfterClose(oboe::AudioStream* stream, oboe::Result result) override;

private:
    std::shared_ptr<oboe::AudioStream> mStream;
    int mChannelCount = 2;
    int mSampleRate = 48000;

    std::array<SampleBuffer, kMaxSampleSlots> mSamples;
    std::array<Voice, kMaxVoices> mVoices;

    std::atomic<float>  mMasterGain{1.0f};
    std::atomic<double> mTempo{120.0};
    std::atomic<bool>   mRestartRequested{false};

    // Geräte-Tuning (von JS configure() gesetzt).
    int  mFramesPerBurst = kDefaultFramesPerBurst;
    int  mBigCpuIndex    = kBigCpuIndexDefault;
    bool mAdpf           = true;
    bool mAffinitySet    = false;
#if defined(__ANDROID_API__) && __ANDROID_API__ >= 31
    APerformanceHintSession* mHintSession = nullptr;
    int64_t mHintTargetNs = 2000000; // 1 Burst @ 48 kHz ≈ 2 ms
#endif

    void mixVoice(Voice& v, float* out, int32_t frames, int outChannels);
    int  reopen();
};

} // namespace vibecore