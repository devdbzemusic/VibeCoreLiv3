---
name: Native audio cross-thread lifetime patterns
description: Hard-won rules for UI↔Audio-Thread lifetime and ordering in the VibeCore native engine
---

## Rules

1. **An atomic gate is not an ack.** Clearing an `active` flag on the UI thread does NOT prove the Audio Thread is out of a resource. Use a handshake: AT publishes "in use" BEFORE checking the gate; UI clears the gate, then bounded-waits for "in use" to clear (VoiceInput read/close pattern).
2. **Two-buffer rotation is not reclamation.** Freeing a retired sample buffer needs proof the AT drained the replacing command AND finished fades. Pattern: node exposes a monotonic per-callback epoch; UI frees retired buffers only after epoch advanced ≥ N past retirement (frozen epoch ⇒ engine stopped ⇒ safe). Also `killUsing(ptr)` fades units on the old buffer when a slot is swapped on the AT.
3. **Graph render order matters for same-callback trigger dispatch.** AudioGraphManager topological sort must pop FIFO (insertion order); Groove must be inserted before instrument nodes (ensureBass/ensureVoice call ensureGroove first) so its trigger dispatch lands in the same callback.
4. **Steal-with-fade needs a deferred noteOn.** kill()+noteOn() immediately cancels the kill fade — store a pending trigger + slot copy and start it when the fade completes.
5. **MusicalPosition has NO bpm/beatsPerBar fields.** Nodes must cache BPM from onTempoChanged; don't invent `pos.bpm` (bug existed in BassNode and was copied into VoiceNode).
6. **Host syntax validation catches real bugs.** g++ -fsyntax-only with stubs in /tmp/stubinc (oboe/Oboe.h, android/log.h, jni.h) found the pos.bpm bug, missing ThreadModel.h includes, and Step-size assert. Include ThreadModel.h explicitly wherever VIBECORE_ASSERT_* is used.

**Why:** All were release-blocking findings from the Phase 6 architect review or latent Phase 3–5 bugs (code had never actually been NDK-compiled/run).
**How to apply:** Any new instrument node (Phase 7+) must copy the Voice patterns: input handshake, epoch reclamation, deferred steal, FIFO graph order, cached BPM.
