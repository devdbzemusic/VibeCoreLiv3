#pragma once
/**
 * AudioGraphManager.h — Modular audio graph for VibeCore Univers.
 *
 * Manages a directed acyclic graph (DAG) of AudioNodes.
 * Determines topological render order and dispatches process() calls
 * on the Audio Thread.
 *
 * Phase 1: Infrastructure only. No nodes are added in Phase 1.
 *   The graph validates the dispatch pipeline with an empty graph
 *   (outputs silence, measures overhead).
 *
 * Phase 2+ nodes to be added:
 *   GrooveNode, SynthNode, BassNode, VoiceNode, FXNode, MasterMixerNode
 *
 * Thread ownership:
 *   addNode(), removeNode(), connect()  → UI Thread ONLY (before/after stream)
 *   process()                           → Audio Thread ONLY
 *
 * Memory: All node storage pre-allocated at prepare() time.
 *         No allocation during process().
 */

#include "AudioNode.h"
#include "AudioBus.h"
#include <vector>
#include <memory>
#include <unordered_map>

namespace vibecore {

struct GraphEdge {
    NodeId sourceId;
    NodeId sinkId;
};

class AudioGraphManager {
public:
    static constexpr int kMaxNodes = 64;

    AudioGraphManager();
    ~AudioGraphManager() = default;

    // ── Graph construction (UI Thread, before stream start) ───────────────

    /**
     * Add a node to the graph. The graph takes ownership.
     * Returns the assigned NodeId.
     */
    NodeId addNode(std::unique_ptr<AudioNode> node);

    /**
     * Remove a node by ID. Its connections are also removed.
     * Must not be called while the stream is running.
     */
    void removeNode(NodeId id);

    /**
     * Connect source output to sink input.
     * A node may have multiple inputs (they are summed).
     */
    bool connect(NodeId sourceId, NodeId sinkId);

    /** Disconnect a specific edge. */
    void disconnect(NodeId sourceId, NodeId sinkId);

    // ── Lifecycle (UI Thread) ─────────────────────────────────────────────

    /**
     * Allocate all AudioBus buffers and call prepare() on all nodes.
     * Call after building the graph, before starting the stream.
     */
    void prepare(int sampleRate, int maxFramesPerCallback);

    /** Call when stream stops. Calls reset() on all nodes. */
    void reset();

    // ── Render (Audio Thread) ─────────────────────────────────────────────

    /**
     * Process one audio callback.
     * Renders nodes in topological order, writes final output to outputBuffer.
     * outputBuffer: interleaved float32, numFrames * numChannels
     */
    void process(float* outputBuffer, int numFrames, int numChannels) noexcept;

    // ── Inspection (UI Thread) ────────────────────────────────────────────
    size_t nodeCount() const { return mNodes.size(); }
    size_t edgeCount() const { return mEdges.size(); }

private:
    void rebuildRenderOrder();  // topological sort → mRenderOrder
    void clearOutputBuffer(float* buf, int numFrames, int numChannels) noexcept;

    std::vector<std::unique_ptr<AudioNode>> mNodes;
    std::vector<GraphEdge>                  mEdges;
    std::vector<AudioNode*>                 mRenderOrder;  // sorted, Audio Thread read-only

    // One bus per node for its output
    std::unordered_map<NodeId, AudioBus>    mOutputBuses;

    int mSampleRate{48000};
    int mMaxFrames{96};
    int mChannelCount{2};

    bool mPrepared{false};
    NodeId mNextId{1};
};

} // namespace vibecore
