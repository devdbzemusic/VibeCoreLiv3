#pragma once
/**
 * TickEvent.h — Timing event dispatched from VibeCoreSync to AudioNodes.
 *
 * One TickEvent is generated for each musically significant moment within
 * an audio callback. The sampleOffset field gives the exact sample position
 * within the current callback buffer where this event occurs.
 *
 * At maximum BPM (300) and minimum buffer size (96 frames at 48 kHz):
 *   samplesPerTick = 48000 * 60 / (300 * 1920) = 5.0 samples/tick
 *   ticks per callback = 96 / 5 ≈ 20
 *
 * kMaxEventsPerCallback = 64 provides a safe margin.
 *
 * All TickEvents are allocated in a fixed-size array on the stack.
 * Zero heap allocation.
 */

#include "MusicalPosition.h"
#include <array>
#include <cstdint>

namespace vibecore {

static constexpr int32_t kMaxEventsPerCallback = 64;

struct TickEvent {
    enum class Type : uint8_t {
        TransportStart = 0,  // transport started this callback
        TransportStop  = 1,  // transport stopped this callback
        TempoChanged   = 2,  // BPM changed — position is at change point
        Tick           = 3,  // every PPQ pulse
        Beat           = 4,  // tick falls on a beat (tick % PPQ == 0)
        Bar            = 5,  // tick falls on a bar (beat == 0 && tick == 0)
        Loop           = 6,  // loop restart — position is loop start
    };

    Type            type;
    int32_t         sampleOffset;   // sample index within the current callback [0..numFrames-1]
    int64_t         absoluteTick;   // absolute tick from transport start
    MusicalPosition position;       // bar/beat/tick breakdown
    double          bpm;            // BPM at this event (relevant for TempoChanged)
    int64_t         loopCount;      // how many times the loop has wrapped (for Loop events)
};

/**
 * Fixed-size container for TickEvents generated in one audio callback.
 * Lives on the stack in VibeCoreSync::processCallback().
 * Never dynamically allocated.
 */
struct TickEventBuffer {
    std::array<TickEvent, kMaxEventsPerCallback> events;
    int32_t count = 0;

    void clear() noexcept { count = 0; }

    bool push(const TickEvent& e) noexcept {
        if (count >= kMaxEventsPerCallback) return false;
        events[count++] = e;
        return true;
    }

    const TickEvent* begin() const noexcept { return events.data(); }
    const TickEvent* end()   const noexcept { return events.data() + count; }
};

} // namespace vibecore
