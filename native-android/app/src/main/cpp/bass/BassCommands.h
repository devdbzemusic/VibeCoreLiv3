#pragma once
/**
 * BassCommands.h — Lock-free SPSC command types for VibeCore 3D Bass.
 *
 * All commands are trivially copyable and fit in a fixed-size struct.
 * Sent from UI Thread → Audio Thread via AudioThreadSafeQueue.
 * Never allocated on heap. No virtuals.
 */

#include "BassTypes.h"

namespace vibecore {

enum class BassCommandType : uint8_t {
    // Oscillator
    SetWaveform     = 0,
    SetMorphPos     = 1,
    SetDetune       = 2,
    SetOctave       = 3,
    SetSemi         = 4,
    SetFine         = 5,

    // Voice
    SetVoiceMode    = 10,
    SetGlideMs      = 11,
    SetVolume       = 12,
    SetPan          = 13,

    // Filter
    SetFilterType   = 20,
    SetCutoff       = 21,
    SetResonance    = 22,
    SetFilterDrive  = 23,

    // Envelope 0 (Amp)
    SetEnv0Attack   = 30,
    SetEnv0Decay    = 31,
    SetEnv0Sustain  = 32,
    SetEnv0Release  = 33,
    SetEnv0VelAmt   = 34,

    // Envelope 1 (Mod)
    SetEnv1Attack   = 35,
    SetEnv1Decay    = 36,
    SetEnv1Sustain  = 37,
    SetEnv1Release  = 38,
    SetEnv1VelAmt   = 39,

    // LFO 0
    SetLFO0Shape    = 40,
    SetLFO0Rate     = 41,
    SetLFO0Depth    = 42,
    SetLFO0Sync     = 43,
    SetLFO0Retrig   = 44,

    // LFO 1
    SetLFO1Shape    = 45,
    SetLFO1Rate     = 46,
    SetLFO1Depth    = 47,
    SetLFO1Sync     = 48,
    SetLFO1Retrig   = 49,

    // Modulation matrix
    SetModRoute     = 50,   // route index in payload

    // 3D Stereo
    SetStereoWidth  = 60,
    SetStereoMidGain= 61,
    SetStereoSideGain=62,
    SetStereoEnabled= 63,

    // Trigger (from Groove integration or direct)
    NoteOn          = 70,
    NoteOff         = 71,
    AllNotesOff     = 72,

    // Full parameter snapshot (e.g. preset load)
    SetAllParams    = 80,
};

struct BassCommand {
    BassCommandType type = BassCommandType::AllNotesOff;

    union Payload {
        // Oscillator
        struct { BassWaveform waveform; }          waveform;
        struct { float value; }                    f32;
        struct { int32_t value; }                  i32;

        // Voice mode
        struct { BassVoiceMode mode; }             voiceMode;

        // Filter
        struct { BassFilterType type; }            filterType;

        // Envelope
        struct {
            uint8_t envIndex;
            float   attackMs, decayMs, sustain, releaseMs, velAmount;
        } env;

        // LFO
        struct {
            uint8_t lfoIndex;
            BassLFOShape shape;
            BassLFOSync  sync;
            float rateHz, depth, phase;
            bool retrigger;
        } lfo;

        // Mod route
        struct {
            uint8_t      routeIndex;
            BassModRoute route;
        } modRoute;

        // 3D stereo
        struct { Bass3DParams params; } stereo3D;

        // Trigger
        struct {
            uint8_t  note, velocity;
            bool     retrigger;
            int32_t  sampleOffset;
            float    glideFromPitch;
        } trigger;

        // All params
        struct { BassParams params; } allParams;

        Payload() { memset(this, 0, sizeof(Payload)); }
    } payload;

    BassCommand() { memset(&payload, 0, sizeof(payload)); }
};

static_assert(sizeof(BassCommand) <= 1024,
              "BassCommand must be small enough for queue transport");

} // namespace vibecore
