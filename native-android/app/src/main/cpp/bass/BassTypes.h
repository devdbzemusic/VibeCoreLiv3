#pragma once
/**
 * BassTypes.h — All data types for VibeCore 3D Bass.
 *
 * Thread model:
 *   All types are trivially copyable and POD-safe for queue transport.
 *   No heap, no virtuals, no STL containers.
 *
 * Wavetable layout:
 *   kWavetableSize = 2048 samples per table
 *   kWavetableMips = 11 mip levels (1, 2, 4, 8 … 1024 sample cycles)
 *   kNumWavetables = 8 built-in waveforms
 */

#include <cstdint>
#include <cstring>
#include <array>

namespace vibecore {

// ─── Limits ────────────────────────────────────────────────────────────────────

static constexpr int kBassMaxVoices       = 16;
static constexpr int kBassMaxMipLevels    = 11;
static constexpr int kWavetableSize       = 2048;    // samples per mip-level 0
static constexpr int kNumBuiltinWavetables= 8;
static constexpr int kBassMaxLFOs         = 2;
static constexpr int kBassMaxEnvelopes    = 2;
static constexpr int kBassModRoutes       = 16;      // modulation matrix routes
static constexpr int kBassCommandCapacity = 256;     // SPSC queue depth

// ─── Enumerations ─────────────────────────────────────────────────────────────

enum class BassWaveform : uint8_t {
    Sine       = 0,
    Triangle   = 1,
    Saw        = 2,
    ReverseSaw = 3,
    Square     = 4,
    Pulse25    = 5,
    // Wavetable slots 6–7 reserved for user wavetables
    Custom0    = 6,
    Custom1    = 7,
};

enum class BassVoiceMode : uint8_t {
    Mono    = 0,  // one voice, note priority = last
    Legato  = 1,  // retrigger only on note-off, glide
    Poly4   = 2,  // 4-voice polyphony (prepared)
    Poly8   = 3,  // 8-voice polyphony (prepared)
};

enum class BassFilterType : uint8_t {
    Lowpass  = 0,
    Highpass = 1,
    Bandpass = 2,
    Notch    = 3,
    // Prepared:
    Ladder   = 4,
    SVF      = 5,
    Morph    = 6,
};

enum class BassLFOShape : uint8_t {
    Sine     = 0,
    Triangle = 1,
    Saw      = 2,
    Square   = 3,
    SampleHold = 4,
};

enum class BassLFOSync : uint8_t {
    Free = 0,
    Beat = 1,
    Bar  = 2,
};

enum class BassModSource : uint8_t {
    Env1        = 0,
    Env2        = 1,
    LFO1        = 2,
    LFO2        = 3,
    Velocity    = 4,
    KeyTracking = 5,
    ModWheel    = 6,
    Aftertouch  = 7,
    None        = 0xFF,
};

enum class BassModDest : uint8_t {
    Pitch       = 0,   // cents
    Cutoff      = 1,   // Hz
    Resonance   = 2,   // 0–1
    WavePos     = 3,   // morph position
    Volume      = 4,   // linear gain
    StereoWidth = 5,   // 0–2
    Glide       = 6,   // glide time ms
    FilterDrive = 7,
    None        = 0xFF,
};

enum class BassVoiceState : uint8_t {
    Idle    = 0,
    Attack  = 1,
    Decay   = 2,
    Sustain = 3,
    Release = 4,
};

// ─── Wavetable ─────────────────────────────────────────────────────────────────

struct WavetableFrame {
    // One band-limited mip level: samples at kWavetableSize >> mip points
    // mip 0 = 2048 samples, mip 1 = 1024, … mip 10 = 2 samples
    float samples[kWavetableSize] = {};
    int32_t validSamples = kWavetableSize;  // kWavetableSize >> mipLevel
};

struct WavetableDef {
    BassWaveform waveform = BassWaveform::Sine;
    // Mip pyramid: mip[0] is full-resolution, mip[10] is 2-sample
    // All pre-computed at engine init — never on audio thread
    WavetableFrame mips[kBassMaxMipLevels] = {};
    bool ready = false;
};

// ─── Envelope ─────────────────────────────────────────────────────────────────

struct BassADSR {
    float attackMs  = 5.0f;
    float decayMs   = 100.0f;
    float sustain   = 0.7f;   // 0–1
    float releaseMs = 200.0f;
    float velocityAmount = 1.0f;  // 0 = fixed, 1 = full velocity scaling
};

// Per-voice envelope runtime state — audio thread only
struct BassEnvelopeState {
    BassVoiceState stage  = BassVoiceState::Idle;
    float          value  = 0.0f;
    float          coeff  = 0.0f;  // per-sample delta or multiplier
    float          target = 0.0f;
    float          velocity = 1.0f;

    void reset() noexcept {
        stage = BassVoiceState::Idle;
        value = coeff = target = 0.0f;
        velocity = 1.0f;
    }
};

// ─── LFO ──────────────────────────────────────────────────────────────────────

struct BassLFODef {
    BassLFOShape shape      = BassLFOShape::Sine;
    BassLFOSync  sync       = BassLFOSync::Free;
    float        rateHz     = 1.0f;
    float        depth      = 0.5f;   // 0–1
    float        phase      = 0.0f;   // start phase 0–1
    bool         retrigger  = true;   // retrigger on note-on
};

struct BassLFOState {
    float phaseAccum = 0.0f;  // 0–1
    float phaseInc   = 0.0f;  // per-sample increment
    float value      = 0.0f;

    void reset(float startPhase = 0.0f) noexcept {
        phaseAccum = startPhase;
        value = 0.0f;
    }
};

// ─── Modulation Route ─────────────────────────────────────────────────────────

struct BassModRoute {
    BassModSource source = BassModSource::None;
    BassModDest   dest   = BassModDest::None;
    float         amount = 0.0f;   // –1 to +1
    bool          active = false;
};

// ─── Filter state ─────────────────────────────────────────────────────────────

struct BiqFilterCoeffs {
    // Direct Form 2 biquad: y = b0*x + b1*x1 + b2*x2 – a1*y1 – a2*y2
    float b0 = 1.0f, b1 = 0.0f, b2 = 0.0f;
    float a1 = 0.0f, a2 = 0.0f;
};

struct BiqFilterState {
    float x1 = 0.0f, x2 = 0.0f;
    float y1 = 0.0f, y2 = 0.0f;

    void reset() noexcept { x1 = x2 = y1 = y2 = 0.0f; }

    inline float process(float x, const BiqFilterCoeffs& c) noexcept {
        float y = c.b0*x + c.b1*x1 + c.b2*x2 - c.a1*y1 - c.a2*y2;
        x2 = x1; x1 = x;
        y2 = y1; y1 = y;
        return y;
    }
};

// ─── 3D Stereo ────────────────────────────────────────────────────────────────

struct Bass3DParams {
    float stereoWidth = 1.0f;   // 0 = mono, 1 = normal, 2 = extra wide
    float pan         = 0.0f;   // –1 left, 0 center, +1 right
    float midGain     = 1.0f;   // M/S mid gain
    float sideGain    = 1.0f;   // M/S side gain
    bool  enabled     = true;
};

// ─── Voice Trigger ────────────────────────────────────────────────────────────

struct BassTrigger {
    int32_t   voiceIndex     = -1;   // –1 = auto-allocate
    uint8_t   note           = 60;
    uint8_t   velocity       = 100;
    bool      noteOn         = true;
    bool      retrigger      = true;
    int32_t   sampleOffset   = 0;    // sample-accurate offset within buffer
    float     glideFromPitch = -1.0f; // –1 = no glide
};

// ─── Per-Voice Runtime State (Audio Thread) ───────────────────────────────────

struct BassVoice {
    // Phase accumulator (0–kWavetableSize as float for sub-sample accuracy)
    double          phaseAccum  = 0.0;
    double          phaseInc    = 0.0;   // samples per sample (frequency / sampleRate * kWavetableSize)

    // Glide
    float           currentPitch= 0.0f;  // Hz
    float           targetPitch = 0.0f;
    float           glideCoeff  = 1.0f;  // per-sample multiplier toward target

    // Wavetable morph position (0 = first table, 1 = second, etc.)
    float           morphPos    = 0.0f;

    // Envelopes
    BassEnvelopeState env[kBassMaxEnvelopes] = {};

    // LFO states
    BassLFOState      lfo[kBassMaxLFOs] = {};

    // Filter states (one per channel for stereo)
    BiqFilterState    filterL    = {};
    BiqFilterState    filterR    = {};

    // Live values
    uint8_t           note       = 60;
    uint8_t           velocity   = 100;
    BassVoiceState    state      = BassVoiceState::Idle;
    int32_t           ageFrames  = 0;    // for deterministic stealing
    float             gain       = 0.0f; // envelope * velocity * volume
    float             pan        = 0.0f; // –1..+1

    bool isActive() const noexcept { return state != BassVoiceState::Idle; }

    void reset() noexcept {
        phaseAccum = phaseInc = 0.0;
        currentPitch = targetPitch = 0.0f;
        glideCoeff = 1.0f;
        morphPos = 0.0f;
        for (auto& e : env) e.reset();
        for (auto& l : lfo) l.reset();
        filterL.reset(); filterR.reset();
        note = 60; velocity = 100;
        state = BassVoiceState::Idle;
        ageFrames = 0;
        gain = 0.0f; pan = 0.0f;
    }
};

// ─── BassParams — full synth parameter set ────────────────────────────────────
// All parameters live on UI Thread (via UIBassState).
// Audio Thread receives them via BassCommands.

struct BassParams {
    // Oscillator
    BassWaveform    waveform     = BassWaveform::Saw;
    float           morphPos     = 0.0f;  // 0–7 (between wavetable frames)
    float           detune       = 0.0f;  // cents
    float           octave       = 0;
    float           semi         = 0.0f;
    float           fine         = 0.0f;  // cents ±100

    // Voice
    BassVoiceMode   voiceMode    = BassVoiceMode::Mono;
    float           glideMs      = 0.0f;  // 0 = off
    float           volume       = 0.8f;  // 0–1
    float           pan          = 0.0f;  // –1..+1

    // Filter
    BassFilterType  filterType   = BassFilterType::Lowpass;
    float           cutoffHz     = 8000.0f;
    float           resonance    = 0.0f;  // 0–1
    float           filterDrive  = 0.0f;  // 0–1

    // Envelope 0 (Amp)
    BassADSR        env0         = { 5.0f, 100.0f, 0.7f, 200.0f, 1.0f };
    // Envelope 1 (Filter / Mod)
    BassADSR        env1         = { 10.0f, 200.0f, 0.3f, 400.0f, 0.5f };

    // LFOs
    BassLFODef      lfo0         = {};
    BassLFODef      lfo1         = {};

    // Modulation matrix
    BassModRoute    modMatrix[kBassModRoutes] = {};

    // 3D Stereo
    Bass3DParams    stereo3D     = {};
};

// ─── UIBassState — UI-Thread mirror ───────────────────────────────────────────

struct UIBassState {
    BassParams params = {};
    int32_t    activeVoices = 0;  // approximate (atomic read)
    float      outputLevel  = 0.0f; // VU meter approximation
};

} // namespace vibecore
