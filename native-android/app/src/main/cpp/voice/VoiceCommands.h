#pragma once
/**
 * VoiceCommands.h — Lock-free SPSC command types for VibeCore Voice.
 *
 * All commands are trivially copyable and fit in a fixed-size struct.
 * Sent from UI Thread → Audio Thread via AudioThreadSafeQueue.
 * Never allocated on heap. No virtuals.
 *
 * Sample data transport:
 *   SetSampleData carries a raw pointer to UI-thread-owned storage.
 *   Ownership stays with VoiceEngine (deferred-free protocol — see
 *   VoiceEngine::loadSample). The Audio Thread only reads the buffer.
 */

#include "VoiceTypes.h"

namespace vibecore {

enum class VoiceCommandType : uint8_t {
    // Mode
    SetGlobalMode      = 0,
    SetPolyMode        = 1,
    SetPlayMode        = 2,

    // Master
    SetVolume          = 10,
    SetDryWet          = 11,
    SetMonitor         = 12,
    SetGlideMs         = 13,
    SetActiveSlot      = 14,
    SetRootNote        = 15,

    // Pitch / Formant
    SetPitchSemitones  = 20,
    SetPitchEnabled    = 21,
    SetFormantSemitones= 22,
    SetFormantEnabled  = 23,

    // Harmonizer
    SetHarmonyVoice    = 30,   // index + def in payload
    SetHarmonyMaster   = 31,
    SetHarmonyEnabled  = 32,

    // Doubler
    SetDoubler         = 35,

    // Dynamics
    SetGate            = 40,
    SetDeEsser         = 41,
    SetCompressor      = 42,
    SetEQ              = 43,

    // Breath
    SetBreath          = 45,

    // Texture filter
    SetTextureCutoff   = 47,
    SetTextureRes      = 48,

    // Envelopes
    SetEnv0            = 50,
    SetEnv1            = 51,

    // LFOs
    SetLFO0            = 55,
    SetLFO1            = 56,

    // Macros
    SetMacro1          = 58,
    SetMacro2          = 59,

    // Modulation matrix
    SetModRoute        = 60,

    // 3D Stereo
    SetStereoWidth     = 65,
    SetStereoMidGain   = 66,
    SetStereoSideGain  = 67,
    SetStereoPan       = 68,
    SetStereoEnabled   = 69,

    // Triggers
    NoteOn             = 70,
    NoteOff            = 71,
    AllNotesOff        = 72,

    // Sample management
    SetSampleData      = 80,   // pointer + length + rate + root note
    ClearSample        = 81,
    SetSliceMarkers    = 82,

    // Live input
    SetLiveInputActive = 85,

    // Full parameter snapshot (preset load / undo / redo)
    SetAllParams       = 90,
};

struct VoiceCommand {
    VoiceCommandType type = VoiceCommandType::AllNotesOff;

    union Payload {
        struct { float value; }                        f32;
        struct { int32_t value; }                      i32;
        struct { uint8_t mode; }                       u8;

        struct { uint8_t index; VoiceHarmonyVoiceDef def; } harmony;
        struct { VoiceDoublerParams p; }               doubler;
        struct { VoiceGateParams p; }                  gate;
        struct { VoiceDeEsserParams p; }               deEsser;
        struct { VoiceCompressorParams p; }            compressor;
        struct { VoiceEQParams p; }                    eq;
        struct { VoiceBreathParams p; }                breath;
        struct { uint8_t envIndex; VoiceADSR adsr; }   env;
        struct { uint8_t lfoIndex; VoiceLFODef def; }  lfo;
        struct { uint8_t routeIndex; VoiceModRoute route; } modRoute;

        struct {
            uint8_t note, velocity;
            int8_t  slot, slice;
            bool    retrigger;
            int32_t sampleOffset;
        } trigger;

        struct {
            int32_t      slot;
            const float* data;         // UI-owned, deferred-free
            int32_t      lengthFrames;
            int32_t      sampleRate;
            int32_t      rootNote;
        } sample;

        struct {
            int32_t slot;
            int32_t count;
            int32_t start[kVoiceMaxSlices];
        } slices;

        struct { VoiceParams params; } allParams;

        Payload() { memset(this, 0, sizeof(Payload)); }
    } payload;

    VoiceCommand() { memset(&payload, 0, sizeof(payload)); }
};

static_assert(sizeof(VoiceCommand) <= 1024,
              "VoiceCommand must be small enough for queue transport");

} // namespace vibecore
