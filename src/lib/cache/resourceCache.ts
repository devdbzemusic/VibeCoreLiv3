export interface ResourceCacheOptions<K, V> {
  /** Hard byte budget. Entries with active references are never evicted. */
  maxBytes: number;
  /** Optional hard entry-count budget. */
  maxEntries?: number;
  /** Deterministic resource-size estimator. */
  estimateBytes: (value: V, key: K) => number;
}

export interface ResourceCacheStats {
  entries: number;
  bytes: number;
  referencedEntries: number;
  references: number;
  hits: number;
  misses: number;
  evictions: number;
  replacements: number;
}

interface Entry<V> {
  value: V;
  bytes: number;
  refs: number;
  access: number;
}

/**
 * Deterministic budgeted LRU resource cache.
 *
 * Design rules:
 * - no wall-clock dependency (`Date.now` / `performance.now`)
 * - no background timer
 * - active references are never evicted
 * - explicit acquire/release lifecycle for runtime resources
 * - byte and entry budgets enforced synchronously on control thread
 * - no audio-callback use; callers must prepare/acquire before realtime render
 */
export class ResourceCache<K, V> {
  private readonly entries = new Map<K, Entry<V>>();
  private accessCounter = 0;
  private bytes = 0;
  private hits = 0;
  private misses = 0;
  private evictions = 0;
  private replacements = 0;

  constructor(private readonly options: ResourceCacheOptions<K, V>) {
    if (!Number.isFinite(options.maxBytes) || options.maxBytes < 0) {
      throw new Error("ResourceCache maxBytes must be a finite non-negative number");
    }
    if (options.maxEntries != null && (!Number.isInteger(options.maxEntries) || options.maxEntries < 0)) {
      throw new Error("ResourceCache maxEntries must be a non-negative integer");
    }
  }

  private touch(entry: Entry<V>): void {
    entry.access = ++this.accessCounter;
  }

  private normalizeBytes(value: V, key: K): number {
    const raw = this.options.estimateBytes(value, key);
    return Number.isFinite(raw) ? Math.max(0, Math.ceil(raw)) : 0;
  }

  has(key: K): boolean {
    return this.entries.has(key);
  }

  peek(key: K): V | undefined {
    return this.entries.get(key)?.value;
  }

  /** Read + LRU touch without retaining a runtime reference. */
  get(key: K): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }
    this.hits++;
    this.touch(entry);
    return entry.value;
  }

  /** Read + LRU touch + retain. Must be paired with release(key). */
  acquire(key: K): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }
    this.hits++;
    entry.refs++;
    this.touch(entry);
    return entry.value;
  }

  release(key: K): boolean {
    const entry = this.entries.get(key);
    if (!entry || entry.refs <= 0) return false;
    entry.refs--;
    this.evictToBudget();
    return true;
  }

  set(key: K, value: V): void {
    const previous = this.entries.get(key);
    const bytes = this.normalizeBytes(value, key);

    if (previous) {
      this.bytes -= previous.bytes;
      this.entries.set(key, {
        value,
        bytes,
        refs: previous.refs,
        access: ++this.accessCounter,
      });
      this.bytes += bytes;
      this.replacements++;
    } else {
      this.entries.set(key, {
        value,
        bytes,
        refs: 0,
        access: ++this.accessCounter,
      });
      this.bytes += bytes;
    }

    this.evictToBudget();
  }

  /**
   * Delete only when unreferenced unless `force=true` is explicitly requested.
   * Returns false when deletion is refused due to active references.
   */
  delete(key: K, force = false): boolean {
    const entry = this.entries.get(key);
    if (!entry) return false;
    if (entry.refs > 0 && !force) return false;
    this.entries.delete(key);
    this.bytes -= entry.bytes;
    return true;
  }

  /** Clear only unreferenced resources by default. */
  clear(force = false): number {
    let removed = 0;
    for (const [key, entry] of this.entries) {
      if (entry.refs > 0 && !force) continue;
      this.entries.delete(key);
      this.bytes -= entry.bytes;
      removed++;
    }
    if (this.bytes < 0) this.bytes = 0;
    return removed;
  }

  stats(): ResourceCacheStats {
    let referencedEntries = 0;
    let references = 0;
    for (const entry of this.entries.values()) {
      if (entry.refs > 0) referencedEntries++;
      references += entry.refs;
    }
    return {
      entries: this.entries.size,
      bytes: this.bytes,
      referencedEntries,
      references,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      replacements: this.replacements,
    };
  }

  resetCounters(): void {
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
    this.replacements = 0;
  }

  private overBudget(): boolean {
    if (this.bytes > this.options.maxBytes) return true;
    const maxEntries = this.options.maxEntries;
    return maxEntries != null && this.entries.size > maxEntries;
  }

  private evictToBudget(): void {
    while (this.overBudget()) {
      let candidateKey: K | undefined;
      let oldestAccess = Number.POSITIVE_INFINITY;

      for (const [key, entry] of this.entries) {
        if (entry.refs > 0) continue;
        if (entry.access < oldestAccess) {
          oldestAccess = entry.access;
          candidateKey = key;
        }
      }

      // Budget can temporarily be exceeded when every candidate is retained.
      // The next release() call retries eviction synchronously.
      if (candidateKey === undefined) return;

      const entry = this.entries.get(candidateKey);
      if (!entry) return;
      this.entries.delete(candidateKey);
      this.bytes -= entry.bytes;
      this.evictions++;
    }
  }
}
