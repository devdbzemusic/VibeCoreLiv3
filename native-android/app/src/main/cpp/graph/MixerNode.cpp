#include "MixerNode.h"
#include <cstring>

namespace vibecore {

MixerNode::MixerNode(NodeId id) : AudioNode(id, "MixerNode") {
    for (auto& g : mInputGains) g.store(1.0f, std::memory_order_relaxed);
}

void MixerNode::prepare(int sampleRate, int maxFramesPerCallback) {
    mSampleRate = sampleRate;
    mMaxFrames  = maxFramesPerCallback;
}

void MixerNode::process(const float* inputBuffer,
                        float*       outputBuffer,
                        int          numFrames,
                        int          numChannels) noexcept {
    const int samples    = numFrames * numChannels;
    const float masterGain = mMasterGain.load(std::memory_order_relaxed);

    if (inputBuffer == nullptr) {
        // Phase 1: no input — output silence
        std::memset(outputBuffer, 0, static_cast<size_t>(samples) * sizeof(float));
        return;
    }

    // Phase 2+: accumulate with master gain
    for (int i = 0; i < samples; ++i) {
        outputBuffer[i] = inputBuffer[i] * masterGain;
    }
}

void MixerNode::reset() {
    for (auto& g : mInputGains) g.store(1.0f, std::memory_order_relaxed);
    mMasterGain.store(1.0f, std::memory_order_relaxed);
}

void MixerNode::setInputGain(int inputIndex, float gain) {
    if (inputIndex >= 0 && inputIndex < kMaxMixerInputs) {
        mInputGains[inputIndex].store(gain, std::memory_order_relaxed);
    }
}

void MixerNode::setMasterGain(float gain) {
    mMasterGain.store(gain, std::memory_order_relaxed);
}

} // namespace vibecore
