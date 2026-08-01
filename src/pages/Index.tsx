import { useEffect } from "react";
import { TopBar } from "@/components/groovebox/TopBar";
import { TabBar } from "@/components/groovebox/TabBar";
import { SeqTab } from "@/components/groovebox/SeqTab";
import { PianoRollTab } from "@/components/groovebox/PianoRollTab";
import { MixTab } from "@/components/groovebox/MixTab";

import { FxTab } from "@/components/groovebox/FxTab";
import { SmplTab } from "@/components/groovebox/SmplTab";
import { SoundTab } from "@/components/groovebox/SoundTab";
import { BrainwaveTab } from "@/components/groovebox/BrainwaveTab";
import { SpatialTab } from "@/components/groovebox/SpatialTab";
import { AiSceneTab } from "@/components/groovebox/AiSceneTab";
import { ArpPanel } from "@/components/groovebox/ArpPanel";
import { ProdTab } from "@/components/groovebox/ProdTab";
import { SyncTab } from "@/components/groovebox/SyncTab";
import { SetupTab } from "@/components/groovebox/SetupTab";
import { LibTab } from "@/components/groovebox/LibTab";
import { VoiceTab } from "@/components/groovebox/VoiceTab";
import { RemixTab } from "@/components/groovebox/RemixTab";
import { PtnTab } from "@/components/groovebox/PtnTab";
import { PerformanceTab } from "@/components/groovebox/PerformanceTab";
import { Synth3DPage } from "@/components/groovebox/Synth3DPage";
import { Bass3DPage } from "@/components/groovebox/Bass3DPage";


import { DiagPanel } from "@/components/groovebox/DiagPanel";
import { useGroove } from "@/lib/store";
import { initSchedulerBindings } from "@/lib/audio/scheduler";
import { bindParamUpdates } from "@/lib/audio/engine";
import { bindInternalSource } from "@/lib/clock/sources/internalSource";

const Index = () => {
  const { tab } = useGroove();

  useEffect(() => {
    initSchedulerBindings();
    bindParamUpdates();
    bindInternalSource();
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <TopBar />

      <main className="flex-1 overflow-y-auto px-3 py-3 pb-24 animate-slide-up">
        <h1 className="sr-only">VibeCoreLiv3 — Mobile Groovebox & Sound Workstation</h1>
        {tab === "MIX" && <MixTab />}
        {tab === "SEQ" && <SeqTab />}
        {tab === "ROLL" && <PianoRollTab />}
        {tab === "ARP" && <ArpPanel />}
        {tab === "FX" && <FxTab />}
        {tab === "SMPL" && <SmplTab />}
        {tab === "SND" && <SoundTab />}
        {tab === "BRN" && <BrainwaveTab />}
        {tab === "SPC" && <SpatialTab />}
        {tab === "AI" && <AiSceneTab />}
        {tab === "PROD" && <ProdTab />}
        {tab === "SYNC" && <SyncTab />}
        {tab === "SETUP" && <SetupTab />}
        {tab === "DBG" && <DiagPanel embedded />}
        {tab === "LIB" && <LibTab />}
        {tab === "VOICE" && <VoiceTab />}
        {tab === "REMIX" && <RemixTab />}
        {tab === "PTN" && <PtnTab />}
        {tab === "PERF" && <PerformanceTab />}
        {tab === "SYNTH3D" && <Synth3DPage />}
        {tab === "BASS3D" && <Bass3DPage />}

      </main>

      <TabBar />
      <DiagPanel />
    </div>
  );
};

export default Index;