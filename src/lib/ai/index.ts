// VibeCore AI — Public API Barrel.
//
// Zentrale Einstiegstelle für das VibeCore AI-System. Re-exportiert alle
// Assistenten, die Engine, das Kontextsystem, Presets und das Lernsystem.
//
// VibeCore AI besitzt keine eigene Audio Engine, keinen DSP Core, keinen
// Sequencer, keine Clock und keine eigene Projektverwaltung. Alle Assistenz-
// funktionen sind PURE, DETERMINISTISCHE Funktionen, die Vorschläge erzeugen,
// die der Nutzer bestätigt und die über bestehende Store-Actions angewendet
// werden.

// ── Core ──────────────────────────────────────────────────────────────────────
export * from "./types";
export * from "./engine";
export * from "./context";
export * from "./presets";

// ── Assistants ────────────────────────────────────────────────────────────────
export * from "./grooveAssistant";
export * from "./melodyAssistant";
export * from "./harmonyAssistant";
export * from "./automationAssistant";
export * from "./arrangementAssistant";
export * from "./mixAssistant";
export * from "./sampleAssistant";
export * from "./voiceAssistant";
export * from "./remixAssistant";
export * from "./liveAssistant";

// ── Learning ──────────────────────────────────────────────────────────────────
export * from "./learning";

// ── Self-Test ──────────────────────────────────────────────────────────────────
export { runAiSelfTests, type AiTestReport } from "./selfTest";