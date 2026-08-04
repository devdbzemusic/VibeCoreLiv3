#pragma once
/**
 * AudioSessionManager.h — Audio focus and session lifecycle.
 *
 * Responsibilities:
 *   - React to Android AudioFocus changes (calls, notifications, other apps)
 *   - Manage stream start/stop/pause/resume lifecycle
 *   - Coordinate device changes with DeviceManager
 *   - Provide clean state machine for engine lifecycle
 *
 * Thread ownership: UI Thread.
 * The engine callbacks (onError) are forwarded here from the Audio Thread
 * via atomic flag — not called directly on the Audio Thread.
 */

#include <functional>
#include <atomic>
#include <string>

namespace vibecore {

enum class SessionState : uint8_t {
    Stopped   = 0,
    Starting  = 1,
    Running   = 2,
    Paused    = 3,   // audio focus lost transiently
    Ducked    = 4,   // audio focus lost to duck
    Stopping  = 5,
    Error     = 6,
};

const char* sessionStateToString(SessionState s);

using SessionStateCallback = std::function<void(SessionState prev, SessionState next)>;

class AudioSessionManager {
public:
    AudioSessionManager();
    ~AudioSessionManager() = default;

    /** Register a listener for state transitions (called on UI thread). */
    void setStateCallback(SessionStateCallback cb);

    /** Called by NativeAudioBridge when app gains audio focus. */
    void onAudioFocusGained();

    /** Called by NativeAudioBridge when audio focus is lost (transient = true → duck/pause). */
    void onAudioFocusLost(bool transient);

    /** Called by engine when a stream error occurs (e.g. device disconnect). */
    void onStreamError(const std::string& reason);

    /** Called when stream successfully starts. */
    void onStreamStarted();

    /** Called when stream cleanly stops. */
    void onStreamStopped();

    SessionState state() const noexcept { return mState.load(std::memory_order_acquire); }

    bool isRunning() const noexcept { return state() == SessionState::Running; }

private:
    void transitionTo(SessionState next);

    std::atomic<SessionState> mState{SessionState::Stopped};
    SessionStateCallback      mStateCallback;
};

} // namespace vibecore
