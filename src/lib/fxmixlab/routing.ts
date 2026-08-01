// VibeCore FX Mix Lab — Routing Graph.
//
// Manages the routing topology between parts → buses → master, and
// send/return routing. Detects and prevents routing loops via
// topological sort (depth-first search cycle detection).
//
// All functions are pure — operate on routing data structures, not on
// audio nodes. The Audio Engine applies the routing by connecting/
// disconnecting Web Audio nodes based on this topology.

import type { BusChannel, MixerChannel, ReturnChannel } from "./types";

// ── Routing Graph ─────────────────────────────────────────────────────────────

export interface RoutingEdge {
  from: string;  // "part:<id>", "bus:<id>", "return:<id>"
  to: string;    // "bus:<id>", "return:<id>", "master"
  type: "direct" | "send" | "return";
}

export interface RoutingGraph {
  edges: RoutingEdge[];
  /** Adjacency map: from → [to, to, ...] */
  adjacency: Map<string, string[]>;
}

/** Build a routing graph from mixer channels, buses, and returns. */
export function buildRoutingGraph(
  channels: MixerChannel[],
  buses: BusChannel[],
  _returns: ReturnChannel[],
): RoutingGraph {
  const edges: RoutingEdge[] = [];
  const adjacency = new Map<string, string[]>();

  // Normalise a bus target: "master" stays "master"; bus ids get "bus:" prefix.
  const norm = (target: string): string =>
    target === "master" ? target : target.startsWith("bus:") ? target : `bus:${target}`;

  const addEdge = (from: string, to: string, type: RoutingEdge["type"]) => {
    edges.push({ from, to, type });
    if (!adjacency.has(from)) adjacency.set(from, []);
    adjacency.get(from)!.push(to);
  };

  // Part → bus (or master)
  for (const ch of channels) {
    addEdge(`part:${ch.partId}`, norm(ch.busTarget), "direct");
    // Send routing
    for (const send of ch.sends) {
      addEdge(`part:${ch.partId}`, norm(send.busId), "send");
    }
  }

  // Bus → bus (or master)
  for (const bus of buses) {
    addEdge(`bus:${bus.id}`, norm(bus.busTarget), "direct");
  }

  // Returns → master (always)
  for (const ret of _returns) {
    addEdge(`return:${ret.id}`, "master", "return");
  }

  return { edges, adjacency };
}

// ── Loop Detection ────────────────────────────────────────────────────────────

/** Detect cycles in the routing graph using DFS. Returns the first cycle
 *  found as a path array, or null if the graph is acyclic. */
export function detectCycle(graph: RoutingGraph): string[] | null {
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();

  const dfs = (node: string, path: string[]): string[] | null => {
    color.set(node, GRAY);
    path.push(node);
    const neighbors = graph.adjacency.get(node) ?? [];
    for (const next of neighbors) {
      if (next === "master") continue; // master is a sink — never a cycle source
      const c = color.get(next) ?? WHITE;
      if (c === GRAY) {
        // Found a cycle — extract the cycle path
        const cycleStart = path.indexOf(next);
        return path.slice(cycleStart).concat(next);
      }
      if (c === WHITE) {
        const result = dfs(next, path);
        if (result) return result;
      }
    }
    path.pop();
    color.set(node, BLACK);
    return null;
  };

  for (const [node] of graph.adjacency) {
    if ((color.get(node) ?? WHITE) === WHITE) {
      const cycle = dfs(node, []);
      if (cycle) return cycle;
    }
  }
  return null;
}

/** Validate the routing graph — returns null if valid, or an error message
 *  describing the first cycle found. */
export function validateRouting(graph: RoutingGraph): string | null {
  const cycle = detectCycle(graph);
  if (cycle) {
    return `Routing cycle detected: ${cycle.join(" → ")}`;
  }
  return null;
}

// ── Topological Sort ──────────────────────────────────────────────────────────

/** Topologically sort the routing graph in signal-flow order:
 *  sources (parts) first, then buses (in dependency order), then returns,
 *  then master last. */
export function topologicalSort(graph: RoutingGraph): string[] {
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  const result: string[] = [];

  const visit = (node: string) => {
    if ((color.get(node) ?? WHITE) !== WHITE) return;
    color.set(node, GRAY);
    for (const next of graph.adjacency.get(node) ?? []) {
      if (next !== "master") visit(next);
    }
    color.set(node, BLACK);
    result.push(node);
  };

  for (const [node] of graph.adjacency) visit(node);
  // DFS post-order gives reverse topological (sinks first). Reverse for
  // signal-flow order (sources first, master last).
  result.reverse();
  result.push("master");
  return result;
}

// ── Routing Helpers ───────────────────────────────────────────────────────────

/** Check if routing from `from` to `to` would create a cycle. */
export function wouldCreateCycle(
  channels: MixerChannel[],
  buses: BusChannel[],
  returns: ReturnChannel[],
  from: string,
  to: string,
): boolean {
  // Simulate the edge and check for cycles
  const testBuses = buses.map((b) =>
    b.id === from.replace("bus:", "")
      ? { ...b, busTarget: to }
      : b
  );
  const testChannels = channels.map((ch) =>
    `part:${ch.partId}` === from
      ? { ...ch, busTarget: to }
      : ch
  );
  const graph = buildRoutingGraph(testChannels, testBuses, returns);
  return detectCycle(graph) !== null;
}

/** Get all parts routed to a specific bus. */
export function partsForBus(channels: MixerChannel[], busId: string): number[] {
  return channels.filter((ch) => ch.busTarget === busId).map((ch) => ch.partId);
}

/** Get all buses that feed into master. */
export function busesToMaster(buses: BusChannel[]): BusChannel[] {
  return buses.filter((b) => b.busTarget === "master");
}

/** Get all send targets for a part. */
export function sendsForPart(channels: MixerChannel[], partId: number): { busId: string; level: number; preFader: boolean }[] {
  return channels.find((ch) => ch.partId === partId)?.sends ?? [];
}