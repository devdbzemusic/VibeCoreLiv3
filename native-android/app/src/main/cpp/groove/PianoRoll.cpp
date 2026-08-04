#include "PianoRoll.h"
#include <algorithm>

namespace vibecore {

void PianoRoll::resetScan(int64_t absoluteTick) noexcept {
    mScanIndex = 0;
    mLastTick  = absoluteTick - 1;
    if (!mData.sorted) sortNotes();

    // Fast-forward scan index to absoluteTick
    while (mScanIndex < mData.noteCount &&
           mData.notes[mScanIndex].startTick < absoluteTick) {
        mScanIndex++;
    }
}

void PianoRoll::sortNotes() noexcept {
    if (mData.noteCount <= 1) { mData.sorted = true; return; }
    // Simple insertion sort — kMaxPianoRollNotes=512, called rarely (non-realtime)
    for (int32_t i = 1; i < mData.noteCount; ++i) {
        PianoRollNote key = mData.notes[i];
        int32_t j = i - 1;
        while (j >= 0 && mData.notes[j].startTick > key.startTick) {
            mData.notes[j + 1] = mData.notes[j];
            --j;
        }
        mData.notes[j + 1] = key;
    }
    mData.sorted = true;
}

void PianoRoll::onTick(int64_t absoluteTick,
                        int32_t sampleOffset,
                        int32_t trackIndex,
                        int32_t sampleId,
                        uint8_t chokeGroup,
                        TriggerQueue& queue) noexcept {
    if (mData.noteCount == 0) return;
    if (!mData.sorted) return;  // will be sorted at next non-realtime moment

    // Walk notes whose startTick <= absoluteTick
    while (mScanIndex < mData.noteCount) {
        const PianoRollNote& n = mData.notes[mScanIndex];
        if (!n.active || n.startTick > absoluteTick) break;

        // Fire this note
        Trigger t;
        t.sampleOffset = sampleOffset;
        t.sampleId     = sampleId;
        t.trackIndex   = static_cast<uint8_t>(trackIndex);
        t.note         = n.note;
        t.velocity     = n.velocity;
        t.chokeGroup   = chokeGroup;
        t.choke        = false;
        queue.push(t);

        mScanIndex++;
    }
    mLastTick = absoluteTick;
}

void PianoRoll::onLoop(int64_t loopStartTick) noexcept {
    if (!mData.sorted) sortNotes();
    mScanIndex = 0;
    mLastTick  = loopStartTick - 1;
}

int PianoRoll::addNote(int64_t startTick, int64_t endTick,
                        uint8_t note, uint8_t vel) noexcept {
    return mData.addNote(startTick, endTick, note, vel);
}

void PianoRoll::removeNote(int32_t index) noexcept {
    mData.removeNote(index);
    // Adjust scan index if removed note was before current position
    if (index < mScanIndex) mScanIndex = (mScanIndex > 0) ? mScanIndex - 1 : 0;
}

void PianoRoll::updateNote(int32_t index, int64_t startTick, int64_t endTick,
                            uint8_t note, uint8_t vel) noexcept {
    if (index < 0 || index >= mData.noteCount) return;
    mData.notes[index] = { startTick, endTick, note, vel, true, 0 };
    mData.sorted = false;
}

void PianoRoll::clear() noexcept {
    mData.clear();
    mScanIndex = 0;
    mLastTick  = -1;
}

} // namespace vibecore
