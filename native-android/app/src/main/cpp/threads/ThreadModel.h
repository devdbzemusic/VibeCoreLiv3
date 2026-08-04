#pragma once
/**
 * ThreadModel.h — VibeCore Thread Ownership Contract
 *
 * VibeCore uses five threads. Each thread has a STRICT ownership boundary.
 * Crossing boundaries without the approved mechanism is a latency/crash risk.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THREAD          OWNER      PURPOSE                        FORBIDDEN
 * ─────────────────────────────────────────────────────────────────────────────
 * Audio Thread    Oboe       Render audio, DSP, mix         malloc, lock, I/O,
 *                            < 2 ms budget @ 48kHz/96fr     JNI, exceptions
 *
 * UI Thread       Android    Parameter updates, state UI,   Audio DSP,
 *                            JNI calls from JS              blocking I/O
 *
 * Worker Thread   Platform   Heavy computation,             Direct audio
 *                            preset loading, AI inference   callback mutation
 *
 * File I/O Thread Platform   Sample loading, project save,  Audio callback,
 *                            asset streaming                UI blocking
 *
 * MIDI Thread     Platform   MIDI parse, schedule events,   Audio rendering,
 *                            clock sync                     heavy computation
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Approved cross-thread communication:
 *   UI → Audio:       AudioThreadSafeQueue<Command>    (lock-free SPSC)
 *   Worker → Audio:   AudioThreadSafeQueue<Command>    (lock-free SPSC)
 *   File I/O → Audio: Pre-fill sample buffer, then atomic pointer swap
 *   MIDI → Audio:     AudioThreadSafeQueue<MidiEvent>  (lock-free SPSC)
 *   Audio → UI:       Atomic reads of output meters/diagnostics only
 *
 * NEVER:
 *   - Take a mutex on the Audio Thread
 *   - Allocate memory on the Audio Thread
 *   - Perform file I/O on the Audio Thread
 *   - Call JNI functions on the Audio Thread
 */

#include <thread>
#include <atomic>

namespace vibecore {

/**
 * Thread identity tags for assertions and logging.
 * In debug builds, each thread stores its identity in thread_local storage.
 */
enum class ThreadId : uint8_t {
    Unknown  = 0,
    Audio    = 1,   // Oboe audio callback thread
    UI       = 2,   // Android main/UI thread (JNI calls)
    Worker   = 3,   // Background computation
    FileIO   = 4,   // Sample loading / project I/O
    Midi     = 5,   // MIDI event processing
};

// Thread-local identity (set once at thread startup, never on Audio thread)
extern thread_local ThreadId currentThreadId;

#ifdef NDEBUG
    // Release: assertions compile away
    #define VIBECORE_ASSERT_THREAD(expected) ((void)0)
    #define VIBECORE_ASSERT_NOT_AUDIO_THREAD() ((void)0)
#else
    #include <cassert>
    #define VIBECORE_ASSERT_THREAD(expected) \
        assert(vibecore::currentThreadId == (expected) && "Wrong thread!")
    #define VIBECORE_ASSERT_NOT_AUDIO_THREAD() \
        assert(vibecore::currentThreadId != vibecore::ThreadId::Audio && \
               "This call is forbidden on the Audio Thread!")
#endif

} // namespace vibecore
