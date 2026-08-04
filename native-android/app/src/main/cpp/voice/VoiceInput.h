#pragma once
/**
 * VoiceInput.h — Live microphone input for VibeCore Voice.
 *
 * Full-duplex pattern (Oboe-recommended): the input stream is opened in
 * NON-callback mode; the OUTPUT audio callback pulls available frames with
 * read(timeout = 0) — non-blocking, realtime-safe, NO second audio thread,
 * NO second clock. The output callback remains the single audio callback.
 *
 * Lifecycle:
 *   open()/close() — UI Thread only, while a VoiceCommand round-trip
 *   guarantees the Audio Thread is not mid-read (mActive gate).
 *   readNonBlocking() — Audio Thread only.
 *
 * Thread model:
 *   mActive is the cross-thread gate: the Audio Thread only touches the
 *   stream while mActive is true; close() clears mActive first, then waits
 *   one buffer period before closing (see VoiceEngine::setLiveInput).
 */

#include <oboe/Oboe.h>
#include <atomic>
#include <memory>

namespace vibecore {

class VoiceInput {
public:
    // UI Thread. Returns true if the input stream opened.
    bool open(int sampleRate, int framesPerCallback) noexcept;

    // UI Thread. Caller must ensure the Audio Thread saw mActive == false
    // for at least one callback before this is invoked.
    void close() noexcept;

    void setActive(bool a) noexcept { mActive.store(a, std::memory_order_release); }
    bool isActive() const  noexcept { return mActive.load(std::memory_order_acquire); }

    // Audio Thread. Reads up to numFrames mono frames into dst (zero-fills
    // the remainder). Returns frames actually read. timeout = 0 — never blocks.
    //
    // Handshake with close(): sets mReading BEFORE checking mActive; close()
    // clears mActive and then waits for mReading == false, so the stream is
    // never destroyed while a read is in flight.
    int readNonBlocking(float* dst, int numFrames) noexcept;

private:
    std::shared_ptr<oboe::AudioStream> mStream;
    std::atomic<bool> mActive{false};
    std::atomic<bool> mReading{false};   // Audio Thread is inside read()
    int mChannels = 1;
};

} // namespace vibecore
