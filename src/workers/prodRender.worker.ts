// Web Worker for procedural sample rendering. Keeps the UI thread responsive
// on low-end Android while a 1–3 s sample is synthesized.

import { renderProdSample, type ProdParams, type ProdRenderOptions } from "@/lib/audio/prodRender";

interface RenderRequest {
  id: number;
  params: ProdParams;
  opts: ProdRenderOptions;
}
interface RenderResponse {
  id: number;
  sampleRate: number;
  length: number;
  channels: Float32Array[];
}

self.addEventListener("message", (ev: MessageEvent<RenderRequest>) => {
  const { id, params, opts } = ev.data;
  const out = renderProdSample(params, opts);
  const msg: RenderResponse = {
    id,
    sampleRate: out.sampleRate,
    length: out.length,
    channels: out.channels,
  };
  // Transfer underlying buffers — zero-copy back to the main thread.
  const transfers = out.channels.map((c) => c.buffer);
  (self as unknown as Worker).postMessage(msg, transfers as Transferable[]);
});

export {};
