// Sound Forge Engine — block-based graph executor.
// Topological ordering, per-block processing, mono channels in Sprint 1.

import { createForgeNode } from "./registry";
import type { ForgeNode, ForgeNodeInitOptions } from "./node";
import type {
  ForgeAudioBlock,
  ForgeControlMsg,
  ForgeEdge,
  ForgePreset,
} from "./types";

interface RuntimeNode {
  id: string;
  node: ForgeNode;
  inputs: ForgeAudioBlock;
  outputs: ForgeAudioBlock;
  pendingCtrl: ForgeControlMsg[];
}

export class ForgeGraph {
  private nodes = new Map<string, RuntimeNode>();
  private edges: ForgeEdge[] = [];
  private order: string[] = [];
  private opts: ForgeNodeInitOptions;
  /** Designated output node id. If null, last node in topo order is used. */
  private outputId: string | null = null;

  constructor(opts: ForgeNodeInitOptions) {
    this.opts = opts;
  }

  /** Build graph from a serialized preset. Validates referenced kinds + edges. */
  loadPreset(preset: ForgePreset): void {
    this.dispose();
    if (preset.version !== 1) throw new Error(`Unsupported preset version ${preset.version}`);
    for (const ns of preset.nodes) {
      const node = createForgeNode(ns.kind, ns.id, ns.params);
      node.init(this.opts);
      const desc = (node as unknown as { descriptor?: { inputs: number; outputs: number } }).descriptor;
      const ins = desc?.inputs ?? 0;
      const outs = desc?.outputs ?? 1;
      this.nodes.set(ns.id, {
        id: ns.id,
        node,
        inputs: Array.from({ length: ins }, () => new Float32Array(this.opts.blockSize)),
        outputs: Array.from({ length: outs }, () => new Float32Array(this.opts.blockSize)),
        pendingCtrl: [],
      });
    }
    for (const e of preset.edges) {
      if (!this.nodes.has(e.from) || !this.nodes.has(e.to)) {
        throw new Error(`Edge references missing node: ${e.from} -> ${e.to}`);
      }
    }
    this.edges = [...preset.edges];
    this.order = topoSort(preset.nodes.map((n) => n.id), this.edges);
  }

  setOutputNode(id: string): void {
    if (!this.nodes.has(id)) throw new Error(`Unknown output node id: ${id}`);
    this.outputId = id;
  }

  /** Queue a control message for the next process() call. */
  queueControl(nodeId: string, msg: ForgeControlMsg): void {
    this.nodes.get(nodeId)?.pendingCtrl.push(msg);
  }

  getNode(id: string): ForgeNode | undefined {
    return this.nodes.get(id)?.node;
  }

  /** Process one block. Returns the chosen output node's first output channel. */
  process(): Float32Array {
    // Zero all input buffers before summing.
    for (const rt of this.nodes.values()) {
      for (const ch of rt.inputs) ch.fill(0);
    }
    // Sum edges from already-computed sources requires topo order:
    // process in order, but inputs of node X come from edges where to === X.
    for (const id of this.order) {
      const rt = this.nodes.get(id)!;
      // Gather inputs from incoming edges.
      for (const e of this.edges) {
        if (e.to !== id) continue;
        const src = this.nodes.get(e.from);
        if (!src) continue;
        const srcCh = src.outputs[e.fromPort];
        const dstCh = rt.inputs[e.toPort];
        if (!srcCh || !dstCh) continue;
        for (let i = 0; i < dstCh.length; i++) dstCh[i] += srcCh[i];
      }
      rt.node.process(rt.inputs, rt.outputs, rt.pendingCtrl);
      rt.pendingCtrl.length = 0;
    }
    const outId = this.outputId ?? this.order[this.order.length - 1];
    return this.nodes.get(outId)!.outputs[0];
  }

  /** Serialize the live graph back to a preset (params only — kinds/edges preserved). */
  toPreset(name = "untitled"): ForgePreset {
    const nodes = Array.from(this.nodes.values()).map((rt) => ({
      id: rt.id,
      kind: rt.node.kind,
      params: { ...(rt.node as unknown as { params: Record<string, number> }).params },
    }));
    return { version: 1, name, nodes, edges: [...this.edges] };
  }

  dispose(): void {
    for (const rt of this.nodes.values()) rt.node.dispose?.();
    this.nodes.clear();
    this.edges = [];
    this.order = [];
    this.outputId = null;
  }
}

/** Kahn's algorithm — throws on cycles. */
function topoSort(ids: string[], edges: ForgeEdge[]): string[] {
  const inDeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const id of ids) { inDeg.set(id, 0); adj.set(id, []); }
  for (const e of edges) {
    if (e.from === e.to) continue;
    adj.get(e.from)!.push(e.to);
    inDeg.set(e.to, (inDeg.get(e.to) ?? 0) + 1);
  }
  const queue: string[] = [];
  inDeg.forEach((d, id) => { if (d === 0) queue.push(id); });
  const out: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    out.push(id);
    for (const n of adj.get(id) ?? []) {
      const d = (inDeg.get(n) ?? 0) - 1;
      inDeg.set(n, d);
      if (d === 0) queue.push(n);
    }
  }
  if (out.length !== ids.length) throw new Error("ForgeGraph: cycle detected");
  return out;
}
