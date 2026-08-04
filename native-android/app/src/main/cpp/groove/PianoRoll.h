#pragma once
/**
 * PianoRoll.h — Note data model and real-time note scheduler for VibeCore Groove.
 *
 * The Piano Roll is an integral part of the Groove Engine — not a separate module.
 * It stores note events (startTick, endTick, note, velocity) per track and
 * dispatches them as Triggers on the Audio Thread via onTick().
 *
 * Modes:
 *   Drum   — notes map to pads (note number = pad index)
 *   Bass   — monophonic / polyphonic melodic notes
 *   Synth  — polyphonic melodic notes
 *   Sample — polyphonic sample triggering with pitch
 *
 * Real-time editing:
 *   Notes added/removed via GrooveCommand queue.
 *   The audio-thread sort flag ensures notes are sorted before the next
 *   scheduler pass (sort happens in onBar or at transport start — never
 *   inside the hot tick path).
 *
 * Scheduling algorithm:
 *   Notes are sorted by startTick ascending.
 *   mScanIndex points to the first note not yet considered.
 *   onTick() walks forward from mScanIndex while startTick <= absoluteTick.
 *   For loop/restart: mScanIndex is reset to 0, and notes are re-scanned.
 *
 * AUDIO THREAD: only onTick(), reset(), sort() — all zero-allocation.
 * UI THREAD: addNote(), removeNote(), clear() — via GrooveCommand queue,
 *            applied by GrooveNode on Audio Thread.
 */

#include "GrooveTypes.h"
#include "TriggerQueue.h"
#include <array>
#include <algorithm>
#include <cstdint>

namespace vibecore {

class PianoRoll {
public:
    PianoRoll() = default;

    // ── Audio Thread operations ───────────────────────────────────────────

    /** Called at transport start or loop restart. */
    void resetScan(int64_t absoluteTick) noexcept;

    /** Sort notes by startTick. Called on Audio Thread, non-realtime moments only. */
    void sortNotes() noexcept;

    /**
     * Called from GrooveNode::onTick().
     * Scans forward and pushes Triggers for any note whose startTick
     * falls within [lastTick, absoluteTick].
     */
    void onTick(int64_t absoluteTick,
                int32_t sampleOffset,
                int32_t trackIndex,
                int32_t sampleId,
                uint8_t chokeGroup,
                TriggerQueue& queue) noexcept;

    /** Called on loop: re-sort and reset scan pointer. */
    void onLoop(int64_t loopStartTick) noexcept;

    // ── Data mutations (applied on Audio Thread via GrooveCommand) ────────

    int  addNote(int64_t startTick, int64_t endTick, uint8_t note, uint8_t vel) noexcept;
    void removeNote(int32_t index) noexcept;
    void updateNote(int32_t index, int64_t startTick, int64_t endTick,
                    uint8_t note, uint8_t vel) noexcept;
    void clear() noexcept;

    // ── Query ──────────────────────────────────────────────────────────────
    int32_t noteCount() const noexcept { return mData.noteCount; }
    const PianoRollNote& note(int32_t i) const noexcept { return mData.notes[i]; }
    bool needsSort() const noexcept { return !mData.sorted; }

private:
    PianoRollData mData          = {};
    int32_t       mScanIndex     = 0;
    int64_t       mLastTick      = -1;

    static bool noteLessThan(const PianoRollNote& a, const PianoRollNote& b) noexcept {
        return a.startTick < b.startTick;
    }
};

} // namespace vibecore
