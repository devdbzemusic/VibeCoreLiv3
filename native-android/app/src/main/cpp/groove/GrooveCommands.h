#pragma once
/**
 * GrooveCommands.h — Commands from UI Thread to GrooveNode (Audio Thread).
 *
 * All commands pass through AudioThreadSafeQueue<GrooveCommand, 4096>.
 * Must be trivially copyable (checked by static_assert).
 *
 * UI-thread state changes (pattern edits, mute, scene switch, etc.)
 * must NEVER touch the audio-thread-owned state directly.
 * They always go through this command queue.
 *
 * Max payload size is 32 bytes to keep the queue memory reasonable.
 */

#include "GrooveTypes.h"
#include <cstdint>
#include <cstring>

namespace vibecore {

struct GrooveCommand {
    enum class Type : uint8_t {
        // Transport
        TransportPlay        = 0,
        TransportStop        = 1,
        SetPosition          = 2,   // int64Val = target tick

        // Tempo / Pattern timing
        SetSwing             = 10,  // trackIdx, int32Val=swing(0-100)
        SetHumanize          = 11,  // trackIdx, int32Val=humanize(0-100)
        SetStepSize          = 12,  // trackIdx, int32Val=ticks per step

        // Step edit
        SetStepActive        = 20,  // trackIdx, stepIdx, boolVal
        SetStepVelocity      = 21,  // trackIdx, stepIdx, int32Val
        SetStepNote          = 22,  // trackIdx, stepIdx, int32Val
        SetStepProbability   = 23,  // trackIdx, stepIdx, int32Val (0-100)
        SetStepMuted         = 24,  // trackIdx, stepIdx, boolVal
        SetStepAccent        = 25,  // trackIdx, stepIdx, boolVal
        SetStepRoll          = 26,  // trackIdx, stepIdx, int32Val=rollCount
        SetStepFlam          = 27,  // trackIdx, stepIdx, boolVal
        SetStepMicroTiming   = 28,  // trackIdx, stepIdx, int32Val=ticks

        // Pattern
        SetPatternLength     = 30,  // trackIdx, int32Val
        ClearPattern         = 31,  // trackIdx
        CopyPattern          = 32,  // trackIdx, srcBankIdx→srcBank, int32Val=dstBank
        LoadPattern          = 33,  // full pattern copy via patternData

        // Scene
        SetActiveScene       = 40,  // int32Val = scene index
        SetSceneBank         = 41,  // trackIdx, int32Val=bank
        QueueSceneChange     = 42,  // int32Val = target scene (applied on next bar)
        ConfigureSceneBank   = 43,  // stepIdx=scene, trackIdx=track, int32Val=bank

        // Track
        SetTrackMute         = 50,  // trackIdx, boolVal
        SetTrackSolo         = 51,  // trackIdx, boolVal
        SetTrackVolume       = 52,  // trackIdx, int32Val (0-127)
        SetTrackSample       = 53,  // trackIdx, int32Val=sampleId
        SetTrackMode         = 54,  // trackIdx, int32Val=TrackMode
        SetTrackPan          = 55,  // trackIdx, int32Val=-100..100

        // Piano Roll
        AddPianoRollNote     = 60,  // trackIdx, int64Val=startTick, int64Val2=endTick,
                                    // int32Val=note, int32Val2=velocity
        RemovePianoRollNote  = 61,  // trackIdx, int32Val=noteIndex
        ClearPianoRoll       = 62,  // trackIdx
        UpdatePianoRollNote  = 63,  // trackIdx, int32Val=noteIndex,
                                    // int64Val=startTick, int64Val2=endTick,
                                    // int32Val2=(velocity<<8)|note  — see makePianoRollUpdate

        // Sample assignment
        LoadSample           = 70,  // int32Val=sampleId, ptr in int64Val
    };

    Type    type        = Type::TransportStop;
    uint8_t trackIdx    = 0;
    uint8_t stepIdx     = 0;
    bool    boolVal     = false;
    uint8_t unused_     = 0;
    int32_t int32Val    = 0;
    int32_t int32Val2   = 0;
    int64_t int64Val    = 0;
    int64_t int64Val2   = 0;

    // Helper for piano roll note commands
    static GrooveCommand makePianoRollAdd(uint8_t track,
                                          int64_t startTick, int64_t endTick,
                                          uint8_t note, uint8_t vel) {
        GrooveCommand c;
        c.type     = Type::AddPianoRollNote;
        c.trackIdx = track;
        c.int64Val = startTick;
        c.int64Val2 = endTick;
        c.int32Val = note;
        c.int32Val2 = vel;
        return c;
    }

    /**
     * Canonical packing for UpdatePianoRollNote. The command struct has no
     * free 8-bit payload slot for velocity, so note and velocity share
     * int32Val2: bits 0-7 = note, bits 8-15 = velocity.
     * GrooveNode::handleCommand() MUST unpack with exactly this layout.
     */
    static GrooveCommand makePianoRollUpdate(uint8_t track, int32_t noteIndex,
                                             int64_t startTick, int64_t endTick,
                                             uint8_t note, uint8_t vel) {
        GrooveCommand c;
        c.type      = Type::UpdatePianoRollNote;
        c.trackIdx  = track;
        c.int32Val  = noteIndex;
        c.int64Val  = startTick;
        c.int64Val2 = endTick;
        c.int32Val2 = (static_cast<int32_t>(vel) << 8) |
                       static_cast<int32_t>(note);
        return c;
    }

    static GrooveCommand makeSetStep(uint8_t track, uint8_t step,
                                     bool active, uint8_t vel = 100) {
        GrooveCommand c;
        c.type     = Type::SetStepActive;
        c.trackIdx = track;
        c.stepIdx  = step;
        c.boolVal  = active;
        c.int32Val = vel;
        return c;
    }
};
static_assert(std::is_trivially_copyable<GrooveCommand>::value,
              "GrooveCommand must be trivially copyable");
static_assert(sizeof(GrooveCommand) <= 40);

} // namespace vibecore
