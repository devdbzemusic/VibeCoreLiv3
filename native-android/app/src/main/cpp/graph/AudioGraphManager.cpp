#include "AudioGraphManager.h"
#include "../platform/VibeCoreLog.h"
#include <algorithm>
#include <unordered_set>
#include <cstring>

namespace vibecore {

AudioGraphManager::AudioGraphManager() = default;

NodeId AudioGraphManager::addNode(std::unique_ptr<AudioNode> node) {
    VIBECORE_ASSERT_NOT_AUDIO_THREAD();
    const NodeId id = node->id();
    VLOG_D("AudioGraph: addNode id=%u name=%s", id, node->name());
    mNodes.push_back(std::move(node));
    rebuildRenderOrder();
    return id;
}

void AudioGraphManager::removeNode(NodeId id) {
    VIBECORE_ASSERT_NOT_AUDIO_THREAD();
    mNodes.erase(std::remove_if(mNodes.begin(), mNodes.end(),
        [id](const std::unique_ptr<AudioNode>& n) { return n->id() == id; }),
        mNodes.end());
    mEdges.erase(std::remove_if(mEdges.begin(), mEdges.end(),
        [id](const GraphEdge& e) { return e.sourceId == id || e.sinkId == id; }),
        mEdges.end());
    mOutputBuses.erase(id);
    rebuildRenderOrder();
    VLOG_D("AudioGraph: removeNode id=%u", id);
}

bool AudioGraphManager::connect(NodeId sourceId, NodeId sinkId) {
    VIBECORE_ASSERT_NOT_AUDIO_THREAD();
    // Prevent duplicate edges
    for (const auto& e : mEdges) {
        if (e.sourceId == sourceId && e.sinkId == sinkId) return false;
    }
    mEdges.push_back({sourceId, sinkId});
    rebuildRenderOrder();
    VLOG_D("AudioGraph: connect %u → %u", sourceId, sinkId);
    return true;
}

void AudioGraphManager::disconnect(NodeId sourceId, NodeId sinkId) {
    VIBECORE_ASSERT_NOT_AUDIO_THREAD();
    mEdges.erase(std::remove_if(mEdges.begin(), mEdges.end(),
        [&](const GraphEdge& e) {
            return e.sourceId == sourceId && e.sinkId == sinkId;
        }),
        mEdges.end());
    rebuildRenderOrder();
}

void AudioGraphManager::prepare(int sampleRate, int maxFramesPerCallback) {
    VIBECORE_ASSERT_NOT_AUDIO_THREAD();
    mSampleRate   = sampleRate;
    mMaxFrames    = maxFramesPerCallback;
    mChannelCount = 2; // stereo, constant in Phase 1

    // Allocate one output bus per node
    for (const auto& node : mNodes) {
        mOutputBuses[node->id()].prepare(mChannelCount, mMaxFrames);
        node->prepare(sampleRate, maxFramesPerCallback);
    }
    mPrepared = true;
    VLOG_I("AudioGraph: prepared — %zu nodes, %zu edges, %d Hz, %d fr/cb",
           mNodes.size(), mEdges.size(), sampleRate, maxFramesPerCallback);
}

void AudioGraphManager::reset() {
    VIBECORE_ASSERT_NOT_AUDIO_THREAD();
    for (const auto& node : mNodes) {
        node->reset();
    }
    mPrepared = false;
}

void AudioGraphManager::process(float* outputBuffer,
                                 int numFrames,
                                 int numChannels) noexcept {
    // Clear final output
    clearOutputBuffer(outputBuffer, numFrames, numChannels);

    if (mRenderOrder.empty()) {
        // Phase 1: no nodes — outputs silence (already cleared above)
        return;
    }

    // Process nodes in topological order
    for (AudioNode* node : mRenderOrder) {
        if (!node->enabled()) continue;

        // Find input bus: sum all source buses connected to this node
        AudioBus* outBus = nullptr;
        auto busIt = mOutputBuses.find(node->id());
        if (busIt != mOutputBuses.end()) {
            outBus = &busIt->second;
            outBus->clear(numFrames);
        }

        // Find any source connected to this node and mix into a scratch input
        // For Phase 1 with no connections: inputBuffer = nullptr
        const float* inputBuffer = nullptr;

        node->process(inputBuffer,
                      outBus ? outBus->data() : outputBuffer,
                      numFrames,
                      numChannels);
    }

    // Mix all leaf-node outputs into the final output buffer
    // (In Phase 1 there are no nodes, so this is a no-op)
    for (AudioNode* node : mRenderOrder) {
        // A leaf has no outgoing edges
        bool isLeaf = true;
        for (const auto& edge : mEdges) {
            if (edge.sourceId == node->id()) { isLeaf = false; break; }
        }
        if (!isLeaf) continue;

        auto busIt = mOutputBuses.find(node->id());
        if (busIt == mOutputBuses.end()) continue;
        const float* src = busIt->second.data();
        const int samples = numFrames * numChannels;
        for (int i = 0; i < samples; ++i) {
            outputBuffer[i] += src[i];
        }
    }
}

void AudioGraphManager::rebuildRenderOrder() {
    // Kahn's algorithm for topological sort
    mRenderOrder.clear();

    std::unordered_map<NodeId, int> inDegree;
    for (const auto& node : mNodes) inDegree[node->id()] = 0;
    for (const auto& edge : mEdges) inDegree[edge.sinkId]++;

    std::vector<AudioNode*> queue;
    for (const auto& node : mNodes) {
        if (inDegree[node->id()] == 0) queue.push_back(node.get());
    }

    while (!queue.empty()) {
        AudioNode* n = queue.back(); queue.pop_back();
        mRenderOrder.push_back(n);
        for (const auto& edge : mEdges) {
            if (edge.sourceId == n->id()) {
                if (--inDegree[edge.sinkId] == 0) {
                    for (const auto& node : mNodes) {
                        if (node->id() == edge.sinkId) {
                            queue.push_back(node.get()); break;
                        }
                    }
                }
            }
        }
    }
}

void AudioGraphManager::clearOutputBuffer(float* buf, int numFrames, int numChannels) noexcept {
    std::memset(buf, 0, static_cast<size_t>(numFrames * numChannels) * sizeof(float));
}

} // namespace vibecore
