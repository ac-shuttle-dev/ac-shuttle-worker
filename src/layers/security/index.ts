import { verifyFramerSignature } from "./hmac";
import { enforceRateLimit } from "./rateLimiter";
import {
  isSubmissionProcessed,
  markSubmissionPending,
  markSubmissionProcessed,
} from "./state";

export interface SecurityEnv {
  WEBHOOK_SECRET: string;
  SECURITY_STATE: KVNamespace;
  RATE_LIMIT_WINDOW_SECONDS?: string;
  RATE_LIMIT_MAX_REQUESTS?: string;
}

export interface SecurityResult<TBody = unknown> {
  submissionId: string;
  rawBody: string;
  body: TBody;
  customerEmail: string;
  markProcessed: () => Promise<void>;
}

const RATE_LIMIT_DEFAULT_WINDOW = 60;
const RATE_LIMIT_DEFAULT_MAX = 10;
const RATE_LIMIT_BLOCK_MESSAGE =
  "Too many requests. Please wait a moment and try again.";

export async function validateRequest<TBody extends Record<string, unknown>>(
  request: Request,
  env: SecurityEnv
): Promise<SecurityResult<TBody>> {
  if (request.method !== "POST") {
    throw new Response("Method Not Allowed", {
      status: 405,
      headers: { Allow: "POST" },
    });
  }

  const bodyBuffer = await request.arrayBuffer();
  const signature = request.headers.get("framer-signature");
  const submissionId = request.headers.get("framer-webhook-submission-id");

  if (!signature || !submissionId) {
    const missing = [];
    if (!signature) missing.push("framer-signature");
    if (!submissionId) missing.push("framer-webhook-submission-id");
    throw new Response(`Unauthorized: Missing headers - ${missing.join(", ")}`, { status: 401 });
  }

  const isVerified = await verifyFramerSignature(
    env.WEBHOOK_SECRET,
    submissionId,
    bodyBuffer,
    signature
  );

  if (!isVerified) {
    throw new Response("Unauthorized: Invalid HMAC signature", { status: 401 });
  }

  const rawBody = new TextDecoder().decode(bodyBuffer);
  let parsedBody: TBody;
  try {
    parsedBody = JSON.parse(rawBody) as TBody;
  } catch (error) {
    throw new Response("Invalid JSON payload", { status: 400 });
  }

  const customerEmail = extractEmail(parsedBody);
  if (!customerEmail) {
    throw new Response("Missing customer email in payload (checked: email, customer_email, contact_email, customerEmail)", { status: 400 });
  }

  const rateLimitKey = customerEmail.toLowerCase();
  const rateLimitWindow = parseEnvNumber(
    env.RATE_LIMIT_WINDOW_SECONDS,
    RATE_LIMIT_DEFAULT_WINDOW
  );
  const rateLimitMax = parseEnvNumber(
    env.RATE_LIMIT_MAX_REQUESTS,
    RATE_LIMIT_DEFAULT_MAX
  );

  const rateLimitResult = await enforceRateLimit(rateLimitKey, {
    kv: env.SECURITY_STATE,
    limit: rateLimitMax,
    windowSeconds: rateLimitWindow,
  });

  if (!rateLimitResult.allowed) {
    throw Response.json(
      {
        ok: false,
        message: RATE_LIMIT_BLOCK_MESSAGE,
        retryAfter: rateLimitResult.reset,
      },
      {
        status: 429,
        headers: {
          "Retry-After": Math.ceil(
            (rateLimitResult.reset - Date.now()) / 1000
          ).toString(),
        },
      }
    );
  }

  const alreadyProcessed = await isSubmissionProcessed(
    env.SECURITY_STATE,
    submissionId
  );

  if (alreadyProcessed) {
    throw new Response("Duplicate submission", { status: 409 });
  }

  await markSubmissionPending(env.SECURITY_STATE, submissionId);

  return {
    submissionId,
    rawBody,
    body: parsedBody,
    customerEmail,
    markProcessed: async () => {
      await markSubmissionProcessed(env.SECURITY_STATE, submissionId);
    },
  };
}

function extractEmail(payload: Record<string, unknown>): string | null {
  const possibleKeys = [
    "email",
    "customer_email",
    "contact_email",
    "customerEmail",
  ];

  for (const key of possibleKeys) {
    const value = payload[key];
    if (typeof value === "string" && value.includes("@")) {
      return value.trim();
    }
  }

  return null;
}

function parseEnvNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
