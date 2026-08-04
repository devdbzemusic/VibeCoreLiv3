#include "AudioSessionManager.h"
#include "VibeCoreLog.h"

namespace vibecore {

const char* sessionStateToString(SessionState s) {
    switch (s) {
        case SessionState::Stopped:  return "Stopped";
        case SessionState::Starting: return "Starting";
        case SessionState::Running:  return "Running";
        case SessionState::Paused:   return "Paused";
        case SessionState::Ducked:   return "Ducked";
        case SessionState::Stopping: return "Stopping";
        case SessionState::Error:    return "Error";
        default:                     return "Unknown";
    }
}

AudioSessionManager::AudioSessionManager() = default;

void AudioSessionManager::setStateCallback(SessionStateCallback cb) {
    mStateCallback = std::move(cb);
}

void AudioSessionManager::onAudioFocusGained() {
    VIBECORE_ASSERT_NOT_AUDIO_THREAD();
    VLOG_I("Audio focus gained");
    const auto current = state();
    if (current == SessionState::Paused || current == SessionState::Ducked) {
        transitionTo(SessionState::Running);
    }
}

void AudioSessionManager::onAudioFocusLost(bool transient) {
    VIBECORE_ASSERT_NOT_AUDIO_THREAD();
    VLOG_I("Audio focus lost (transient=%s)", transient ? "yes" : "no");
    transitionTo(transient ? SessionState::Paused : SessionState::Ducked);
}

void AudioSessionManager::onStreamError(const std::string& reason) {
    // May be called from Oboe error thread — safe: only writes an atomic
    VLOG_E("Stream error: %s", reason.c_str());
    transitionTo(SessionState::Error);
}

void AudioSessionManager::onStreamStarted() {
    VIBECORE_ASSERT_NOT_AUDIO_THREAD();
    transitionTo(SessionState::Running);
}

void AudioSessionManager::onStreamStopped() {
    VIBECORE_ASSERT_NOT_AUDIO_THREAD();
    transitionTo(SessionState::Stopped);
}

void AudioSessionManager::transitionTo(SessionState next) {
    const SessionState prev = mState.exchange(next, std::memory_order_acq_rel);
    if (prev != next) {
        VLOG_I("Session state: %s → %s",
               sessionStateToString(prev), sessionStateToString(next));
        if (mStateCallback) {
            mStateCallback(prev, next);
        }
    }
}

} // namespace vibecore
