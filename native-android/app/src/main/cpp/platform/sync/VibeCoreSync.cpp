#include "VibeCoreSync.h"
#include <cmath>
#include <algorithm>

namespace vibecore {

// ─── Construction ─────────────────────────────────────────────────────────────

VibeCoreSync::VibeCoreSync(int32_t sampleRate)
    : mSampleRate(sampleRate) {
    mAT.bpm       = 120.0;
    mAT.numerator = 4;
    mPublicBpm.store(120.0, std::memory_order_relaxed);
}

// ─── UI Thread API ────────────────────────────────────────────────────────────

bool VibeCoreSync::sendCommand(const SyncCommand& cmd) {
    return mCommandQueue.push(cmd);
    // If full (256 slots), command is silently dropped.
    // This should never happen in normal use — the queue handles
    // any burst of UI interactions before the next callback drains it.
}

void VibeCoreSync::play() {
    sendCommand({ SyncCommand::Type::TransportStart });
}

void VibeCoreSync::stop() {
    sendCommand({ SyncCommand::Type::TransportStop });
}

void VibeCoreSync::setTempo(double bpm) {
    SyncCommand cmd;
    cmd.type     = SyncCommand::Type::SetTempo;
    cmd.floatVal = static_cast<float>(
        std::max(20.0, std::min(300.0, bpm)));
    sendCommand(cmd);
}

void VibeCoreSync::setTimeSignature(int32_t numerator, int32_t denominator) {
    SyncCommand cmd;
    cmd.type      = SyncCommand::Type::SetTimeSignature;
    cmd.int32Val  = std::max(1, std::min(32, numerator));
    cmd.int32Val2 = denominator;
    sendCommand(cmd);
}

void VibeCoreSync::setPosition(int64_t absoluteTick) {
    SyncCommand cmd;
    cmd.type     = SyncCommand::Type::SetPosition;
    cmd.int64Val = std::max(int64_t(0), absoluteTick);
    sendCommand(cmd);
}

void VibeCoreSync::setLoopEnabled(bool enabled) {
    SyncCommand cmd;
    cmd.type     = SyncCommand::Type::SetLoopEnabled;
    cmd.int32Val = enabled ? 1 : 0;
    sendCommand(cmd);
}

void VibeCoreSync::setLoopPoints(int64_t startTick, int64_t endTick) {
    if (endTick <= startTick) return;
    SyncCommand cmd;
    cmd.type     = SyncCommand::Type::SetLoopStart;
    cmd.int64Val = startTick;
    sendCommand(cmd);
    cmd.type     = SyncCommand::Type::SetLoopEnd;
    cmd.int64Val = endTick;
    sendCommand(cmd);
}

// ─── Any-thread reads ─────────────────────────────────────────────────────────

bool VibeCoreSync::isPlaying() const noexcept {
    return mIsPlaying.load(std::memory_order_relaxed);
}

double VibeCoreSync::currentBpm() const noexcept {
    return mPublicBpm.load(std::memory_order_relaxed);
}

int64_t VibeCoreSync::currentTick() const noexcept {
    return mPublicTick.load(std::memory_order_relaxed);
}

MusicalPosition VibeCoreSync::currentPosition() const noexcept {
    const int64_t tick = mPublicTick.load(std::memory_order_relaxed);
    return MusicalPosition::fromTick(tick, mAT.numerator, 0);
}

// ─── Audio Thread — main entry point ─────────────────────────────────────────

const TickEventBuffer& VibeCoreSync::processCallback(
        int64_t absoluteSamplePos,
        int32_t numFrames) noexcept {

    mEventBuffer.clear();

    // 1. Drain incoming commands from UI/MIDI threads
    drainCommands();

    // 2. If stopped, publish position and return empty buffer
    if (!mAT.isPlaying) {
        mPublicTick.store(mAT.nextTick, std::memory_order_relaxed);
        return mEventBuffer;
    }

    // 3. Schedule all ticks that fall within this callback
    scheduleTicksInRange(absoluteSamplePos, numFrames);

    // 4. Advance playhead
    mAT.playheadSample += numFrames;

    // 5. Publish state for UI reads (relaxed — approximate is fine for display)
    mPublicTick.store(mAT.nextTick, std::memory_order_relaxed);

    return mEventBuffer;
}

// ─── Audio Thread helpers ─────────────────────────────────────────────────────

void VibeCoreSync::drainCommands() noexcept {
    SyncCommand cmd;
    while (mCommandQueue.pop(cmd)) {
        handleCommand(cmd);
    }
}

void VibeCoreSync::handleCommand(const SyncCommand& cmd) noexcept {
    switch (cmd.type) {
        case SyncCommand::Type::TransportStart:
            if (!mAT.isPlaying) {
                mAT.isPlaying      = true;
                mAT.playheadSample = 0;
                // nextTick stays at current position (allows seamless resume)
                mIsPlaying.store(true, std::memory_order_relaxed);
                emitTransportStart(0);
            }
            break;

        case SyncCommand::Type::TransportStop:
            if (mAT.isPlaying) {
                mAT.isPlaying = false;
                mIsPlaying.store(false, std::memory_order_relaxed);
                emitTransportStop(0);
            }
            break;

        case SyncCommand::Type::SetTempo: {
            const double newBpm = static_cast<double>(cmd.floatVal);
            if (mAT.bpm != newBpm) {
                // Recalculate nextTick based on current playhead to avoid jump
                // nextTick is already integer — no recalculation needed.
                // The new samplesPerTick takes effect from the next scheduleTicksInRange().
                mAT.bpm = newBpm;
                mPublicBpm.store(newBpm, std::memory_order_relaxed);
                emitTempoChanged(0);
            }
            break;
        }

        case SyncCommand::Type::SetTimeSignature:
            mAT.numerator   = cmd.int32Val;
            mAT.denominator = cmd.int32Val2;
            break;

        case SyncCommand::Type::SetPosition:
            mAT.nextTick       = cmd.int64Val;
            mAT.playheadSample = 0;
            mAT.loopCount      = 0;
            mPublicTick.store(cmd.int64Val, std::memory_order_relaxed);
            break;

        case SyncCommand::Type::SetLoopEnabled:
            mAT.loopEnabled = (cmd.int32Val != 0);
            break;

        case SyncCommand::Type::SetLoopStart:
            mAT.loopStartTick = cmd.int64Val;
            break;

        case SyncCommand::Type::SetLoopEnd:
            mAT.loopEndTick = cmd.int64Val;
            break;
    }
}

void VibeCoreSync::scheduleTicksInRange(int64_t callbackStartSample,
                                         int32_t numFrames) noexcept {
    const double spt          = samplesPerTick();
    const int64_t callbackEnd = callbackStartSample + numFrames;

    // Walk through every tick that fires within [callbackStartSample, callbackEnd)
    while (true) {
        // Sample at which the next tick fires (absolute)
        // We track playheadSample relative to transport start, so:
        //   absoluteSampleOfTick = transportStartAbsolute + mAT.nextTick * spt
        // But since we increment mAT.playheadSample ourselves, use it directly:
        const double tickSampleF = mAT.playheadSample
                                 + (mAT.nextTick - mAT.nextTick) * spt;
        // Simpler: compute sample of this tick relative to callback start
        const double tickRelSampleF = mAT.nextTick * spt - mAT.playheadSample;

        // Convert to absolute sample
        const int64_t tickAbsSample = callbackStartSample
                                    + static_cast<int64_t>(tickRelSampleF);

        if (tickAbsSample < callbackStartSample) {
            // Tick already passed — advance (shouldn't happen in steady state)
            mAT.nextTick++;
            continue;
        }
        if (tickAbsSample >= callbackEnd) {
            // Tick is after this callback — stop
            break;
        }

        const int32_t sampleOffset = static_cast<int32_t>(tickAbsSample - callbackStartSample);

        // Check loop boundary BEFORE dispatching the tick
        if (mAT.loopEnabled &&
            mAT.loopEndTick > mAT.loopStartTick &&
            mAT.nextTick >= mAT.loopEndTick) {
            handleLoop(sampleOffset);
            // After loop, recalculate and continue from loop start
            continue;
        }

        // Build position
        const MusicalPosition pos = positionAt(mAT.nextTick, tickAbsSample);

        // Always emit Tick
        TickEvent ev;
        ev.type         = TickEvent::Type::Tick;
        ev.sampleOffset = sampleOffset;
        ev.absoluteTick = mAT.nextTick;
        ev.position     = pos;
        ev.bpm          = mAT.bpm;
        ev.loopCount    = mAT.loopCount;
        mEventBuffer.push(ev);

        // Beat event (every PPQ ticks)
        if (mAT.nextTick % kPPQ == 0) {
            ev.type = TickEvent::Type::Beat;
            mEventBuffer.push(ev);
        }

        // Bar event (every numerator beats = numerator * PPQ ticks)
        if (mAT.nextTick % (static_cast<int64_t>(kPPQ) * mAT.numerator) == 0) {
            ev.type = TickEvent::Type::Bar;
            mEventBuffer.push(ev);
        }

        mAT.nextTick++;
    }
}

void VibeCoreSync::handleLoop(int32_t sampleOffset) noexcept {
    // Wrap playhead to loop start
    const int64_t loopLengthTicks = mAT.loopEndTick - mAT.loopStartTick;
    mAT.nextTick      = mAT.loopStartTick;
    mAT.loopCount++;

    // Recalculate playheadSample to correspond to new tick position
    // (approximate — will be corrected by scheduler on next iteration)
    mAT.playheadSample = static_cast<int64_t>(mAT.loopStartTick * samplesPerTick());

    TickEvent ev;
    ev.type         = TickEvent::Type::Loop;
    ev.sampleOffset = sampleOffset;
    ev.absoluteTick = mAT.nextTick;
    ev.position     = positionAt(mAT.nextTick, 0);
    ev.bpm          = mAT.bpm;
    ev.loopCount    = mAT.loopCount;
    mEventBuffer.push(ev);
    (void)loopLengthTicks;
}

void VibeCoreSync::emitTransportStart(int32_t sampleOffset) noexcept {
    TickEvent ev;
    ev.type         = TickEvent::Type::TransportStart;
    ev.sampleOffset = sampleOffset;
    ev.absoluteTick = mAT.nextTick;
    ev.position     = positionAt(mAT.nextTick, 0);
    ev.bpm          = mAT.bpm;
    ev.loopCount    = mAT.loopCount;
    mEventBuffer.push(ev);
}

void VibeCoreSync::emitTransportStop(int32_t sampleOffset) noexcept {
    TickEvent ev;
    ev.type         = TickEvent::Type::TransportStop;
    ev.sampleOffset = sampleOffset;
    ev.absoluteTick = mAT.nextTick;
    ev.position     = positionAt(mAT.nextTick, 0);
    ev.bpm          = mAT.bpm;
    ev.loopCount    = mAT.loopCount;
    mEventBuffer.push(ev);
}

void VibeCoreSync::emitTempoChanged(int32_t sampleOffset) noexcept {
    TickEvent ev;
    ev.type         = TickEvent::Type::TempoChanged;
    ev.sampleOffset = sampleOffset;
    ev.absoluteTick = mAT.nextTick;
    ev.position     = positionAt(mAT.nextTick, 0);
    ev.bpm          = mAT.bpm;
    ev.loopCount    = mAT.loopCount;
    mEventBuffer.push(ev);
}

int64_t VibeCoreSync::tickToSample(int64_t tick) const noexcept {
    return static_cast<int64_t>(static_cast<double>(tick) * samplesPerTick());
}

} // namespace vibecore
