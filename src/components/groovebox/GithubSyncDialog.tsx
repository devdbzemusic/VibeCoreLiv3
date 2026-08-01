import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Github, ExternalLink, Check, FileArchive } from "lucide-react";
import { cn } from "@/lib/utils";
import { downloadSourceZip } from "@/lib/downloadSource";

const STORAGE_KEY = "vibecore_github_sync";

export interface GithubSyncConfig {
  repoUrl: string;
  branch: string;
  authorName: string;
  authorEmail: string;
  autoSync: boolean;
  connectedAt: number | null;
}

const DEFAULT: GithubSyncConfig = {
  repoUrl: "",
  branch: "main",
  authorName: "",
  authorEmail: "",
  autoSync: true,
  connectedAt: null,
};

function load(): GithubSyncConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT;
    return { ...DEFAULT, ...JSON.parse(raw) };
  } catch { return DEFAULT; }
}

function save(cfg: GithubSyncConfig) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)); } catch { /* ignore */ }
}

export function GithubSyncDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [cfg, setCfg] = useState<GithubSyncConfig>(DEFAULT);
  const [saved, setSaved] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [dlResult, setDlResult] = useState<string | null>(null);

  useEffect(() => {
    if (open) { setCfg(load()); setSaved(false); setDlResult(null); }
  }, [open]);

  const onDownload = async () => {
    setDownloading(true); setDlResult(null);
    try {
      const r = await downloadSourceZip();
      setDlResult(`${r.files} Dateien · ${(r.bytes / 1024).toFixed(0)} KB`);
    } catch (e) {
      setDlResult(`Fehler: ${(e as Error).message}`);
    } finally {
      setDownloading(false);
    }
  };

  const set = (k: keyof GithubSyncConfig, v: string | boolean) =>
    setCfg((c) => ({ ...c, [k]: v }));

  const connect = () => {
    const next = { ...cfg, connectedAt: Date.now() };
    save(next);
    setCfg(next);
    setSaved(true);
  };

  const disconnect = () => {
    const next = { ...DEFAULT };
    save(next);
    setCfg(next);
    setSaved(false);
  };

  const repoValid = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/.test(cfg.repoUrl.trim());

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="panel max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display tracking-widest text-primary flex items-center gap-2">
            <Github className="h-4 w-4" /> GITHUB 2-WAY SYNC
          </DialogTitle>
          <DialogDescription className="font-mono text-[10px] text-muted-foreground">
            Verstecktes Setup · konfiguriert den automatischen Repo-Sync für VibeCore.
          </DialogDescription>
        </DialogHeader>

        {cfg.connectedAt ? (
          <div className="hw-bezel p-3 flex items-center gap-2 font-mono text-[11px] text-neon-lime">
            <Check className="h-4 w-4" /> Konfiguriert · {new Date(cfg.connectedAt).toLocaleString()}
          </div>
        ) : (
          <div className="font-mono text-[10px] text-muted-foreground">
            Noch nicht verbunden — Repo-Daten eingeben und „Verbinden" bestätigen.
          </div>
        )}

        <div className="space-y-3">
          <div>
            <Label className="font-mono text-[10px] text-muted-foreground">REPO URL</Label>
            <Input
              value={cfg.repoUrl}
              onChange={(e) => set("repoUrl", e.target.value)}
              placeholder="https://github.com/user/vibecore"
              className="font-mono text-[11px]"
            />
            {cfg.repoUrl && !repoValid && (
              <div className="font-mono text-[9px] text-neon-crimson mt-1">
                Format: https://github.com/user/repo
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="font-mono text-[10px] text-muted-foreground">BRANCH</Label>
              <Input
                value={cfg.branch}
                onChange={(e) => set("branch", e.target.value)}
                className="font-mono text-[11px]"
              />
            </div>
            <div>
              <Label className="font-mono text-[10px] text-muted-foreground">AUTO-SYNC</Label>
              <button
                type="button"
                onClick={() => set("autoSync", !cfg.autoSync)}
                data-active={cfg.autoSync}
                className={cn("tab-pill w-full py-2 font-mono text-[10px] border border-border", cfg.autoSync ? "text-primary" : "text-muted-foreground")}
              >
                {cfg.autoSync ? "AN" : "AUS"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="font-mono text-[10px] text-muted-foreground">AUTHOR NAME</Label>
              <Input
                value={cfg.authorName}
                onChange={(e) => set("authorName", e.target.value)}
                placeholder="VibeCore"
                className="font-mono text-[11px]"
              />
            </div>
            <div>
              <Label className="font-mono text-[10px] text-muted-foreground">AUTHOR EMAIL</Label>
              <Input
                value={cfg.authorEmail}
                onChange={(e) => set("authorEmail", e.target.value)}
                placeholder="dev@vibecore.app"
                className="font-mono text-[11px]"
              />
            </div>
          </div>
        </div>

        <div className="hw-divider my-3" />

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="font-mono text-[10px] text-muted-foreground flex items-center gap-1.5">
              <FileArchive className="h-3.5 w-3.5" /> SOURCE EXPORT
            </Label>
            {dlResult && <span className="font-mono text-[9px] text-neon-lime">{dlResult}</span>}
          </div>
          <Button
            onClick={onDownload}
            disabled={downloading}
            variant="outline"
            className="w-full font-mono text-[10px] gap-2"
          >
            <FileArchive className="h-3.5 w-3.5" />
            {downloading ? "PACKE ZIP…" : "DOWNLOAD SOURCECODE.ZIP"}
          </Button>
          <div className="font-mono text-[9px] text-muted-foreground leading-relaxed">
            Packt src/, base44/ und Root-Configs client-seitig als ZIP — ohne node_modules, Build-Artefakte & native Android.
          </div>
        </div>

        <div className="hw-screen p-2 font-mono text-[9px] leading-relaxed text-primary/80">
          Hinweis: Die finale Verbindung wird in Base44 Settings → GitHub
          aktiviert (2-way sync). Diese Konfiguration wird lokal gespeichert
          und beim Verbinden als Vorgabe übernommen.
        </div>

        <DialogFooter className="gap-2">
          {repoValid && (
            <a href={cfg.repoUrl} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 font-mono text-[10px] text-primary">
              <ExternalLink className="h-3 w-3" /> Repo öffnen
            </a>
          )}
          {cfg.connectedAt ? (
            <Button variant="outline" onClick={disconnect} className="font-mono text-[10px]">
              Trennen
            </Button>
          ) : (
            <Button onClick={connect} disabled={!repoValid}
              className="font-mono text-[10px]">
              <Github className="h-3 w-3 mr-1" /> Verbinden
            </Button>
          )}
          {saved && (
            <span className="font-mono text-[10px] text-neon-lime flex items-center gap-1">
              <Check className="h-3 w-3" /> Gespeichert
            </span>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}