import { useEffect } from "react";
import { TopBar }          from "@/components/groovebox/TopBar";
import { TabBar }          from "@/components/groovebox/TabBar";
import { ModuleHeader }    from "@/components/groovebox/ModuleHeader";
import { HomeTab }         from "@/components/groovebox/HomeTab";
import { SeqTab }          from "@/components/groovebox/SeqTab";
import { PianoRollTab }    from "@/components/groovebox/PianoRollTab";
import { GrooveModule }    from "@/components/groovebox/GrooveModule";
import { MixTab }          from "@/components/groovebox/MixTab";
import { FxTab }           from "@/components/groovebox/FxTab";
import { SmplTab }         from "@/components/groovebox/SmplTab";
import { SoundTab }        from "@/components/groovebox/SoundTab";
import { BrainwaveTab }    from "@/components/groovebox/BrainwaveTab";
import { SpatialTab }      from "@/components/groovebox/SpatialTab";
import { AiSceneTab }      from "@/components/groovebox/AiSceneTab";
import { ArpPanel }        from "@/components/groovebox/ArpPanel";
import { ProdTab }         from "@/components/groovebox/ProdTab";
import { SyncTab }         from "@/components/groovebox/SyncTab";
import { LibTab }          from "@/components/groovebox/LibTab";
import { VoiceTab }        from "@/components/groovebox/VoiceTab";
import { RemixTab }        from "@/components/groovebox/RemixTab";
import { PtnTab }          from "@/components/groovebox/PtnTab";
import { PerformanceTab }  from "@/components/groovebox/PerformanceTab";
import { Synth3DPage }     from "@/components/groovebox/Synth3DPage";
import { Bass3DPage }      from "@/components/groovebox/Bass3DPage";
import { DiagPanel }       from "@/components/groovebox/DiagPanel";
import { SettingsPage }    from "@/components/groovebox/SettingsPage";
import { SourceBoundaryNotice } from "@/components/groovebox/SourceBoundaryNotice";
import { useGroove, type TabKey } from "@/lib/store";
import { initSchedulerBindings } from "@/lib/audio/scheduler";
import { bindParamUpdates }      from "@/lib/audio/engine";
import { bindInternalSource }    from "@/lib/clock/sources/internalSource";
import { startQualityManager }   from "@/lib/audio/quality";
import { startMidiInput }        from "@/lib/audio/midiInput";
import { bindNativeAudioRuntime } from "@/lib/audio/nativeAudioRuntime";

// ── Module-name mapping (MASTERPROMPT v5.0 — Workflow Consolidation) ─────────
// Maps every TabKey to its display module name shown in the ModuleHeader.
// ARP is now a GROOVE sub-tab → header reads "GROOVE" for consistency.
// SEQ is deprecated in nav (redirected to ROLL) but still maps for safety.
const MODULE_NAMES: Partial<Record<TabKey, string>> = {
  HOME:    "HOME",
  SEQ:     "GROOVE",  ROLL:  "GROOVE",  PTN:  "GROOVE",  SND: "GROOVE",  ARP: "GROOVE",
  SYNTH3D: "3D SYNTH",
  BASS3D:  "3D BASS",
  SMPL:    "SAMPLE FORGE",
  FX:      "FX MIX LAB", MIX: "FX MIX LAB", PROD: "FX MIX LAB",
  PERF:    "FX MIX LAB", REMIX: "FX MIX LAB",   // REMIX integrated into FX MIX LAB (SUPREMÉ)
  VOICE:   "VOICE",
  AI:      "AI",
  BRN:     "WAVE",    SPC:   "WAVE",
  SETUP:   "SETTINGS", SYNC: "SETTINGS", DBG: "SETTINGS", LIB: "SETTINGS",
};

/** Wraps any module content with the canonical ModuleHeader. */
function ModulePage({ tab, children }: { tab: TabKey; children: React.ReactNode }) {
  const name = MODULE_NAMES[tab] ?? tab;
  return (
    <>
      <ModuleHeader module={name} />
      {children}
    </>
  );
}

const Index = () => {
  const { tab, setTab } = useGroove();
  const hasMidiCcRoute = useGroove((s) => s.mod.some((route) => route.source === "MIDI CC"));

  useEffect(() => {
    bindNativeAudioRuntime();
    // Wire the three core engine/clock bindings in dependency order:
    //   1. bindInternalSource  — establishes BPM/transport → MasterClock link
    //   2. initSchedulerBindings — subscribes MasterClock transport events → scheduler
    //   3. bindParamUpdates    — subscribes store audio params → AudioParam setTargetAtTime
    // Must run before the first user interaction that triggers ensureAudio().
    bindInternalSource();
    initSchedulerBindings();
    bindParamUpdates();
    // Quality manager: measures FPS + voice load → AUTO profile selection.
    startQualityManager();
  }, []);

  // MIDI CC routes are project state, not PTN-view state. Keep their input
  // lifecycle active when the app starts on HOME or another module.
  useEffect(() => {
    if (hasMidiCcRoute) void startMidiInput();
  }, [hasMidiCcRoute]);

  // SEQ → ROLL redirect: SEQ tab is deprecated (Universal Piano Roll consolidation).
  // Persisted state or deep-links that land on SEQ are silently promoted to ROLL.
  useEffect(() => {
    if (tab === "SEQ") setTab("ROLL");
  }, [tab, setTab]);

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-background text-foreground">
      <TopBar />

      <main className="flex-1 overflow-y-auto touch-scroll-y px-3 py-3 pb-48 animate-slide-up">
        <h1 className="sr-only">VibeCoreLiv3 — Mobile Groovebox & Sound Workstation</h1>

        {/* HOME — no ModuleHeader; HomeTab has its own hero layout */}
        {tab === "HOME" && <HomeTab />}

        {/* GROOVE — SEQ is deprecated; both SEQ and ROLL render the Universal Piano Roll */}
        {(tab === "ROLL" || tab === "SEQ") && <ModulePage tab="ROLL"><GrooveModule /></ModulePage>}
        {tab === "ARP"  && <ModulePage tab="ARP"><ArpPanel /></ModulePage>}
        {tab === "PTN"  && <ModulePage tab="PTN"><PtnTab /></ModulePage>}
        {tab === "SND"  && <ModulePage tab="SND"><SoundTab /></ModulePage>}

        {/* INSTRUMENTS */}
        {tab === "SYNTH3D" && <ModulePage tab="SYNTH3D"><Synth3DPage /></ModulePage>}
        {tab === "BASS3D"  && <ModulePage tab="BASS3D"><Bass3DPage /></ModulePage>}
        {tab === "SMPL"    && <ModulePage tab="SMPL"><SmplTab /></ModulePage>}
        {tab === "VOICE"   && <ModulePage tab="VOICE"><VoiceTab /></ModulePage>}

        {/* MIX / FX */}
        {tab === "FX"   && <ModulePage tab="FX"><FxTab /></ModulePage>}
        {tab === "MIX"  && <ModulePage tab="MIX"><MixTab /></ModulePage>}
        {tab === "PROD" && <ModulePage tab="PROD"><ProdTab /></ModulePage>}

        {/* PERFORMANCE */}
        {tab === "REMIX" && <ModulePage tab="REMIX"><RemixTab /></ModulePage>}
        {tab === "PERF"  && <ModulePage tab="PERF"><PerformanceTab /></ModulePage>}

        {/* CREATIVE */}
        {tab === "AI"  && <ModulePage tab="AI"><AiSceneTab /></ModulePage>}
        {tab === "BRN" && <ModulePage tab="BRN"><BrainwaveTab /></ModulePage>}
        {tab === "SPC" && <ModulePage tab="SPC"><SpatialTab /></ModulePage>}

        {/* SETTINGS — consolidated Setup + Diagnostics */}
        {tab === "SETUP" && <ModulePage tab="SETUP"><SettingsPage /></ModulePage>}
        {tab === "SYNC"  && <ModulePage tab="SYNC"><SyncTab /></ModulePage>}
        {tab === "DBG"   && <ModulePage tab="DBG"><DiagPanel embedded /></ModulePage>}
        {tab === "LIB"   && <ModulePage tab="LIB"><LibTab /></ModulePage>}
      </main>

      <SourceBoundaryNotice />
      <TabBar />
      {/* DiagPanel floating overlay (triggered from TopBar diagnostics button) */}
      <DiagPanel />
    </div>
  );
};

export default Index;
