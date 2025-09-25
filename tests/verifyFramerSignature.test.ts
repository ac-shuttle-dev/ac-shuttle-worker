import { describe, expect, it } from "vitest";
import { verifyFramerSignature, bufferToHex } from "../src/layers/security/hmac";

const encoder = new TextEncoder();

async function createSignature(
  secret: string,
  submissionId: string,
  body: string
): Promise<{ signature: string; bodyBuffer: ArrayBuffer }> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const bodyBytes = encoder.encode(body);
  const submissionBytes = encoder.encode(submissionId);
  const combined = new Uint8Array(bodyBytes.length + submissionBytes.length);
  combined.set(bodyBytes, 0);
  combined.set(submissionBytes, bodyBytes.length);

  const digest = await crypto.subtle.sign("HMAC", key, combined);
  const signature = `sha256=${bufferToHex(digest)}`;

  // Ensure we pass an ArrayBuffer that exactly matches the body bytes.
  const bodyBuffer = bodyBytes.buffer.slice(
    bodyBytes.byteOffset,
    bodyBytes.byteOffset + bodyBytes.byteLength
  );

  return { signature, bodyBuffer };
}

describe("verifyFramerSignature", () => {
  const secret = "super-secret-key";
  const submissionId = "submission-123";
  const payload = JSON.stringify({ example: true });

  it("accepts a valid Framer signature", async () => {
    const { signature, bodyBuffer } = await createSignature(secret, submissionId, payload);
    await expect(
      verifyFramerSignature(secret, submissionId, bodyBuffer, signature)
    ).resolves.toBe(true);
  });

  it("rejects a tampered payload", async () => {
    const { signature, bodyBuffer } = await createSignature(secret, submissionId, payload);
    const alteredPayload = encoder.encode(JSON.stringify({ example: false }));
    const alteredBuffer = alteredPayload.buffer.slice(
      alteredPayload.byteOffset,
      alteredPayload.byteOffset + alteredPayload.byteLength
    );

    await expect(
      verifyFramerSignature(secret, submissionId, alteredBuffer, signature)
    ).resolves.toBe(false);
  });

  it("rejects an invalid signature prefix", async () => {
    const { bodyBuffer } = await createSignature(secret, submissionId, payload);
    await expect(
      verifyFramerSignature(secret, submissionId, bodyBuffer, "invalid=deadbeef")
    ).resolves.toBe(false);
  });
});
