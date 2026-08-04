#pragma once
/**
 * VoiceSampleBank.h — Sample slot storage view for VibeCore Voice (Audio Thread).
 *
 * The Audio Thread NEVER owns sample memory. VoiceEngine (UI Thread) owns
 * the buffers and publishes {pointer, length} through SetSampleData commands.
 * The bank stores the published views; the deferred-free protocol on the
 * engine side guarantees a published pointer stays valid until at least two
 * further loads of the same slot have been published and drained.
 *
 * Thread model: all methods Audio Thread only (called from command handling).
 */

#include "VoiceTypes.h"

namespace vibecore {

struct VoiceSampleSlot {
    const float* data         = nullptr;   // mono, engine-owned
    int32_t      lengthFrames = 0;
    int32_t      sampleRate   = 48000;
    int32_t      rootNote     = 60;
    int32_t      sliceCount   = 0;
    int32_t      sliceStart[kVoiceMaxSlices] = {};

    bool valid() const noexcept { return data != nullptr && lengthFrames > 0; }
};

class VoiceSampleBank {
public:
    void set(int slot, const float* data, int32_t length,
             int32_t rate, int32_t rootNote) noexcept {
        if (slot < 0 || slot >= kVoiceSampleSlots) return;
        mSlots[slot].data         = data;
        mSlots[slot].lengthFrames = length;
        mSlots[slot].sampleRate   = rate;
        mSlots[slot].rootNote     = rootNote;
    }

    void clear(int slot) noexcept {
        if (slot < 0 || slot >= kVoiceSampleSlots) return;
        mSlots[slot] = {};
    }

    void setSlices(int slot, int count, const int32_t* starts) noexcept {
        if (slot < 0 || slot >= kVoiceSampleSlots) return;
        if (count < 0) count = 0;
        if (count > kVoiceMaxSlices) count = kVoiceMaxSlices;
        mSlots[slot].sliceCount = count;
        for (int i = 0; i < count; ++i) mSlots[slot].sliceStart[i] = starts[i];
    }

    const VoiceSampleSlot& slot(int i) const noexcept {
        static const VoiceSampleSlot kEmpty = {};
        return (i >= 0 && i < kVoiceSampleSlots) ? mSlots[i] : kEmpty;
    }

private:
    VoiceSampleSlot mSlots[kVoiceSampleSlots] = {};
};

} // namespace vibecore
