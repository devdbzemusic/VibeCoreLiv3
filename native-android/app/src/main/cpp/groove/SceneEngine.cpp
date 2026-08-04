#include "SceneEngine.h"

namespace vibecore {

void SceneEngine::setScene(int32_t sceneIdx, const Scene& scene) noexcept {
    if (sceneIdx < 0 || sceneIdx >= kMaxScenes) return;
    mScenes[sceneIdx] = scene;
    mScenes[sceneIdx].valid = true;
    if (sceneIdx >= mSceneCount) mSceneCount = sceneIdx + 1;
}

void SceneEngine::setChain(const SceneChain& chain) noexcept {
    mChain     = chain;
    mChainStep = 0;
    mBarCounter = 0;
}

void SceneEngine::queueSceneChange(int32_t targetScene) noexcept {
    if (targetScene >= 0 && targetScene < kMaxScenes && mScenes[targetScene].valid) {
        mPendingScene = targetScene;
    }
}

void SceneEngine::applySceneNow(int32_t sceneIdx) noexcept {
    if (sceneIdx < 0 || sceneIdx >= kMaxScenes) return;
    mActiveScene  = sceneIdx;
    mPendingScene = sceneIdx;
}

void SceneEngine::onTransportStart() noexcept {
    mBarCounter = 0;
}

void SceneEngine::onTransportStop() noexcept {
    // Scene state persists across stop/start
}

int32_t SceneEngine::onBar() noexcept {
    // Apply pending scene switch
    if (mPendingScene != mActiveScene) {
        mActiveScene = mPendingScene;
        mBarCounter  = 0;
    }

    // Advance chain if active
    if (mChain.length > 0) {
        mBarCounter++;
        const ChainStep& cs = mChain.steps[mChainStep % mChain.length];
        if (mBarCounter >= cs.repeatBars) {
            advanceChain();
        }
    }

    return mActiveScene;
}

int32_t SceneEngine::trackBankIndex(int32_t track) const noexcept {
    if (track < 0 || track >= kMaxTracks) return 0;
    if (mActiveScene < 0 || mActiveScene >= mSceneCount) return 0;
    const Scene& s = mScenes[mActiveScene];
    return s.valid ? s.bankIndex[track] : 0;
}

void SceneEngine::advanceChain() noexcept {
    mBarCounter = 0;
    mChainStep++;
    if (mChain.looping) mChainStep %= mChain.length;
    else if (mChainStep >= mChain.length) { mChainStep = mChain.length - 1; return; }

    const int32_t nextScene = mChain.steps[mChainStep].sceneIndex;
    queueSceneChange(nextScene);
}

} // namespace vibecore
