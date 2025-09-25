const encoder = new TextEncoder();

export interface TransactionInput {
  customerName: string;
  startLocation: string;
  endLocation: string;
  pickupTime: string;
  submittedAt: string;
  customerEmail: string;
}

export async function computeTransactionId(input: TransactionInput): Promise<string> {
  const payload = [
    input.customerName,
    input.startLocation,
    input.endLocation,
    input.pickupTime,
    input.submittedAt,
    input.customerEmail,
  ].join("|");

  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(payload)
  );

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
