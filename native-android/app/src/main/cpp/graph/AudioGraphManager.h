#pragma once
/**
 * AudioGraphManager.h — Modular audio graph for VibeCore Univers.
 *
 * Phase 2 addition: dispatchSyncEvents()
 *   Routes TickEventBuffer to all enabled nodes before process().
 *   This is how VibeCoreSync delivers sample-accurate timing to every module.
 *
 * Unchanged from Phase 1:
 *   addNode / removeNode / connect / prepare / reset / process
 *
 * Thread ownership:
 *   addNode, removeNode, connect → UI Thread ONLY (before/after stream)
 *   dispatchSyncEvents + process  → Audio Thread ONLY
 */

#include "AudioNode.h"
#include "AudioBus.h"
#include "../platform/sync/TickEvent.h"
#include "../platform/sync/MusicalPosition.h"
#include <vector>
#include <memory>
#include <unordered_map>

namespace vibecore {

struct GraphEdge { NodeId sourceId; NodeId sinkId; };

class AudioGraphManager {
public:
    static constexpr int kMaxNodes = 64;

    AudioGraphManager();
    ~AudioGraphManager() = default;

    // ── Graph construction (UI Thread) ────────────────────────────────────
    NodeId addNode(std::unique_ptr<AudioNode> node);
    void   removeNode(NodeId id);
    bool   connect(NodeId sourceId, NodeId sinkId);
    void   disconnect(NodeId sourceId, NodeId sinkId);

    // ── Lifecycle (UI Thread) ─────────────────────────────────────────────
    void prepare(int sampleRate, int maxFramesPerCallback);
    void reset();

    // ── Sync event dispatch (Audio Thread) ───────────────────────────────
    /**
     * Called BEFORE process() each callback.
     * Iterates through the TickEventBuffer and calls the appropriate
     * virtual method on each enabled node in render order.
     *
     * Zero allocation. All dispatch via virtual calls only.
     */
    void dispatchSyncEvents(const TickEventBuffer& events) noexcept;

    // ── Render (Audio Thread) ─────────────────────────────────────────────
    void process(float* outputBuffer, int numFrames, int numChannels) noexcept;

    // ── Inspection ────────────────────────────────────────────────────────
    size_t nodeCount() const { return mNodes.size(); }
    size_t edgeCount() const { return mEdges.size(); }

private:
    void rebuildRenderOrder();
    void clearOutputBuffer(float* buf, int numFrames, int numChannels) noexcept;

    std::vector<std::unique_ptr<AudioNode>> mNodes;
    std::vector<GraphEdge>                  mEdges;
    std::vector<AudioNode*>                 mRenderOrder;
    std::unordered_map<NodeId, AudioBus>    mOutputBuses;

    int  mSampleRate{48000};
    int  mMaxFrames{96};
    int  mChannelCount{2};
    bool mPrepared{false};
    NodeId mNextId{1};
};

} // namespace vibecore
