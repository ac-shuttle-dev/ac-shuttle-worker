import { describe, expect, it } from "vitest";
import { computeTransactionId } from "../src/layers/coordination/transaction";

describe("computeTransactionId", () => {
  it("produces deterministic hashes", async () => {
    const input = {
      customerName: "Ada Lovelace",
      startLocation: "Point A",
      endLocation: "Point B",
      pickupTime: "2025-09-22T12:00:00Z",
      submittedAt: "2025-09-22T00:00:00Z",
      customerEmail: "ada@example.com",
    };

    const first = await computeTransactionId(input);
    const second = await computeTransactionId(input);

    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
  });
});
