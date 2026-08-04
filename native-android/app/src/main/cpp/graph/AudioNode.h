#pragma once
/**
 * AudioNode.h — Abstract base for all nodes in the VibeCore Audio Graph.
 *
 * Every audio processing unit (mixer, instrument, effect, output) is a node.
 * Nodes are connected through AudioBus references managed by AudioGraphManager.
 *
 * Lifecycle:
 *   prepare(sampleRate, maxFrames)  — called on UI thread before stream starts
 *   process(...)                    — called exclusively on Audio Thread
 *   reset()                         — called on UI thread (stream stopped)
 *
 * Thread-safety contract:
 *   process() is called ONLY on the Audio Thread.
 *   All other methods MUST NOT be called while process() is running.
 *   Parameter changes use AudioThreadSafeQueue, not direct mutation.
 */

#include <cstdint>
#include <string>

namespace vibecore {

using NodeId = uint32_t;
static constexpr NodeId kInvalidNodeId = 0;

class AudioNode {
public:
    explicit AudioNode(NodeId id, const char* name)
        : mId(id), mName(name), mEnabled(true) {}

    virtual ~AudioNode() = default;

    // Non-copyable, non-movable (nodes are owned by AudioGraphManager)
    AudioNode(const AudioNode&)            = delete;
    AudioNode& operator=(const AudioNode&) = delete;

    /**
     * Called on UI thread before the audio stream starts.
     * Allocate scratch buffers here (one-time allocation is allowed).
     * sampleRate: e.g. 48000
     * maxFramesPerCallback: e.g. 96
     */
    virtual void prepare(int sampleRate, int maxFramesPerCallback) = 0;

    /**
     * Called on Audio Thread every callback.
     * outputBuffer: interleaved float32, numFrames * numChannels samples
     * inputBuffer:  may be nullptr for source nodes
     * numFrames:    actual frames this callback (≤ maxFramesPerCallback)
     * numChannels:  always 2 (stereo) in current platform
     *
     * FORBIDDEN in this function: malloc, free, mutex, file I/O, JNI, exceptions.
     */
    virtual void process(const float* inputBuffer,
                         float*       outputBuffer,
                         int          numFrames,
                         int          numChannels) noexcept = 0;

    /**
     * Called on UI thread when stream stops.
     * Reset internal state, clear buffers.
     */
    virtual void reset() = 0;

    NodeId      id()      const noexcept { return mId; }
    const char* name()    const noexcept { return mName; }
    bool        enabled() const noexcept { return mEnabled; }
    void        setEnabled(bool e) noexcept { mEnabled = e; }

protected:
    const NodeId    mId;
    const char*     mName;
    bool            mEnabled;
};

} // namespace vibecore
