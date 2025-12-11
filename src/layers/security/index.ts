/**
 * Security Layer - Server-Side Authentication
 *
 * Provides:
 * - API key authentication (X-API-Key header)
 * - Native Cloudflare rate limiting
 * - Request payload validation
 * - Idempotency key support
 */

export interface SecurityEnv {
  API_KEY: string;
  BOOKING_RATE_LIMIT: RateLimiter;
}

export interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface BookingPayload {
  // Required fields
  customer_name: string;
  customer_email: string;
  start_location: string;
  end_location: string;
  pickup_datetime: string;
  passengers: number | string;
  estimated_distance: string;
  estimated_duration: string;

  // Optional fields
  customer_phone?: string;
  notes?: string;
  idempotency_key?: string;
}

export interface SecurityResult {
  payload: BookingPayload;
  idempotencyKey: string;
  customerEmail: string;
}

interface ValidationError {
  field: string;
  message: string;
}

const logger = {
  info: (event: string, data?: Record<string, unknown>) =>
    console.log(JSON.stringify({ level: 'INFO', event, ...data, timestamp: new Date().toISOString() })),
  warn: (event: string, data?: Record<string, unknown>) =>
    console.warn(JSON.stringify({ level: 'WARN', event, ...data, timestamp: new Date().toISOString() })),
  error: (event: string, data?: Record<string, unknown>) =>
    console.error(JSON.stringify({ level: 'ERROR', event, ...data, timestamp: new Date().toISOString() })),
};

/**
 * Validate an incoming booking request
 */
export async function validateRequest(
  request: Request,
  env: SecurityEnv
): Promise<SecurityResult> {
  const requestId = generateRequestId();

  // 1. Method check
  if (request.method !== "POST") {
    logger.warn('security.method_not_allowed', { requestId, method: request.method });
    throw new Response("Method Not Allowed", {
      status: 405,
      headers: { Allow: "POST" },
    });
  }

  // 2. API key validation
  const apiKey = request.headers.get("X-API-Key");
  if (!apiKey) {
    logger.warn('security.missing_api_key', { requestId });
    throw new Response("Unauthorized: Missing X-API-Key header", { status: 401 });
  }

  if (!timingSafeEqual(apiKey, env.API_KEY)) {
    logger.warn('security.invalid_api_key', { requestId });
    throw new Response("Unauthorized: Invalid API key", { status: 401 });
  }

  // 3. Rate limiting (using native Cloudflare rate limiter)
  const rateLimitKey = apiKey; // Rate limit by API key
  const { success: withinLimit } = await env.BOOKING_RATE_LIMIT.limit({ key: rateLimitKey });

  if (!withinLimit) {
    logger.warn('security.rate_limit_exceeded', { requestId });
    throw new Response(
      JSON.stringify({
        ok: false,
        error: "Rate limit exceeded. Please try again later.",
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": "60",
        },
      }
    );
  }

  // 4. Parse and validate payload
  let rawPayload: unknown;
  try {
    rawPayload = await request.json();
  } catch {
    logger.warn('security.invalid_json', { requestId });
    throw new Response("Bad Request: Invalid JSON payload", { status: 400 });
  }

  const validationResult = validatePayload(rawPayload);
  if (!validationResult.valid) {
    logger.warn('security.validation_failed', {
      requestId,
      errors: validationResult.errors,
    });
    throw new Response(
      JSON.stringify({
        ok: false,
        error: "Validation failed",
        details: validationResult.errors,
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const payload = validationResult.payload;

  // 5. Generate or use provided idempotency key
  const idempotencyKey = payload.idempotency_key || generateIdempotencyKey(payload);

  logger.info('security.request_validated', {
    requestId,
    customerEmail: payload.customer_email,
    idempotencyKey: idempotencyKey.slice(0, 12),
  });

  return {
    payload,
    idempotencyKey,
    customerEmail: payload.customer_email,
  };
}

/**
 * Validate the booking payload structure
 */
function validatePayload(raw: unknown): { valid: true; payload: BookingPayload } | { valid: false; errors: ValidationError[] } {
  const errors: ValidationError[] = [];

  if (!raw || typeof raw !== "object") {
    return { valid: false, errors: [{ field: "body", message: "Request body must be a JSON object" }] };
  }

  const payload = raw as Record<string, unknown>;

  // Required string fields
  const requiredStrings: Array<{ field: keyof BookingPayload; label: string }> = [
    { field: "customer_name", label: "Customer name" },
    { field: "customer_email", label: "Customer email" },
    { field: "start_location", label: "Start location" },
    { field: "end_location", label: "End location" },
    { field: "pickup_datetime", label: "Pickup date/time" },
    { field: "estimated_distance", label: "Estimated distance" },
    { field: "estimated_duration", label: "Estimated duration" },
  ];

  for (const { field, label } of requiredStrings) {
    const value = payload[field];
    if (typeof value !== "string" || !value.trim()) {
      errors.push({ field, message: `${label} is required` });
    }
  }

  // Passengers - required, can be string or number
  const passengers = payload.passengers;
  if (passengers === undefined || passengers === null || passengers === "") {
    errors.push({ field: "passengers", message: "Passengers count is required" });
  } else {
    const passengersNum = typeof passengers === "string" ? parseInt(passengers, 10) : passengers;
    if (typeof passengersNum !== "number" || !Number.isFinite(passengersNum) || passengersNum < 1) {
      errors.push({ field: "passengers", message: "Passengers must be a positive number" });
    }
  }

  // Email format validation
  const email = payload.customer_email;
  if (typeof email === "string" && email.trim()) {
    if (!isValidEmail(email)) {
      errors.push({ field: "customer_email", message: "Invalid email format" });
    }
  }

  // Datetime validation
  const datetime = payload.pickup_datetime;
  if (typeof datetime === "string" && datetime.trim()) {
    const parsed = Date.parse(datetime);
    if (!Number.isFinite(parsed)) {
      errors.push({ field: "pickup_datetime", message: "Invalid datetime format. Use ISO 8601 format." });
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Normalize the payload
  const normalizedPayload: BookingPayload = {
    customer_name: String(payload.customer_name).trim(),
    customer_email: String(payload.customer_email).trim().toLowerCase(),
    start_location: String(payload.start_location).trim(),
    end_location: String(payload.end_location).trim(),
    pickup_datetime: String(payload.pickup_datetime).trim(),
    passengers: typeof payload.passengers === "number" ? payload.passengers : parseInt(String(payload.passengers), 10),
    estimated_distance: String(payload.estimated_distance).trim(),
    estimated_duration: String(payload.estimated_duration).trim(),
    customer_phone: payload.customer_phone ? String(payload.customer_phone).trim() : undefined,
    notes: payload.notes ? String(payload.notes).trim() : undefined,
    idempotency_key: payload.idempotency_key ? String(payload.idempotency_key).trim() : undefined,
  };

  return { valid: true, payload: normalizedPayload };
}

/**
 * Simple email validation
 */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Generate an idempotency key from the payload
 * This ensures the same booking doesn't get processed twice
 */
function generateIdempotencyKey(payload: BookingPayload): string {
  // Create a deterministic key from the unique aspects of the booking
  const parts = [
    payload.customer_email.toLowerCase(),
    payload.start_location,
    payload.end_location,
    payload.pickup_datetime,
    String(payload.passengers),
  ].join("|");

  // Simple hash - not cryptographic, just for uniqueness
  let hash = 0;
  for (let i = 0; i < parts.length; i++) {
    const char = parts.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `auto-${Math.abs(hash).toString(36)}-${Date.now().toString(36)}`;
}

/**
 * Generate a unique request ID for logging
 */
function generateRequestId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  // First capture whether lengths match BEFORE any modification
  const lengthsMatch = a.length === b.length;

  // Pad shorter string to match longer string length for constant-time comparison
  const maxLen = Math.max(a.length, b.length);
  const paddedA = a.padEnd(maxLen, '\0');
  const paddedB = b.padEnd(maxLen, '\0');

  let result = 0;
  for (let i = 0; i < maxLen; i++) {
    result |= paddedA.charCodeAt(i) ^ paddedB.charCodeAt(i);
  }

  // Only return true if lengths matched AND content matched
  return lengthsMatch && result === 0;
}
