import { describe, expect, it, beforeEach } from "vitest";
import { enforceRateLimit } from "../src/layers/security/rateLimiter";

class MemoryKV implements KVNamespace {
  private store = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async put(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  // The following methods satisfy the KVNamespace interface but are unused in tests.
  async list(): Promise<KVNamespaceListResult<unknown>> {
    return { keys: [], list_complete: true }; // minimal implementation
  }

  async getWithMetadata<T>(): Promise<KVNamespaceGetWithMetadataResult<T>> {
    throw new Error("Not implemented in MemoryKV");
  }

  async putWithMetadata<T>(): Promise<void> {
    throw new Error("Not implemented in MemoryKV");
  }
}

describe("enforceRateLimit", () => {
  let kv: MemoryKV;

  beforeEach(() => {
    kv = new MemoryKV();
  });

  it("allows requests under the limit", async () => {
    const result = await enforceRateLimit("user@example.com", {
      kv,
      limit: 3,
      windowSeconds: 60,
      now: 0,
    });

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it("blocks requests above the limit", async () => {
    const key = "user@example.com";

    for (let i = 0; i < 3; i += 1) {
      const allowed = await enforceRateLimit(key, {
        kv,
        limit: 3,
        windowSeconds: 60,
        now: 0,
      });
      expect(allowed.allowed).toBe(true);
    }

    const blocked = await enforceRateLimit(key, {
      kv,
      limit: 3,
      windowSeconds: 60,
      now: 0,
    });

    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("resets counts in a new window", async () => {
    const key = "user@example.com";
    const windowSeconds = 60;

    await enforceRateLimit(key, {
      kv,
      limit: 1,
      windowSeconds,
      now: 0,
    });

    const nextWindow = await enforceRateLimit(key, {
      kv,
      limit: 1,
      windowSeconds,
      now: windowSeconds * 1000 + 1,
    });

    expect(nextWindow.allowed).toBe(true);
    expect(nextWindow.remaining).toBe(0);
  });
});
