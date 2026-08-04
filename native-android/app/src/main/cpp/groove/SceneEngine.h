#pragma once
/**
 * SceneEngine.h — Scene and chain management for VibeCore Groove.
 *
 * A Scene is a snapshot of which pattern bank is active per track.
 * The SceneChain sequences scenes automatically over time.
 *
 * Scene switching is bar-synchronised — never mid-pattern.
 * QueueSceneChange() schedules the switch for the next bar boundary.
 *
 * Audio Thread state:
 *   mAT_* fields — owned exclusively by Audio Thread
 *   mAT_pendingScene — queued by command, applied in onBar()
 *
 * UI Thread API:
 *   All mutations go through GrooveCommand queue.
 *   SceneEngine::applyCommand() is called from GrooveNode::handleCommand().
 *
 * AUDIO THREAD onBar(): apply pending scene switch, advance chain.
 * ZERO allocation. ZERO locking.
 */

#include "GrooveTypes.h"
#include <array>
#include <cstdint>

namespace vibecore {

class SceneEngine {
public:
    SceneEngine() = default;

    // ── Setup (UI Thread — before stream) ─────────────────────────────────
    void setScene(int32_t sceneIdx, const Scene& scene) noexcept;
    void setChain(const SceneChain& chain) noexcept;

    // ── Immediate state (UI Thread command application on Audio Thread) ───
    void queueSceneChange(int32_t targetScene) noexcept;
    void applySceneNow(int32_t sceneIdx) noexcept;

    // ── Audio Thread callbacks ────────────────────────────────────────────
    /** Called at transport start. */
    void onTransportStart() noexcept;
    /** Called at transport stop. */
    void onTransportStop()  noexcept;
    /** Called every bar. Returns the scene index that is now active. */
    int32_t onBar() noexcept;

    // ── Query (Audio Thread) ──────────────────────────────────────────────
    int32_t activeScene()      const noexcept { return mActiveScene; }
    int32_t pendingScene()     const noexcept { return mPendingScene; }
    bool    hasSceneChange()   const noexcept { return mPendingScene != mActiveScene; }

    /** Returns the active bank index for a given track (Audio Thread). */
    int32_t trackBankIndex(int32_t track) const noexcept;

    int32_t sceneCount()       const noexcept { return mSceneCount; }
    const Scene& scene(int32_t i) const noexcept { return mScenes[i]; }

private:
    std::array<Scene, kMaxScenes> mScenes = {};
    SceneChain mChain   = {};
    int32_t    mSceneCount  = 0;
    int32_t    mActiveScene = 0;
    int32_t    mPendingScene = 0;

    // Chain state
    int32_t    mChainStep   = 0;
    int32_t    mBarCounter  = 0;    // bars elapsed in current chain step

    void advanceChain() noexcept;
};

} // namespace vibecore
