// Sound Forge Engine — Node registry.
// Sprint 1 registers SampleSource + FMSource. Future nodes append here.

import type { ForgeNodeDescriptor, ForgeNodeKind } from "./types";
import type { ForgeNode, ForgeNodeFactory } from "./node";
import { createSampleSource, SampleSourceDescriptor } from "./nodes/SampleSourceNode";
import { createFMSource, FMSourceDescriptor } from "./nodes/FMSourceNode";
import { createNoiseSource, NoiseSourceDescriptor } from "./nodes/NoiseSourceNode";
import { createEnvPerc, EnvPercDescriptor } from "./nodes/EnvPercNode";

interface Entry {
  descriptor: ForgeNodeDescriptor;
  factory: ForgeNodeFactory;
}

const registry = new Map<ForgeNodeKind, Entry>();

export function registerForgeNode(descriptor: ForgeNodeDescriptor, factory: ForgeNodeFactory): void {
  registry.set(descriptor.kind, { descriptor, factory });
}

export function getForgeDescriptor(kind: ForgeNodeKind): ForgeNodeDescriptor | undefined {
  return registry.get(kind)?.descriptor;
}

export function listForgeDescriptors(): ForgeNodeDescriptor[] {
  return Array.from(registry.values()).map((e) => e.descriptor);
}

export function createForgeNode(
  kind: ForgeNodeKind,
  id: string,
  params: Record<string, number> = {},
): ForgeNode {
  const entry = registry.get(kind);
  if (!entry) throw new Error(`Unknown forge node kind: ${kind}`);
  return entry.factory(id, params);
}

// Bootstrap built-ins.
registerForgeNode(SampleSourceDescriptor, createSampleSource);
registerForgeNode(FMSourceDescriptor, createFMSource);
registerForgeNode(NoiseSourceDescriptor, createNoiseSource);
registerForgeNode(EnvPercDescriptor, createEnvPerc);
