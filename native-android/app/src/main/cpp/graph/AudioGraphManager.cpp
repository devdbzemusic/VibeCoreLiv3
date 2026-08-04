#include "AudioGraphManager.h"
#include "../platform/VibeCoreLog.h"
#include "../threads/ThreadModel.h"
#include "../platform/sync/MusicalPosition.h"
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
}

bool AudioGraphManager::connect(NodeId sourceId, NodeId sinkId) {
    VIBECORE_ASSERT_NOT_AUDIO_THREAD();
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
        }), mEdges.end());
    rebuildRenderOrder();
}

void AudioGraphManager::prepare(int sampleRate, int maxFramesPerCallback) {
    VIBECORE_ASSERT_NOT_AUDIO_THREAD();
    mSampleRate   = sampleRate;
    mMaxFrames    = maxFramesPerCallback;
    mChannelCount = 2;

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
    for (const auto& node : mNodes) node->reset();
    mPrepared = false;
}

// ── Sync event dispatch — Audio Thread ───────────────────────────────────────

void AudioGraphManager::dispatchSyncEvents(const TickEventBuffer& events) noexcept {
    if (mRenderOrder.empty()) return;

    for (const TickEvent& ev : events) {
        for (AudioNode* node : mRenderOrder) {
            if (!node->enabled()) continue;

            switch (ev.type) {
                case TickEvent::Type::TransportStart:
                    node->onTransportStart(ev.sampleOffset);
                    break;

                case TickEvent::Type::TransportStop:
                    node->onTransportStop(ev.sampleOffset);
                    break;

                case TickEvent::Type::TempoChanged:
                    node->onTempoChanged(ev.bpm, ev.sampleOffset);
                    break;

                case TickEvent::Type::Tick:
                    node->onTick(ev.absoluteTick, ev.position, ev.sampleOffset);
                    break;

                case TickEvent::Type::Beat:
                    node->onTick(ev.absoluteTick, ev.position, ev.sampleOffset);
                    node->onBeat(ev.absoluteTick, ev.position, ev.sampleOffset);
                    break;

                case TickEvent::Type::Bar:
                    node->onTick(ev.absoluteTick, ev.position, ev.sampleOffset);
                    node->onBeat(ev.absoluteTick, ev.position, ev.sampleOffset);
                    node->onBar(ev.absoluteTick,  ev.position, ev.sampleOffset);
                    break;

                case TickEvent::Type::Loop:
                    node->onLoop(ev.loopCount, ev.sampleOffset);
                    break;
            }
        }
    }
}

// ── Render — Audio Thread ─────────────────────────────────────────────────────

void AudioGraphManager::process(float* outputBuffer,
                                 int numFrames,
                                 int numChannels) noexcept {
    clearOutputBuffer(outputBuffer, numFrames, numChannels);

    if (mRenderOrder.empty()) return;

    for (AudioNode* node : mRenderOrder) {
        if (!node->enabled()) continue;
        auto busIt = mOutputBuses.find(node->id());
        AudioBus* outBus = (busIt != mOutputBuses.end()) ? &busIt->second : nullptr;
        if (outBus) outBus->clear(numFrames);

        node->process(nullptr,
                      outBus ? outBus->data() : outputBuffer,
                      numFrames, numChannels);
    }

    // Mix leaf-node outputs into final buffer
    for (AudioNode* node : mRenderOrder) {
        bool isLeaf = true;
        for (const auto& edge : mEdges) {
            if (edge.sourceId == node->id()) { isLeaf = false; break; }
        }
        if (!isLeaf) continue;
        auto busIt = mOutputBuses.find(node->id());
        if (busIt == mOutputBuses.end()) continue;
        const float* src = busIt->second.data();
        const int samples = numFrames * numChannels;
        for (int i = 0; i < samples; ++i) outputBuffer[i] += src[i];
    }
}

// ── Private ───────────────────────────────────────────────────────────────────

void AudioGraphManager::rebuildRenderOrder() {
    mRenderOrder.clear();
    std::unordered_map<NodeId, int> inDegree;
    for (const auto& node : mNodes) inDegree[node->id()] = 0;
    for (const auto& edge : mEdges) inDegree[edge.sinkId]++;

    std::vector<AudioNode*> queue;
    for (const auto& node : mNodes) {
        if (inDegree[node->id()] == 0) queue.push_back(node.get());
    }
    while (!queue.empty()) {
        // FIFO pop → nodes with equal precedence render in INSERTION order.
        // (Groove is created first and must render before instrument nodes so
        // its Audio-Thread trigger dispatch lands in the same callback.)
        AudioNode* n = queue.front(); queue.erase(queue.begin());
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
