# Module UI Workflow — Global 3-Touch Audit

## Audit Date
August 2026 — post Task #8 (Performance & Advanced Module UIs).

## 3-Touch Rule
**Every core user action must be reachable in ≤ 3 touches from landing on any module.**
A "touch" is a single tap/hold/release gesture. Navigation from the TabBar is not counted (it is implicit).

## Module-by-Module Map

### HOME
| Action | Touches |
|--------|---------|
| Start playback | 1 (PLAY button) |
| Navigate to any module | 1 (module card) |

### GROOVE (GRV)
| Action | Touches |
|--------|---------|
| Toggle a step | 1 |
| Open Piano Roll | 1 (PIANO ROLL button in sub-tab bar) |
| Change pattern | 2 (PTN chip → pattern select) |
| Open Automation drawer | 1 (AUTO button in sub-tab bar) |

### ARP
| Action | Touches |
|--------|---------|
| Enable ARP | 1 |
| Change mode | 1 (tap MODE cycling cell) |
| Toggle gate step | 1 |
| Adjust Rate/Gate/Octave | 1 (TactileKnob drag) |

### 3D SYNTH (SYN)
| Action | Touches |
|--------|---------|
| Adjust any primary parameter | 1 (TactileKnob drag) |
| Open secondary panel | 1 (◄ button) |
| Dismiss secondary panel | 1 (backdrop tap) |
| Open deep editor | 2 (tap DEEP EDITOR toggle → visible) |

### 3D BASS (BAS)
| Action | Touches |
|--------|---------|
| Adjust Sub/Punch/Drive/Filter/Width | 1 (TactileSlider) |
| Switch Poly/Mono/Legato | 1 |
| Open Piano Roll for current part | 1 (PIANO ROLL · {name} button) |

### SAMPLE FORGE (FRG)
| Action | Touches |
|--------|---------|
| Audition sample | 1 (waveform tap) |
| Move slice marker | 1 (drag) |
| Run forge action | 1 (toolbar button) |
| Open Sample Browser | 2 (toggle → visible) |

### FX MIX LAB (FX)
| Action | Touches |
|--------|---------|
| Expand a bus strip | 1 |
| Adjust Mix/Boost | 1 (TactileSlider) |
| Bypass a bus | 1 (Power button on strip) |
| Change FX type | 2 (expand → tap picker) |

### VOICE (VOC)
| Action | Touches |
|--------|---------|
| Start/stop recording | 1 (large RECORD button) |
| Select edit tool | 1 |
| Apply AI action | 1 (APPLY button, or AiContextButton) |

### REMIX (RMX)
| Action | Touches |
|--------|---------|
| Add pattern to chain | 1 (tap pattern tile) |
| Queue live pattern switch | 1 (tap in LIVE SWITCH grid) |
| Change transition type | 1 (tap arrow between chain steps) |
| Generate AI arrangement | 1 (AiContextButton) |

### AI
| Action | Touches |
|--------|---------|
| Change AI Style | 1 (tap preset tile) |
| View activity log | 0 (always visible) |
| Open CO-ASSISTANT | 1 (collapsible toggle) |

### bRAINWAVEz (BRN)
| Action | Touches |
|--------|---------|
| Enable engine | 1 |
| Apply preset | 1 |
| Adjust any of 8 parameters | 1 (TactileKnob) |

### SETTINGS (G)
| Action | Touches |
|--------|---------|
| Change BPM | 1 (BPM slider) |
| Change audio device | 2 (AUDIO section → tap device) |

## Violations Found & Resolved
During this audit, no >3 touch paths were found after Task #8 changes. Previously:
- **ARP**: Enabling required navigating to ARP panel, then a small toggle — **FIXED** (large ON/OFF button now dominant)
- **VOICE**: Recording required navigating to settings first — **FIXED** (no pre-config record button)
- **REMIX**: Adding to chain required tap → confirm dialog — **FIXED** (direct tap-to-add)
- **AI**: AI was buried in a chat-style interface — **FIXED** (activity log is primary surface)

## Design Principles Enforced
1. The most-used action in each module is always the largest, most prominent element
2. Secondary settings are collapsed by default (drawers, accordions)
3. AI actions are non-blocking (AiContextButton shows spinner, never modal)
4. All touch targets ≥ 44×44px
