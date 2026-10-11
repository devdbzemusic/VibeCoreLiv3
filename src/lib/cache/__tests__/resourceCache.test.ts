import { describe, expect, it } from "vitest";
import { ResourceCache } from "../resourceCache";
import { analysisCacheKey } from "../analysisCache";

function cache(maxBytes = 10, maxEntries?: number) {
  return new ResourceCache<string, string>({
    maxBytes,
    maxEntries,
    estimateBytes: (value) => value.length,
  });
}

describe("ResourceCache", () => {
  it("evicts the least-recently-used unreferenced entry when over byte budget", () => {
    const c = cache(6);
    c.set("a", "aaa");
    c.set("b", "bbb");
    expect(c.get("a")).toBe("aaa"); // a becomes most recently used

    c.set("c", "ccc");

    expect(c.peek("a")).toBe("aaa");
    expect(c.peek("b")).toBeUndefined();
    expect(c.peek("c")).toBe("ccc");
    expect(c.stats().evictions).toBe(1);
  });

  it("never evicts retained entries and retries budget enforcement on release", () => {
    const c = cache(4);
    c.set("held", "xxxx");
    expect(c.acquire("held")).toBe("xxxx");

    c.set("other", "yyyy");

    // `other` is the only unreferenced candidate, so it is evicted first and
    // the retained entry survives.
    expect(c.peek("held")).toBe("xxxx");
    expect(c.peek("other")).toBeUndefined();
    expect(c.stats().references).toBe(1);

    expect(c.release("held")).toBe(true);
    expect(c.stats().references).toBe(0);
  });

  it("can temporarily exceed budget when every entry is retained", () => {
    const c = cache(4);
    c.set("a", "aaaa");
    c.acquire("a");

    // Insert then retain b while a is held. The insertion can evict b before
    // acquisition, so create the oversize state through replacing retained a.
    c.set("a", "abcdefgh");
    expect(c.stats().bytes).toBe(8);
    expect(c.peek("a")).toBe("abcdefgh");

    c.release("a");
    expect(c.peek("a")).toBeUndefined();
    expect(c.stats().bytes).toBe(0);
  });

  it("preserves reference count when replacing a retained resource", () => {
    const c = cache(20);
    c.set("a", "old");
    c.acquire("a");
    c.set("a", "new-value");

    expect(c.peek("a")).toBe("new-value");
    expect(c.stats().references).toBe(1);
    expect(c.stats().replacements).toBe(1);
    expect(c.release("a")).toBe(true);
  });

  it("enforces max entry count independently of byte budget", () => {
    const c = cache(100, 2);
    c.set("a", "a");
    c.set("b", "b");
    c.get("a");
    c.set("c", "c");

    expect(c.peek("a")).toBe("a");
    expect(c.peek("b")).toBeUndefined();
    expect(c.peek("c")).toBe("c");
  });
});

describe("analysisCacheKey", () => {
  it("changes when algorithm version or settings change", () => {
    const base = {
      audioHash: "audio-123",
      algorithm: "bpm",
      algorithmVersion: 1,
      settingsHash: "default",
    };

    const a = analysisCacheKey(base);
    const b = analysisCacheKey({ ...base, algorithmVersion: 2 });
    const c = analysisCacheKey({ ...base, settingsHash: "sensitive" });

    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });
});
