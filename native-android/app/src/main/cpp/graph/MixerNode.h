#pragma once
/**
 * MixerNode.h — N-input to 1-output summing mixer node.
 *
 * Phase 1 role: Infrastructure placeholder — validates that the graph
 * can route signal through a node without any DSP processing.
 *
 * Phase 2+: This becomes the master mix bus. Module nodes (Groove, Bass,
 * Synth, Voice) route their output into a MixerNode which feeds the
 * Oboe output buffer.
 *
 * Processing: simple float accumulation with per-input gain.
 * No clipping, limiting, or saturation in Phase 1 (that is DSP).
 *
 * Thread ownership: process() → Audio Thread only.
 */

#include "AudioNode.h"
#include <array>
#include <atomic>

namespace vibecore {

static constexpr int kMaxMixerInputs = 32;

class MixerNode : public AudioNode {
public:
    explicit MixerNode(NodeId id);

    void prepare(int sampleRate, int maxFramesPerCallback) override;

    /**
     * Sums all input buses into outputBuffer.
     * In Phase 1 the input is nullptr → outputs silence.
     * Phase 2+: receives pre-summed bus from AudioGraphManager.
     */
    void process(const float* inputBuffer,
                 float*       outputBuffer,
                 int          numFrames,
                 int          numChannels) noexcept override;

    void reset() override;

    /** Set per-input gain (0.0 – 2.0). Safe from UI thread between callbacks. */
    void setInputGain(int inputIndex, float gain);

    /** Set master output gain (0.0 – 1.0). */
    void setMasterGain(float gain);

private:
    std::array<std::atomic<float>, kMaxMixerInputs> mInputGains;
    std::atomic<float> mMasterGain{1.0f};
    int mSampleRate{48000};
    int mMaxFrames{96};
};

} // namespace vibecore
