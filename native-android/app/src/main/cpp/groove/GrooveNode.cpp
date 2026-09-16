#include "GrooveNode.h"
#include "../bass/BassNode.h"
#include "../voice/VoiceNode.h"
#include "../platform/VibeCoreLog.h"
#include "../threads/ThreadModel.h"
#include <cstring>

namespace vibecore {

// ─── Construction ─────────────────────────────────────────────────────────────

GrooveNode::GrooveNode(NodeId id)
    : AudioNode(id, "GrooveNode") {
    VLOG_I("GrooveNode: constructed id=%u", id);
}

// ─── AudioNode lifecycle ──────────────────────────────────────────────────────

void GrooveNode::prepare(int sampleRate, int maxFramesPerCallback) {
    VIBECORE_ASSERT_NOT_AUDIO_THREAD();
    mSampleRate = sampleRate;
    mVoicePool.prepare(sampleRate, maxFramesPerCallback);

    for (int t = 0; t < kMaxTracks; ++t) {
        mSequencers[t].configure(t, sampleRate);
        mSequencers[t].setPattern(&mTracks[t].activePattern());
        mSequencers[t].setSampleId(mTracks[t].sampleId);
        mSequencers[t].setChokeGroup(mTracks[t].chokeGroup);
    }

    VLOG_I("GrooveNode: prepared %d Hz / %d fr/cb / %d tracks / %d voices",
           sampleRate, maxFramesPerCallback, kMaxTracks, kMaxVoices);
}

void GrooveNode::reset() {
    VIBECORE_ASSERT_NOT_AUDIO_THREAD();
    mVoicePool.reset();
    mTransportRunning = false;
    mTriggerQueue.clear();
    mPublicIsPlaying.store(false, std::memory_order_relaxed);
    for (auto& seq : mSequencers) seq.onTransportStop();
}

// ─── Sync callbacks — Audio Thread ────────────────────────────────────────────

void GrooveNode::onTransportStart(int32_t /*sampleOffset*/) noexcept {
    mTransportRunning = true;
    mPublicIsPlaying.store(true, std::memory_order_relaxed);

    for (int t = 0; t < kMaxTracks; ++t) {
        mSequencers[t].resetToStart();
        mPianoRolls[t].resetScan(0);
    }

    mSceneEngine.onTransportStart();
    VLOG_D("GrooveNode: transport start");
}

void GrooveNode::onTransportStop(int32_t /*sampleOffset*/) noexcept {
    mTransportRunning = false;
    mPublicIsPlaying.store(false, std::memory_order_relaxed);

    for (auto& seq : mSequencers) seq.onTransportStop();
    mSceneEngine.onTransportStop();
    mTriggerQueue.clear();
    VLOG_D("GrooveNode: transport stop");
}

void GrooveNode::onTick(int64_t absoluteTick,
                         const MusicalPosition& /*pos*/,
                         int32_t sampleOffset) noexcept {
    // 1. Apply pending parameter changes from UI thread
    drainCommands();

    if (!mTransportRunning) return;

    // 2. Tick every active sequencer
    for (int t = 0; t < kMaxTracks; ++t) {
        if (!trackShouldPlay(t)) continue;
        mSequencers[t].onTick(absoluteTick, sampleOffset, mTriggerQueue, mRng);
    }

    // 3. Piano roll notes for each track
    for (int t = 0; t < kMaxTracks; ++t) {
        if (!trackShouldPlay(t)) continue;
        const Track& track = mTracks[t];
        mPianoRolls[t].onTick(absoluteTick, sampleOffset,
                               t, track.sampleId,
                               track.chokeGroup, mTriggerQueue);
    }
}

void GrooveNode::onBeat(int64_t /*tick*/,
                         const MusicalPosition& /*pos*/,
                         int32_t /*sampleOffset*/) noexcept {
    // Beat-level state updates can go here in future (LFO sync, etc.)
}

void GrooveNode::onBar(int64_t /*tick*/,
                        const MusicalPosition& /*pos*/,
                        int32_t /*sampleOffset*/) noexcept {
    // Apply pending scene switches
    const int32_t newScene = mSceneEngine.onBar();

    // Apply pending pattern changes per sequencer
    for (int t = 0; t < kMaxTracks; ++t) {
        const int32_t bankIdx = mSceneEngine.trackBankIndex(t);
        if (bankIdx != mTracks[t].activeBank) {
            mTracks[t].activeBank = bankIdx;
            mSequencers[t].setPattern(&mTracks[t].activePattern());
        }
        mSequencers[t].onBar();

        // Re-sort piano roll if needed (safe here — bar boundary, rarely called)
        if (mPianoRolls[t].needsSort()) {
            mPianoRolls[t].sortNotes();
        }
    }
    (void)newScene;
}

void GrooveNode::onLoop(int64_t /*loopCount*/, int32_t /*sampleOffset*/) noexcept {
    for (int t = 0; t < kMaxTracks; ++t) {
        mSequencers[t].resetToStart();
        mPianoRolls[t].onLoop(0);
    }
}

void GrooveNode::onTempoChanged(double newBpm, int32_t sampleOffset) noexcept {
    for (auto& seq : mSequencers) seq.onTempoChanged(newBpm);
    (void)sampleOffset;
}

// ─── Render — Audio Thread ────────────────────────────────────────────────────

void GrooveNode::process(const float* /*input*/, float* output,
                          int numFrames, int numChannels) noexcept {
    // 1. Drain trigger queue → route by track mode (Audio Thread, zero latency)
    Trigger t;
    while (mTriggerQueue.pop(t)) {
        const TrackMode mode = (t.trackIndex < kMaxTracks)
                             ? mTracks[t.trackIndex].mode : TrackMode::Drum;
        if (mode == TrackMode::Bass && mBassTarget != nullptr) {
            BassTrigger bt;
            bt.note = t.note; bt.velocity = t.velocity;
            bt.noteOn = !t.choke; bt.sampleOffset = t.sampleOffset;
            mBassTarget->notifyGrooveTrigger(bt);
        } else if (mode == TrackMode::Voice && mVoiceTarget != nullptr) {
            VoiceTrigger vt;
            vt.note = t.note; vt.velocity = t.velocity;
            vt.noteOn = !t.choke; vt.sampleOffset = t.sampleOffset;
            vt.sampleSlot = -1; vt.sliceIndex = -1;
            mVoiceTarget->notifyGrooveTrigger(vt);
        } else {
            mVoicePool.trigger(t);
        }
    }

    // 2. Mix all active voices into output
    mVoicePool.process(output, numFrames, numChannels);

    // 3. Publish voice count for UI
    mPublicActiveVoices.store(mVoicePool.activeVoiceCount(),
                               std::memory_order_relaxed);
}

// ─── Command handling — Audio Thread ─────────────────────────────────────────

void GrooveNode::drainCommands() noexcept {
    GrooveCommand cmd;
    while (mCommandQueue.pop(cmd)) {
        handleCommand(cmd);
    }
}

void GrooveNode::handleCommand(const GrooveCommand& c) noexcept {
    const int t = c.trackIdx;
    const int s = c.stepIdx;

    if (t >= kMaxTracks) return;

    switch (c.type) {

    // ── Step editing ───────────────────────────────────────────────────────
    case GrooveCommand::Type::SetStepActive:
        if (s < kMaxSteps) {
            mTracks[t].activePattern().steps[s].active   = c.boolVal;
            mTracks[t].activePattern().steps[s].velocity = static_cast<uint8_t>(c.int32Val);
        }
        break;
    case GrooveCommand::Type::SetStepVelocity:
        if (s < kMaxSteps)
            mTracks[t].activePattern().steps[s].velocity = static_cast<uint8_t>(c.int32Val);
        break;
    case GrooveCommand::Type::SetStepNote:
        if (s < kMaxSteps)
            mTracks[t].activePattern().steps[s].note = static_cast<uint8_t>(c.int32Val);
        break;
    case GrooveCommand::Type::SetStepProbability:
        if (s < kMaxSteps)
            mTracks[t].activePattern().steps[s].probability = static_cast<uint8_t>(c.int32Val);
        break;
    case GrooveCommand::Type::SetStepMuted:
        if (s < kMaxSteps)
            mTracks[t].activePattern().steps[s].muted = c.boolVal;
        break;
    case GrooveCommand::Type::SetStepAccent:
        if (s < kMaxSteps)
            mTracks[t].activePattern().steps[s].accent = c.boolVal;
        break;
    case GrooveCommand::Type::SetStepRoll:
        if (s < kMaxSteps)
            mTracks[t].activePattern().steps[s].rollCount = static_cast<uint8_t>(c.int32Val);
        break;
    case GrooveCommand::Type::SetStepFlam:
        if (s < kMaxSteps)
            mTracks[t].activePattern().steps[s].flam = c.boolVal;
        break;
    case GrooveCommand::Type::SetStepMicroTiming:
        if (s < kMaxSteps)
            mTracks[t].activePattern().steps[s].microTiming = static_cast<int16_t>(c.int32Val);
        break;

    // ── Pattern ────────────────────────────────────────────────────────────
    case GrooveCommand::Type::SetPatternLength:
        if (c.int32Val > 0 && c.int32Val <= kMaxSteps)
            mTracks[t].activePattern().length = c.int32Val;
        break;
    case GrooveCommand::Type::SetSwing:
        mTracks[t].activePattern().swing = static_cast<uint8_t>(c.int32Val);
        break;
    case GrooveCommand::Type::SetHumanize:
        mTracks[t].activePattern().humanize = static_cast<uint8_t>(c.int32Val);
        break;
    case GrooveCommand::Type::ClearPattern:
        mTracks[t].activePattern().clear();
        break;
    case GrooveCommand::Type::SetStepSize:
        mTracks[t].activePattern().stepSizeTicks = c.int32Val;
        break;

    // ── Track ──────────────────────────────────────────────────────────────
    case GrooveCommand::Type::SetTrackMute:
        mTracks[t].muted = c.boolVal;
        break;
    case GrooveCommand::Type::SetTrackSolo:
        mTracks[t].soloed = c.boolVal;
        rebuildSoloState();
        break;
    case GrooveCommand::Type::SetTrackVolume:
        mTracks[t].volume = static_cast<uint8_t>(c.int32Val);
        break;
    case GrooveCommand::Type::SetTrackSample:
        mTracks[t].sampleId = c.int32Val;
        mSequencers[t].setSampleId(c.int32Val);
        break;
    case GrooveCommand::Type::SetTrackMode:
        mTracks[t].mode = static_cast<TrackMode>(c.int32Val);
        break;

    // ── Scene ──────────────────────────────────────────────────────────────
    case GrooveCommand::Type::QueueSceneChange:
        mSceneEngine.queueSceneChange(c.int32Val);
        break;
    case GrooveCommand::Type::SetActiveScene:
        mSceneEngine.applySceneNow(c.int32Val);
        break;
    case GrooveCommand::Type::SetSceneBank:
        mTracks[t].activeBank = c.int32Val;
        syncSequencerToTrack(t);
        break;

    // ── Piano Roll ──────────────────────────────────────────────────────────
    case GrooveCommand::Type::AddPianoRollNote:
        mPianoRolls[t].addNote(c.int64Val, c.int64Val2,
                               static_cast<uint8_t>(c.int32Val),
                               static_cast<uint8_t>(c.int32Val2));
        break;
    case GrooveCommand::Type::RemovePianoRollNote:
        mPianoRolls[t].removeNote(c.int32Val);
        break;
    case GrooveCommand::Type::ClearPianoRoll:
        mPianoRolls[t].clear();
        break;
    case GrooveCommand::Type::UpdatePianoRollNote:
        // Packing contract: see GrooveCommand::makePianoRollUpdate().
        // int32Val2 bits 0-7 = note, bits 8-15 = velocity.
        mPianoRolls[t].updateNote(c.int32Val, c.int64Val, c.int64Val2,
                                   static_cast<uint8_t>(c.int32Val2 & 0x7F),
                                   static_cast<uint8_t>((c.int32Val2 >> 8) & 0x7F));
        break;

    default:
        break;
    }
}

// ─── UI Thread API ────────────────────────────────────────────────────────────

void GrooveNode::sendCommand(const GrooveCommand& c) noexcept {
    mCommandQueue.push(c);
}

void GrooveNode::setStep(int t, int s, bool active, uint8_t vel, uint8_t note) noexcept {
    GrooveCommand c;
    c.type     = GrooveCommand::Type::SetStepActive;
    c.trackIdx = static_cast<uint8_t>(t);
    c.stepIdx  = static_cast<uint8_t>(s);
    c.boolVal  = active;
    c.int32Val = vel;
    c.int32Val2= note;
    sendCommand(c);
}

void GrooveNode::setStepVelocity(int t, int s, uint8_t vel) noexcept {
    GrooveCommand c; c.type=GrooveCommand::Type::SetStepVelocity;
    c.trackIdx=t; c.stepIdx=s; c.int32Val=vel; sendCommand(c);
}
void GrooveNode::setStepNote(int t, int s, uint8_t note) noexcept {
    GrooveCommand c; c.type=GrooveCommand::Type::SetStepNote;
    c.trackIdx=t; c.stepIdx=s; c.int32Val=note; sendCommand(c);
}
void GrooveNode::setStepProbability(int t, int s, uint8_t prob) noexcept {
    GrooveCommand c; c.type=GrooveCommand::Type::SetStepProbability;
    c.trackIdx=t; c.stepIdx=s; c.int32Val=prob; sendCommand(c);
}
void GrooveNode::setStepMuted(int t, int s, bool muted) noexcept {
    GrooveCommand c; c.type=GrooveCommand::Type::SetStepMuted;
    c.trackIdx=t; c.stepIdx=s; c.boolVal=muted; sendCommand(c);
}
void GrooveNode::setStepAccent(int t, int s, bool accent) noexcept {
    GrooveCommand c; c.type=GrooveCommand::Type::SetStepAccent;
    c.trackIdx=t; c.stepIdx=s; c.boolVal=accent; sendCommand(c);
}
void GrooveNode::setStepRoll(int t, int s, uint8_t count) noexcept {
    GrooveCommand c; c.type=GrooveCommand::Type::SetStepRoll;
    c.trackIdx=t; c.stepIdx=s; c.int32Val=count; sendCommand(c);
}
void GrooveNode::setStepFlam(int t, int s, bool flam) noexcept {
    GrooveCommand c; c.type=GrooveCommand::Type::SetStepFlam;
    c.trackIdx=t; c.stepIdx=s; c.boolVal=flam; sendCommand(c);
}
void GrooveNode::setStepMicroTiming(int t, int s, int16_t ticks) noexcept {
    GrooveCommand c; c.type=GrooveCommand::Type::SetStepMicroTiming;
    c.trackIdx=t; c.stepIdx=s; c.int32Val=ticks; sendCommand(c);
}
void GrooveNode::setPatternLength(int t, int steps) noexcept {
    GrooveCommand c; c.type=GrooveCommand::Type::SetPatternLength;
    c.trackIdx=t; c.int32Val=steps; sendCommand(c);
}
void GrooveNode::setSwing(int t, uint8_t swing) noexcept {
    GrooveCommand c; c.type=GrooveCommand::Type::SetSwing;
    c.trackIdx=t; c.int32Val=swing; sendCommand(c);
}
void GrooveNode::setHumanize(int t, uint8_t h) noexcept {
    GrooveCommand c; c.type=GrooveCommand::Type::SetHumanize;
    c.trackIdx=t; c.int32Val=h; sendCommand(c);
}
void GrooveNode::clearPattern(int t) noexcept {
    GrooveCommand c; c.type=GrooveCommand::Type::ClearPattern; c.trackIdx=t; sendCommand(c);
}
void GrooveNode::setTrackMute(int t, bool m) noexcept {
    GrooveCommand c; c.type=GrooveCommand::Type::SetTrackMute; c.trackIdx=t; c.boolVal=m; sendCommand(c);
}
void GrooveNode::setTrackSolo(int t, bool s) noexcept {
    GrooveCommand c; c.type=GrooveCommand::Type::SetTrackSolo; c.trackIdx=t; c.boolVal=s; sendCommand(c);
}
void GrooveNode::setTrackVolume(int t, uint8_t v) noexcept {
    GrooveCommand c; c.type=GrooveCommand::Type::SetTrackVolume; c.trackIdx=t; c.int32Val=v; sendCommand(c);
}
void GrooveNode::setTrackSample(int t, int id) noexcept {
    GrooveCommand c; c.type=GrooveCommand::Type::SetTrackSample; c.trackIdx=t; c.int32Val=id; sendCommand(c);
}
void GrooveNode::setTrackMode(int t, TrackMode mode) noexcept {
    GrooveCommand c; c.type=GrooveCommand::Type::SetTrackMode;
    c.trackIdx=t; c.int32Val=static_cast<int32_t>(mode); sendCommand(c);
}
void GrooveNode::queueSceneChange(int32_t sceneIdx) noexcept {
    GrooveCommand c; c.type=GrooveCommand::Type::QueueSceneChange; c.int32Val=sceneIdx; sendCommand(c);
}
void GrooveNode::addPianoRollNote(int t, int64_t start, int64_t end,
                                   uint8_t note, uint8_t vel) noexcept {
    sendCommand(GrooveCommand::makePianoRollAdd(
        static_cast<uint8_t>(t), start, end, note, vel));
}
void GrooveNode::updatePianoRollNote(int t, int32_t noteIndex,
                                     int64_t start, int64_t end,
                                     uint8_t note, uint8_t vel) noexcept {
    sendCommand(GrooveCommand::makePianoRollUpdate(
        static_cast<uint8_t>(t), noteIndex, start, end, note, vel));
}
void GrooveNode::removePianoRollNote(int t, int32_t idx) noexcept {
    GrooveCommand c; c.type=GrooveCommand::Type::RemovePianoRollNote;
    c.trackIdx=t; c.int32Val=idx; sendCommand(c);
}
void GrooveNode::clearPianoRoll(int t) noexcept {
    GrooveCommand c; c.type=GrooveCommand::Type::ClearPianoRoll; c.trackIdx=t; sendCommand(c);
}
void GrooveNode::registerSample(int32_t id, const SampleBuffer& buf) noexcept {
    mVoicePool.registerSample(id, buf);
}

// ─── Query ─────────────────────────────────────────────────────────────────────

int32_t GrooveNode::activeVoiceCount() const noexcept {
    return mPublicActiveVoices.load(std::memory_order_relaxed);
}
int32_t GrooveNode::currentStep(int t) const noexcept {
    if (t < 0 || t >= kMaxTracks) return 0;
    return mSequencers[t].currentStep();
}
int32_t GrooveNode::activeScene() const noexcept {
    return mSceneEngine.activeScene();
}
bool GrooveNode::isPlaying() const noexcept {
    return mPublicIsPlaying.load(std::memory_order_relaxed);
}

// ─── Private ──────────────────────────────────────────────────────────────────

bool GrooveNode::trackShouldPlay(int t) const noexcept {
    const Track& track = mTracks[t];
    if (track.muted)  return false;
    if (mAnySoloed && !track.soloed) return false;
    return true;
}

void GrooveNode::rebuildSoloState() noexcept {
    mAnySoloed = false;
    for (const auto& tr : mTracks) {
        if (tr.soloed) { mAnySoloed = true; break; }
    }
}

void GrooveNode::syncSequencerToTrack(int t) noexcept {
    mSequencers[t].setPattern(&mTracks[t].activePattern());
    mSequencers[t].setSampleId(mTracks[t].sampleId);
    mSequencers[t].setChokeGroup(mTracks[t].chokeGroup);
}

} // namespace vibecore
