# 09 — FX Mix

> Phase/Doc 09 · Status: Draft v1.0 · Owner: Senior Technical Sound Designer + Senior DSP Architect · Review: 15-Rollen, 2/3-Mehrheit

## 1. Mixer-Topologie
- **Busses:** Master + 6 FX-Busse + pro-Channel Strip.
- **Sends/Returns:** pro Part → 6 Send-Slots; FX-Routing (hybrid/serial/parallel).
- **Inserts:** dynamisch hinzufügbar/entfernbar; Insert-Chain pro Bus.
- **Channel-Strip:** HP/LP, Drive (soft/tape/tube), 3-Band-EQ, Pan, Out-Gain.

## 2. Creative FX
| Klasse | Beispiele | CPU-Budget |
|---|---|---|
| Dynamics | Comp, Limiter (lookahead), Gate | ≤ 2 % |
| Delay | Stereo, Ping-Pong, BPM-sync | ≤ 2 % |
| Reverb | Convolver/Algorithmic, STFT | ≤ 5 % |
| Modulation | Chorus/Flanger/Phaser | ≤ 2 % |
| Filter | SVF, Morph, Comb | ≤ 1 % |
- FX sind **Module** (SDK) → valide Realtime-Regeln.

## 3. Metering
- **Peak/RMS** pro Bus & Master; **Phase-Correlation** Stereo; **Limiter-Reduction** dB.
- Meter-Snapshot via SPSC an UI (Bildrate, nicht Audio-Rate).
- **Loudness-Target** (optional LUFS) für Mastering-QA.

## 4. Monitoring & Raumakustik (Akustik-Architekt)
- Referenz-Monitoring-Standards für QA: kalibriertes Stereo, definierter Sweet-Spot.
- **Stereo-/Surround-Abbildung:** dokumentierte Pan-Laws (constant-power); Surround als optionales Backlog.
- **Raumsimulation:** Reverb als FX (siehe oben); Referenz-Hörraum für QA spezifiziert (`14_Testing.md`).

## 5. Master
- 3-Band-EQ, M/S-Width, SoftClip, Lookahead-Limiter (abschaltbar → bypass für Latenz).
- Latenz-Bewusst: Limiter-Lookahead dokumentiert; bei „minimal latency" bypassbar.

## 6. Tests
- `tests/regression`: Referenz-Mix-Presets (Peak/RMS-Vergleich ±0,1 dB).
- `tests/realtime`: voller Bus-Baum unter Last, Metering korrekt.