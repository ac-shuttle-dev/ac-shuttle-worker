const encoder = new TextEncoder();

export async function verifyFramerSignature(
  secret: string,
  submissionId: string,
  body: ArrayBuffer,
  providedSignature: string
): Promise<boolean> {
  const prefix = "sha256=";
  if (!providedSignature || !providedSignature.startsWith(prefix)) {
    return false;
  }

  const signatureHex = providedSignature.slice(prefix.length).toLowerCase();
  if (signatureHex.length !== 64 || !/^[0-9a-f]+$/.test(signatureHex)) {
    return false;
  }

  const secretKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const submissionBytes = encoder.encode(submissionId);
  const bodyBytes = new Uint8Array(body);
  const combined = new Uint8Array(bodyBytes.length + submissionBytes.length);
  combined.set(bodyBytes, 0);
  combined.set(submissionBytes, bodyBytes.length);

  const computed = await crypto.subtle.sign("HMAC", secretKey, combined);
  const computedHex = bufferToHex(computed);

  const providedBytes = encoder.encode(signatureHex);
  const computedBytes = encoder.encode(computedHex);

  if (providedBytes.length !== computedBytes.length) {
    return false;
  }

  if (typeof crypto.subtle.timingSafeEqual === "function") {
    return crypto.subtle.timingSafeEqual(providedBytes, computedBytes);
  }

  return constantTimeEqual(providedBytes, computedBytes);
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a[i] ^ b[i];
  }

  return result === 0;
}

export function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
