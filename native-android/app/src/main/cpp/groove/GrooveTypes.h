#pragma once
/**
 * GrooveTypes.h — All data types for the VibeCore Groove Engine.
 *
 * Design constraints (enforced throughout):
 *   · All arrays are fixed-size — no std::vector, no new/delete
 *   · All structs are trivially copyable or explicitly zeroed
 *   · Read/write on Audio Thread: only via dedicated mAT (AudioThreadState) copies
 *   · PPQ = 1920 (from MusicalPosition.h)
 *
 * Step grid math:
 *   1/16 note = PPQ / 4   = 480 ticks
 *   1/8  note = PPQ / 2   = 960 ticks
 *   1/4  note = PPQ       = 1920 ticks
 *   1/32 note = PPQ / 8   = 240 ticks
 *   Swing delay (odd step offset) = swingAmount * stepTicks / 200
 */

#include <cstdint>
#include <array>
#include <cstring>

namespace vibecore {

// ─── Constants ────────────────────────────────────────────────────────────────

static constexpr int kMaxTracks          = 16;
static constexpr int kMaxSteps           = 64;    // per pattern
static constexpr int kMaxPatternsPerBank = 64;    // per track
static constexpr int kMaxScenes          = 32;
static constexpr int kMaxChainSteps      = 64;
static constexpr int kMaxVoices          = 64;
static constexpr int kMaxSamples         = 128;
static constexpr int kMaxPianoRollNotes  = 512;   // per track
static constexpr int kMaxRollHits        = 8;
static constexpr int kMaxTriggers        = 256;   // per-callback trigger queue

static constexpr int kDefaultStepTicks   = 480;   // 1/16 note at PPQ=1920
static constexpr int kMaxMicroTiming     = 240;   // ±1/8 of a 1/16 step

// ─── Track modes ─────────────────────────────────────────────────────────────

enum class TrackMode : uint8_t {
    Drum   = 0,
    Bass   = 1,
    Synth  = 2,
    Sample = 3,
    Voice  = 4,   // Phase 6 — routed to VoiceNode
};

// ─── Step ─────────────────────────────────────────────────────────────────────

struct Step {
    bool    active        = false;
    bool    muted         = false;
    bool    accent        = false;
    bool    flam          = false;
    uint8_t note          = 60;     // MIDI note 0–127
    uint8_t velocity      = 100;    // 0–127
    uint8_t probability   = 100;    // 0–100 (100 = always fire)
    uint8_t rollCount     = 0;      // 0 = no roll, 1–8 extra hits
    int16_t microTiming   = 0;      // ±kMaxMicroTiming ticks
    int16_t flamOffset    = 40;     // ticks before main hit (positive = earlier)
    int16_t rollSpacingTicks = 240; // ticks between roll hits
    uint8_t accentVelocity = 127;   // velocity when accent is on
    uint8_t unused_       = 0;
};
static_assert(sizeof(Step) == 16, "Step must be 16 bytes");

// ─── Pattern ──────────────────────────────────────────────────────────────────

struct Pattern {
    std::array<Step, kMaxSteps> steps = {};
    int32_t length         = 16;    // active steps (1–kMaxSteps)
    int32_t stepSizeTicks  = kDefaultStepTicks;
    uint8_t swing          = 0;     // 0–100: % of stepSizeTicks added to odd steps
    uint8_t humanize       = 0;     // 0–100: random micro-timing jitter amount
    uint8_t unused_[2]     = {};

    void clear() { *this = Pattern{}; }
    bool isEmpty() const {
        for (int i = 0; i < length; ++i) if (steps[i].active) return false;
        return true;
    }
};

// ─── Piano Roll Note ─────────────────────────────────────────────────────────

struct PianoRollNote {
    int64_t startTick = 0;
    int64_t endTick   = 0;    // 0 means same as startTick + stepSizeTicks
    uint8_t note      = 60;
    uint8_t velocity  = 100;
    bool    active    = false;
    uint8_t unused_   = 0;
};
static_assert(sizeof(PianoRollNote) == 24);

// ─── Piano Roll (per track) ───────────────────────────────────────────────────

struct PianoRollData {
    std::array<PianoRollNote, kMaxPianoRollNotes> notes = {};
    int32_t noteCount  = 0;
    bool    sorted     = false;   // flag: needs sort before next use

    void clear() { *this = PianoRollData{}; }

    int addNote(int64_t startTick, int64_t endTick, uint8_t note, uint8_t vel) {
        if (noteCount >= kMaxPianoRollNotes) return -1;
        int idx = noteCount++;
        notes[idx] = { startTick, endTick, note, vel, true, 0 };
        sorted = false;
        return idx;
    }

    void removeNote(int idx) {
        if (idx < 0 || idx >= noteCount) return;
        notes[idx] = notes[--noteCount];
        notes[noteCount] = {};
        sorted = false;
    }
};

// ─── Track ────────────────────────────────────────────────────────────────────

struct Track {
    std::array<Pattern, kMaxPatternsPerBank> patterns = {};
    PianoRollData pianoRoll = {};
    TrackMode mode         = TrackMode::Drum;
    int32_t   activeBank   = 0;
    int32_t   sampleId     = -1;   // sample assigned to this track (-1 = none)
    uint8_t   volume       = 100;  // 0–127
    int8_t    pan          = 0;    // -100 left, 0 center, +100 right
    uint8_t   chokeGroup   = 0;    // 0 = no choke, 1–8 = choke group
    bool      muted        = false;
    bool      soloed       = false;
    uint8_t   unused_[1]   = {};

    Pattern& activePattern()             { return patterns[activeBank]; }
    const Pattern& activePattern() const { return patterns[activeBank]; }
};

// ─── Scene ────────────────────────────────────────────────────────────────────

struct Scene {
    std::array<int32_t, kMaxTracks> bankIndex = {};  // pattern bank per track
    bool valid = false;
    char name[16] = {};
    Scene() { bankIndex.fill(0); }
};

// ─── Scene Chain ──────────────────────────────────────────────────────────────

struct ChainStep {
    int32_t sceneIndex  = 0;
    int32_t repeatBars  = 1;    // how many bars before advancing
};

struct SceneChain {
    std::array<ChainStep, kMaxChainSteps> steps = {};
    int32_t length    = 0;
    bool    looping   = true;
};

// ─── Sample Buffer (read-only on Audio Thread) ────────────────────────────────

struct SampleBuffer {
    const float* data     = nullptr;
    int32_t      length   = 0;      // in samples (mono)
    int32_t      sampleRate = 48000;
    bool         looping  = false;
    int32_t      loopStart = 0;
    int32_t      loopEnd   = 0;
    bool         valid    = false;
};

// ─── Voice ────────────────────────────────────────────────────────────────────

enum class VoiceState : uint8_t {
    Idle      = 0,
    Playing   = 1,
    Releasing = 2,
};

struct Voice {
    VoiceState    state         = VoiceState::Idle;
    uint8_t       chokeGroup    = 0;
    uint8_t       trackIndex    = 255;
    uint8_t       note          = 60;
    float         volume        = 1.0f;
    float         targetVolume  = 1.0f;
    float         envelope      = 0.0f;     // 0.0–1.0 amplitude envelope
    float         envRelease    = 0.01f;    // release coefficient per sample
    int64_t       readPosQ16    = 0;        // fixed-point Q16: readPosQ16 >> 16 = integer part
    int64_t       pitchStepQ16  = 65536;    // fixed-point Q16: 65536 = no pitch shift
    int32_t       startOffset   = 0;        // sample offset within current callback
    int32_t       sampleId      = -1;
    const SampleBuffer* buffer  = nullptr;

    bool isActive() const noexcept { return state != VoiceState::Idle; }
};

// ─── Trigger ─────────────────────────────────────────────────────────────────
// Enqueued by onTick(), consumed by process().

struct Trigger {
    int32_t sampleOffset = 0;   // within current callback
    int32_t sampleId     = -1;
    uint8_t trackIndex   = 0;
    uint8_t note         = 60;
    uint8_t velocity     = 100;
    uint8_t chokeGroup   = 0;
    bool    choke        = false;  // if true: silence this choke group
    uint8_t unused_[3]   = {};
};
static_assert(std::is_trivially_copyable<Trigger>::value);

} // namespace vibecore
