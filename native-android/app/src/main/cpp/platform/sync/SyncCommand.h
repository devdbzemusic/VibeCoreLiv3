#pragma once
/**
 * SyncCommand.h — Commands from UI/MIDI threads to VibeCoreSync (Audio Thread).
 *
 * Sent via AudioThreadSafeQueue<SyncCommand, 128>.
 * Must be trivially copyable (enforced by static_assert in queue).
 *
 * All timing state mutations happen on the Audio Thread when the
 * command is drained from the queue — never via shared mutable state.
 */

#include <cstdint>

namespace vibecore {

struct SyncCommand {
    enum class Type : uint8_t {
        TransportStart    = 0,  // start playback from current position
        TransportStop     = 1,  // stop playback
        SetTempo          = 2,  // floatVal = BPM (20.0 – 300.0)
        SetTimeSignature  = 3,  // int32Val = numerator, int32Val2 = denominator
        SetPosition       = 4,  // int64Val = target absolute tick
        SetLoopEnabled    = 5,  // int32Val = 1 (enabled) or 0 (disabled)
        SetLoopStart      = 6,  // int64Val = loop start tick
        SetLoopEnd        = 7,  // int64Val = loop end tick
    };

    Type    type      = Type::TransportStop;
    float   floatVal  = 0.0f;
    int32_t int32Val  = 0;
    int32_t int32Val2 = 0;
    int64_t int64Val  = 0;
};
static_assert(std::is_trivially_copyable<SyncCommand>::value,
              "SyncCommand must be trivially copyable for AudioThreadSafeQueue");

} // namespace vibecore
