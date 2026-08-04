#pragma once
/**
 * VoiceTypes.h — All data types for VibeCore Voice (Phase 6).
 *
 * Thread model:
 *   All types are trivially copyable and POD-safe for queue transport.
 *   No heap, no virtuals, no STL containers in audio-thread types.
 *
 * Voice operating modes (VoiceGlobalMode):
 *   Live       — microphone input, live monitoring, dry/wet
 *   Sample     — vocal clip playback, sample-accurate, loop/one-shot/slice
 *   Instrument — tonally playable voice layers, mono/legato/poly
 *   Texture    — breath/noise/air layer synthesis
 */

#include <cstdint>
#include <cstring>

namespace vibecore {

// ─── Limits ───────────────────────────────────────────────────────────────────

static constexpr int kVoiceMaxUnits        = 8;     // polyphonic voice units
static constexpr int kVoiceMaxLFOs         = 2;
static constexpr int kVoiceMaxEnvelopes    = 2;
static constexpr int kVoiceModRoutes       = 16;
static constexpr int kVoiceCommandCapacity = 256;   // SPSC queue depth
static constexpr int kVoiceHarmonyVoices   = 4;
static constexpr int kVoiceSampleSlots     = 8;
static constexpr int kVoiceMaxSlices       = 16;
static constexpr int kVoiceShiftBufSize    = 8192;  // pitch-shifter delay line (power of 2)
static constexpr int kVoiceFormantBands    = 4;     // formant filter bank size

// ─── Enumerations ─────────────────────────────────────────────────────────────

enum class VoiceGlobalMode : uint8_t {
    Live       = 0,
    Sample     = 1,
    Instrument = 2,
    Texture    = 3,
};

enum class VoicePolyMode : uint8_t {
    Mono   = 0,
    Legato = 1,
    Poly4  = 2,
    Poly8  = 3,
};

enum class VoicePlayMode : uint8_t {
    OneShot = 0,
    Loop    = 1,
    Slice   = 2,
};

enum class VoiceLFOShape : uint8_t {
    Sine       = 0,
    Triangle   = 1,
    Saw        = 2,
    Square     = 3,
    SampleHold = 4,
};

enum class VoiceLFOSync : uint8_t {
    Free = 0,
    Beat = 1,
    Bar  = 2,
};

enum class VoiceModSource : uint8_t {
    Env1        = 0,
    Env2        = 1,
    LFO1        = 2,
    LFO2        = 3,
    Velocity    = 4,
    KeyTracking = 5,
    Macro1      = 6,   // ribbon / macro assignment 1
    Macro2      = 7,   // ribbon / macro assignment 2
    None        = 0xFF,
};

enum class VoiceModDest : uint8_t {
    Pitch        = 0,   // cents
    Formant      = 1,   // semitones
    Cutoff       = 2,   // Hz (texture filter)
    Volume       = 3,   // linear gain
    Pan          = 4,
    HarmonyLevel = 5,
    BreathLevel  = 6,
    StereoWidth  = 7,
    None         = 0xFF,
};

enum class VoiceUnitState : uint8_t {
    Idle    = 0,
    Attack  = 1,
    Decay   = 2,
    Sustain = 3,
    Release = 4,
};

// ─── ADSR ─────────────────────────────────────────────────────────────────────

struct VoiceADSR {
    float attackMs       = 5.0f;
    float decayMs        = 120.0f;
    float sustain        = 0.8f;
    float releaseMs      = 250.0f;
    float velocityAmount = 1.0f;
};

struct VoiceEnvState {
    VoiceUnitState stage    = VoiceUnitState::Idle;
    float          value    = 0.0f;
    float          velocity = 1.0f;

    void reset() noexcept { stage = VoiceUnitState::Idle; value = 0.0f; velocity = 1.0f; }
};

// ─── LFO ──────────────────────────────────────────────────────────────────────

struct VoiceLFODef {
    VoiceLFOShape shape     = VoiceLFOShape::Sine;
    VoiceLFOSync  sync      = VoiceLFOSync::Free;
    float         rateHz    = 1.0f;
    float         depth     = 0.5f;
    float         phase     = 0.0f;
    bool          retrigger = true;
};

struct VoiceLFOState {
    float phaseAccum = 0.0f;
    float phaseInc   = 0.0f;
    float value      = 0.0f;
    float shValue    = 0.0f;   // sample & hold latch
    uint32_t rng     = 0x9E3779B9;

    void reset(float startPhase = 0.0f) noexcept {
        phaseAccum = startPhase;
        value = shValue = 0.0f;
    }
};

// ─── Modulation route ─────────────────────────────────────────────────────────

struct VoiceModRoute {
    VoiceModSource source = VoiceModSource::None;
    VoiceModDest   dest   = VoiceModDest::None;
    float          amount = 0.0f;   // –1 … +1
    bool           active = false;
};

// ─── Pitch / Formant / Harmonizer ─────────────────────────────────────────────

struct VoicePitchParams {
    float pitchSemitones   = 0.0f;   // –24 … +24
    float formantSemitones = 0.0f;   // –12 … +12
    bool  pitchEnabled     = false;
    bool  formantEnabled   = false;
};

struct VoiceHarmonyVoiceDef {
    float semitones = 0.0f;
    float level     = 0.0f;   // 0–1 (0 = off)
    float pan       = 0.0f;   // –1 … +1
};

struct VoiceHarmonizerParams {
    VoiceHarmonyVoiceDef voices[kVoiceHarmonyVoices] = {};
    float masterLevel = 0.8f;
    bool  enabled     = false;
};

struct VoiceDoublerParams {
    float detuneCents = 12.0f;  // ± detune of the two doubles
    float level       = 0.0f;   // 0 = off
    float widthSpread = 0.8f;   // stereo spread of doubles
    bool  enabled     = false;
};

// ─── Dynamics ─────────────────────────────────────────────────────────────────

struct VoiceGateParams {
    float thresholdDb = -50.0f;
    float attackMs    = 1.0f;
    float releaseMs   = 80.0f;
    bool  enabled     = false;
};

struct VoiceDeEsserParams {
    float frequencyHz = 6200.0f;
    float thresholdDb = -28.0f;
    float amount      = 0.5f;   // 0–1 reduction depth
    bool  enabled     = false;
};

struct VoiceCompressorParams {
    float thresholdDb = -18.0f;
    float ratio       = 3.0f;   // 1–20
    float attackMs    = 8.0f;
    float releaseMs   = 120.0f;
    float makeupDb    = 0.0f;
    bool  enabled     = false;
};

struct VoiceEQParams {
    float lowShelfHz    = 120.0f;
    float lowGainDb     = 0.0f;
    float midHz         = 1200.0f;
    float midGainDb     = 0.0f;
    float midQ          = 0.9f;
    float highShelfHz   = 8000.0f;
    float highGainDb    = 0.0f;
    bool  enabled       = false;
};

// ─── Breath / Noise layer ─────────────────────────────────────────────────────

struct VoiceBreathParams {
    float level      = 0.0f;    // 0 = off
    float colorHz    = 3500.0f; // bandpass center of breath noise
    float widthQ     = 0.8f;
    bool  followEnv  = true;    // gated by amp envelope in Instrument/Texture mode
    bool  enabled    = false;
};

// ─── 3D Stereo (voice-owned copy — same semantics as platform stereo stage) ──

struct Voice3DParams {
    float stereoWidth = 1.0f;   // 0 = mono, 1 = normal, 2 = extra wide
    float pan         = 0.0f;
    float midGain     = 1.0f;
    float sideGain    = 1.0f;
    bool  enabled     = true;
};

// ─── Sample slot metadata ─────────────────────────────────────────────────────

struct VoiceSampleInfo {
    int32_t lengthFrames = 0;
    int32_t sampleRate   = 48000;
    int32_t rootNote     = 60;
    int32_t sliceCount   = 0;
    int32_t sliceStart[kVoiceMaxSlices] = {};
    bool    loaded       = false;
};

// ─── Trigger ──────────────────────────────────────────────────────────────────

struct VoiceTrigger {
    uint8_t  note          = 60;
    uint8_t  velocity      = 100;
    int8_t   sampleSlot    = -1;   // –1 = current slot
    int8_t   sliceIndex    = -1;   // –1 = play from start
    bool     noteOn        = true;
    bool     retrigger     = true;
    int32_t  sampleOffset  = 0;    // sample-accurate offset within buffer
};

// ─── VoiceParams — full module parameter set ─────────────────────────────────

struct VoiceParams {
    // Mode
    VoiceGlobalMode mode        = VoiceGlobalMode::Instrument;
    VoicePolyMode   polyMode    = VoicePolyMode::Poly8;
    VoicePlayMode   playMode    = VoicePlayMode::OneShot;

    // Master
    float   volume   = 0.85f;
    float   dryWet   = 1.0f;    // Live mode dry/wet (0 = dry, 1 = wet)
    float   monitor  = 1.0f;    // Live mode monitor level
    float   glideMs  = 0.0f;
    int32_t activeSampleSlot = 0;
    int32_t rootNote = 60;

    // DSP
    VoicePitchParams      pitch      = {};
    VoiceHarmonizerParams harmonizer = {};
    VoiceDoublerParams    doubler    = {};
    VoiceGateParams       gate       = {};
    VoiceDeEsserParams    deEsser    = {};
    VoiceCompressorParams compressor = {};
    VoiceEQParams         eq         = {};
    VoiceBreathParams     breath     = {};
    Voice3DParams         stereo3D   = {};

    // Texture mode filter
    float textureCutoffHz  = 2500.0f;
    float textureResonance = 0.3f;

    // Envelopes
    VoiceADSR env0 = { 5.0f, 120.0f, 0.8f, 250.0f, 1.0f };   // amp
    VoiceADSR env1 = { 20.0f, 300.0f, 0.4f, 500.0f, 0.5f };  // mod

    // LFOs
    VoiceLFODef lfo0 = {};
    VoiceLFODef lfo1 = {};

    // Macros (ribbon assignments)
    float macro1 = 0.0f;
    float macro2 = 0.0f;

    // Modulation matrix
    VoiceModRoute modMatrix[kVoiceModRoutes] = {};
};

// ─── UIVoiceState — UI-Thread mirror ──────────────────────────────────────────

struct UIVoiceState {
    VoiceParams     params = {};
    VoiceSampleInfo samples[kVoiceSampleSlots] = {};
    int32_t         activeUnits = 0;
    float           outputLevel = 0.0f;
    float           inputLevel  = 0.0f;
};

} // namespace vibecore
