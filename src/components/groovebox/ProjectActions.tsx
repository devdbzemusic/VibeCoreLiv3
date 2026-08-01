// VibeCoreLiv3 — Project-Actions UI (.vcl3 Container Import/Export + Signatur).
// Export schreibt einen v2-Container (ZIP: Manifest + v1-Body + eingebettete
// Samples + Plugin-Slots), Import erkennt v1-JSON ⇄ v2-Container automatisch
// und verifiziert optional eine Ed25519-Manifest-Signatur.
// Realtime-neutral — Audio-Interaktion nur beim Decodieren eingebetteter
// Samples im Nachgang (best-effort, gekapselt).

import { useRef, useState } from "react";
import { Download, Upload, FileDown } from "lucide-react";
import { downloadVcl3Container, detectAndLoad, type Compression } from "@/lib/vcl3/container";
import { type VerifyPolicy, type SignatureVerification, type SignatureState } from "@/lib/vcl3/signing";
import { useGroove } from "@/lib/store";

const SIG_LABEL: Record<SignatureState, string> = {
  "verified": "· SIGNATUR ✓",
  "unsigned": "· unsigniert",
  "untrusted-key": "· KEY NICHT VERTRAUT",
  "invalid-signature": "· SIGNATUR UNGÜLTIG",
  "unsupported": "· SIGNATUR NICHT PRÜFBAR",
};

export function ProjectActions() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [compress, setCompress] = useState<Compression>("store");
  const [policy, setPolicy] = useState<VerifyPolicy>("warn");
  const flash = (m: string) => {
    setMsg(m);
    window.setTimeout(() => setMsg(null), 3200);
  };

  const onExport = async () => {
    setBusy(true);
    try {
      const pat = useGroove.getState().patterns[useGroove.getState().selectedPattern];
      const name = pat?.name ?? "untitled";
      const r = await downloadVcl3Container(name, compress);
      flash(`Exportiert · ${r.bytes > 1024 ? `${(r.bytes / 1024).toFixed(0)} KB` : `${r.bytes} B`} · ${compress === "deflate" ? "deflate" : "store"}`);
    } catch (e) {
      flash(`Export-Fehler: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const onImport = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    try {
      const res = await detectAndLoad(file, policy);
      if (res.ok && res.project) {
        const ver = res.manifest ? "v2" : "v1";
        const integ = `integrität ${res.integrityOk ? "ok" : "FEHLT"}`;
        const sig = res.signature ? ` ${SIG_LABEL[res.signature.state]}` : "";
        flash(`„${res.project.name}" geladen (${ver} · ${integ}${sig})`);
      } else {
        flash(`Fehler: ${res.error ?? "unbekannt"}`);
      }
    } catch (e) {
      flash(`Import-Fehler: ${(e as Error).message}`);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="panel p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="font-display text-xs text-primary flex items-center gap-1.5">
          <FileDown className="h-3.5 w-3.5" /> PROJECT · .vcl3
        </div>
        <div className="font-mono text-[10px] text-muted-foreground">Container v2 · Ed25519</div>
      </div>
      <div className="hairline" />
      <p className="text-[11px] text-muted-foreground leading-snug">
        Vollständiger Projektstand als ZIP-Container: Manifest, v1-Body, eingebettete Samples, Plugin-Slots. Optionale Ed25519-Signaturverifikation.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
          <span className="uppercase shrink-0">Komp.</span>
          <select
            value={compress}
            onChange={(e) => setCompress(e.target.value as Compression)}
            className="bg-transparent text-primary font-display text-xs outline-none w-full"
          >
            <option value="store">store</option>
            <option value="deflate">deflate</option>
          </select>
        </label>
        <label className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
          <span className="uppercase shrink-0">Sig.</span>
          <select
            value={policy}
            onChange={(e) => setPolicy(e.target.value as VerifyPolicy)}
            className="bg-transparent text-primary font-display text-xs outline-none w-full"
          >
            <option value="off">off</option>
            <option value="warn">warn</option>
            <option value="require">require</option>
          </select>
        </label>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onExport}
          disabled={busy}
          className="flex-1 h-9 rounded panel-inset flex items-center justify-center gap-1.5 text-primary text-xs disabled:opacity-50"
        >
          <Download className="h-3.5 w-3.5" /> EXPORT .vcl3
        </button>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="flex-1 h-9 rounded panel-inset flex items-center justify-center gap-1.5 text-neon-cyan text-xs disabled:opacity-50"
        >
          <Upload className="h-3.5 w-3.5" /> IMPORT .vcl3
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".vcl3,.vcl3.json,.zip,application/zip,application/json"
          className="hidden"
          onChange={(e) => onImport(e.target.files?.[0] ?? null)}
        />
      </div>
      {msg && (
        <div className="font-mono text-[10px] text-muted-foreground tracking-wider break-words">{msg}</div>
      )}
    </div>
  );
}