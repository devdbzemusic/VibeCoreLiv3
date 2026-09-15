import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearPreferences,
  grantLearningConsent,
  hasLearningConsent,
  inferPreferences,
  loadPreferences,
  recordPreference,
  revokeLearningConsent,
} from "./learning";

function installLocalStorage() {
  const data = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
    clear: () => data.clear(),
  });
}

describe("AI learning consent", () => {
  beforeEach(() => {
    installLocalStorage();
  });

  it("does not record preferences before explicit opt-in", () => {
    const projectId = "learning-no-consent";
    recordPreference(projectId, "swing", 58);
    expect(loadPreferences(projectId).swing).toBeUndefined();
    expect(hasLearningConsent(projectId)).toBe(false);
  });

  it("records preferences after explicit opt-in with sources and uses", () => {
    const projectId = "learning-consent";
    grantLearningConsent(projectId, {
      sources: ["current-project", "selected-patterns"],
      uses: ["suggestions", "arrangement"],
    });

    recordPreference(projectId, "swing", 61);
    const loaded = loadPreferences(projectId);
    expect(loaded.swing).toBe(61);
    expect(loaded.consent?.enabled).toBe(true);
    expect(loaded.consent?.sources).toContain("selected-patterns");
    expect(loaded.consent?.uses).toContain("arrangement");
  });

  it("persists inferred preferences only while consent is active", () => {
    const projectId = "learning-infer";
    grantLearningConsent(projectId);
    const inferred = inferPreferences({
      swing: 54,
      density: 0.5,
      energy: 0.7,
      parts: [{ category: "kick" }, { category: "kick" }, { category: "bass" }],
    }, projectId);

    expect(inferred.humanize).toBe(25);
    expect(inferred.instrumentation).toEqual({ kick: 2, bass: 1 });
  });

  it("revocation removes learned fields and blocks future learning", () => {
    const projectId = "learning-revoke";
    grantLearningConsent(projectId);
    recordPreference(projectId, "swing", 62);
    revokeLearningConsent(projectId);
    recordPreference(projectId, "humanize", 30);

    const loaded = loadPreferences(projectId);
    expect(loaded.consent?.enabled).toBe(false);
    expect(loaded.swing).toBeUndefined();
    expect(loaded.humanize).toBeUndefined();
  });

  it("clear removes the whole project profile", () => {
    const projectId = "learning-clear";
    grantLearningConsent(projectId);
    clearPreferences(projectId);
    expect(loadPreferences(projectId).consent).toBeUndefined();
  });
});
