#pragma once
/**
 * AudioBus.h — Fixed-size interleaved audio buffer for graph routing.
 *
 * An AudioBus is the connection between two AudioNodes.
 * Allocated once at prepare() time, reused every callback.
 *
 * Layout: interleaved float32
 *   frame 0: [ch0, ch1], frame 1: [ch0, ch1], ...
 *   total samples = numFrames * numChannels
 *
 * Thread-safety:
 *   Written by the source node, read by the sink node.
 *   Both operations happen on the Audio Thread in topological order.
 *   No concurrent access — the graph manager serialises processing.
 */

#include <vector>
#include <cstring>
#include <cassert>

namespace vibecore {

class AudioBus {
public:
    AudioBus() : mNumChannels(0), mMaxFrames(0) {}

    /**
     * Allocate the buffer. Call once on UI thread before stream starts.
     * Safe to call multiple times (reallocates if size changes).
     */
    void prepare(int numChannels, int maxFrames) {
        mNumChannels = numChannels;
        mMaxFrames   = maxFrames;
        mBuffer.assign(static_cast<size_t>(numChannels * maxFrames), 0.0f);
    }

    /** Clear to silence. Called at the start of each callback by the graph. */
    void clear(int numFrames) noexcept {
        const size_t samples = static_cast<size_t>(numFrames * mNumChannels);
        std::memset(mBuffer.data(), 0, samples * sizeof(float));
    }

    float*       data()        noexcept { return mBuffer.data(); }
    const float* data()  const noexcept { return mBuffer.data(); }
    int          channels()    const noexcept { return mNumChannels; }
    int          maxFrames()   const noexcept { return mMaxFrames; }

private:
    int                mNumChannels;
    int                mMaxFrames;
    std::vector<float> mBuffer;  // allocated once, no audio-thread allocation
};

} // namespace vibecore
