#pragma once
/**
 * AudioDeviceManager.h — Device selection, capability query, hotplug handling.
 *
 * Responsibilities:
 *   - Select optimal output device (prefer AAudio, fallback OpenSL ES)
 *   - Query device capabilities (sample rate, burst size, exclusive mode)
 *   - Detect device changes (headphones, Bluetooth, USB audio)
 *   - Notify AudioSessionManager on device change
 *
 * Thread ownership: UI Thread only (except getOptimalBurstSize which is
 * safe to call before stream creation).
 */

#include <oboe/Oboe.h>
#include <functional>
#include <string>

namespace vibecore {

struct DeviceCapabilities {
    int32_t sampleRate         = 48000;
    int32_t burstFrames        = 96;
    bool    supportsExclusive  = false;
    bool    supportsAAudio     = false;
    bool    supportsADPF       = false;   // Android Dynamic Performance Framework
    int32_t outputDeviceId     = oboe::kUnspecified;
    std::string deviceName     = "default";
};

using DeviceChangeCallback = std::function<void(const DeviceCapabilities&)>;

class AudioDeviceManager {
public:
    AudioDeviceManager();
    ~AudioDeviceManager() = default;

    /**
     * Query the current device capabilities.
     * Must be called on UI thread before creating the audio stream.
     */
    DeviceCapabilities queryCapabilities();

    /**
     * Returns the optimal burst size for lowest latency on this device.
     * Calls Oboe's AudioStreamBuilder in probe mode (no stream opened).
     */
    int32_t getOptimalBurstSize();

    /**
     * Returns the optimal sample rate for this device.
     */
    int32_t getOptimalSampleRate();

    /**
     * Register a callback invoked on the UI thread when the audio device changes
     * (e.g. headphones plugged/unplugged, Bluetooth connected).
     */
    void setDeviceChangeCallback(DeviceChangeCallback cb);

    /**
     * Called by NativeAudioBridge when Android reports an audio device change.
     * Must be called on UI thread.
     */
    void onDeviceChange();

    const DeviceCapabilities& capabilities() const { return mCapabilities; }

private:
    DeviceCapabilities  mCapabilities;
    DeviceChangeCallback mChangeCallback;
    bool mCapabilitiesQueried = false;
};

} // namespace vibecore
