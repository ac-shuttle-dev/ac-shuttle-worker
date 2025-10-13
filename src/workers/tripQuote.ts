import { enforceRateLimit } from "../layers/security/rateLimiter";

const ROUTES_ENDPOINT = "https://routes.googleapis.com/directions/v2:computeRoutes";
const ROUTES_FIELD_MASK = [
  "routes.distanceMeters",
  "routes.duration",
  "routes.legs.distanceMeters",
  "routes.legs.duration",
  "routes.polyline.encodedPolyline",
].join(",");

const DEFAULT_ALLOWED_ORIGINS = ["https://acshuttles.com"];
const DEFAULT_RATE_LIMIT_WINDOW_SECONDS = 60;
const DEFAULT_RATE_LIMIT_MAX_REQUESTS = 10;
const DEFAULT_TIME_ZONE = "America/New_York";
const DEFAULT_CURRENCY = "USD";

interface RateLimitConfig {
  windowSeconds: number;
  maxRequests: number;
}

interface TripQuoteRequestPayload {
  starting_address: string;
  ending_address: string;
  pickup_date: string;
  pickup_time: string;
}

interface RoutesApiLeg {
  distanceMeters?: number;
  duration?: string;
}

interface RoutesApiRoute {
  distanceMeters?: number;
  duration?: string;
  legs?: RoutesApiLeg[];
  polyline?: {
    encodedPolyline?: string;
  };
}

interface RoutesApiResponse {
  routes?: RoutesApiRoute[];
  error?: {
    message?: string;
    status?: string;
    details?: unknown;
  };
}

interface PricingResult {
  total: number;
  method: "default" | "custom";
  breakdown: Record<string, unknown>;
}

export interface TripQuoteEnv {
  SECURITY_STATE: KVNamespace;
  GOOGLE_ROUTES_API_KEY: string;
  QUOTE_ALLOWED_ORIGINS?: string;
  QUOTE_RATE_LIMIT_WINDOW_SECONDS?: string;
  QUOTE_RATE_LIMIT_MAX_REQUESTS?: string;
  QUOTE_TIME_ZONE?: string;
  QUOTE_DEFAULT_CURRENCY?: string;
  QUOTE_DEBUG_LOGGING?: string;
  TRIP_BASE_FARE?: string;
  TRIP_PER_KM_RATE?: string;
  TRIP_PER_MIN_RATE?: string;
  TRIP_SURGE_MULTIPLIER?: string;
  TRIP_MINIMUM_FARE?: string;
  TRIP_PRICING_FORMULA?: string;
}

type DebugLogLevel = "info" | "warn" | "error";

export async function handleTripQuoteRequest(
  request: Request,
  env: TripQuoteEnv
): Promise<Response> {
  const allowedOrigins = parseAllowedOrigins(env.QUOTE_ALLOWED_ORIGINS);
  const originHeader = request.headers.get("Origin");
  const debug = isDebugEnabled(env.QUOTE_DEBUG_LOGGING);

  if (request.method === "OPTIONS") {
    const response = new Response(null, { status: 204 });
    applyCors(response, originHeader, allowedOrigins);
    response.headers.set("Access-Control-Max-Age", "86400");
    return response;
  }

  if (request.method !== "POST") {
    const response = jsonResponse(
      { ok: false, message: "Method Not Allowed" },
      405,
      originHeader,
      allowedOrigins
    );
    response.headers.set("Allow", "POST, OPTIONS");
    return response;
  }

  if (!env.GOOGLE_ROUTES_API_KEY) {
    debugLog(debug, "trip.quote.config.missing_api_key", { level: "error" });
    return jsonResponse(
      { ok: false, message: "Server configuration error" },
      500,
      originHeader,
      allowedOrigins
    );
  }

  if (!originHeader || !isOriginAllowed(originHeader, allowedOrigins)) {
    debugLog(debug, "trip.quote.cors.blocked", {
      level: "warn",
      origin: originHeader,
    });
    return jsonResponse(
      { ok: false, message: "Origin not allowed" },
      403,
      originHeader,
      allowedOrigins
    );
  }

  const clientIp = getClientIp(request);
  if (!clientIp) {
    debugLog(debug, "trip.quote.ip_missing", { level: "warn" });
    return jsonResponse(
      { ok: false, message: "Unable to determine client IP" },
      400,
      originHeader,
      allowedOrigins
    );
  }

  const rateLimitConfig = getRateLimitConfig(env);
  const rateKey = `quote:ip:${clientIp}`;
  const rateLimitResult = await enforceRateLimit(rateKey, {
    kv: env.SECURITY_STATE,
    windowSeconds: rateLimitConfig.windowSeconds,
    limit: rateLimitConfig.maxRequests,
  });

  if (!rateLimitResult.allowed) {
    debugLog(debug, "trip.quote.rate_limit.blocked", {
      level: "warn",
      clientIp,
      retryAfter: rateLimitResult.reset,
    });
    const response = jsonResponse(
      {
        ok: false,
        message: "Too many requests. Please try again later.",
        retryAfterEpochMs: rateLimitResult.reset,
      },
      429,
      originHeader,
      allowedOrigins
    );
    const retrySeconds = Math.max(
      Math.ceil((rateLimitResult.reset - Date.now()) / 1000),
      1
    );
    response.headers.set("Retry-After", retrySeconds.toString());
    return response;
  }

  let payload: TripQuoteRequestPayload;
  try {
    payload = await request.json<TripQuoteRequestPayload>();
  } catch (error) {
    debugLog(debug, "trip.quote.payload.invalid_json", {
      level: "warn",
      error: formatError(error),
    });
    return jsonResponse(
      { ok: false, message: "Invalid JSON payload" },
      400,
      originHeader,
      allowedOrigins
    );
  }

  const validationResult = validatePayload(payload);
  if (!validationResult.ok) {
    debugLog(debug, "trip.quote.payload.validation_failed", {
      level: "warn",
      issues: validationResult.issues,
    });
    return jsonResponse(
      {
        ok: false,
        message: "Invalid request payload",
        issues: validationResult.issues,
      },
      400,
      originHeader,
      allowedOrigins
    );
  }

  const timeZone = (env.QUOTE_TIME_ZONE || DEFAULT_TIME_ZONE).trim();
  const departureTimeIso = combinePickupDateTime(
    payload.pickup_date,
    payload.pickup_time,
    timeZone
  );

  if (!departureTimeIso) {
    debugLog(debug, "trip.quote.datetime.invalid", {
      level: "warn",
      pickup_date: payload.pickup_date,
      pickup_time: payload.pickup_time,
      timeZone,
    });
    return jsonResponse(
      {
        ok: false,
        message: "Invalid pickup date or time",
      },
      400,
      originHeader,
      allowedOrigins
    );
  }

  debugLog(debug, "trip.quote.routes.request", {
    level: "info",
    starting_address: payload.starting_address,
    ending_address: payload.ending_address,
    departureTimeIso,
    timeZone,
    clientIp,
  });

  let routesData: RoutesApiResponse;
  try {
    routesData = await callRoutesApi(
      payload.starting_address,
      payload.ending_address,
      departureTimeIso,
      env,
      debug
    );
  } catch (error) {
    debugLog(debug, "trip.quote.routes.error", {
      level: "error",
      error: formatError(error),
    });
    return jsonResponse(
      {
        ok: false,
        message: "Failed to retrieve route information",
      },
      500,
      originHeader,
      allowedOrigins
    );
  }

  const primaryRoute = routesData.routes?.[0];
  if (!primaryRoute) {
    debugLog(debug, "trip.quote.routes.no_results", {
      level: "warn",
      raw: routesData,
    });
    return jsonResponse(
      {
        ok: false,
        message: "No routes found for the provided addresses",
      },
      424,
      originHeader,
      allowedOrigins
    );
  }

  const metrics = extractRouteMetrics(primaryRoute);
  if (!metrics) {
    debugLog(debug, "trip.quote.routes.metrics_missing", {
      level: "warn",
      route: primaryRoute,
    });
    return jsonResponse(
      {
        ok: false,
        message: "Unable to determine trip metrics",
      },
      424,
      originHeader,
      allowedOrigins
    );
  }

  const pricing = evaluatePricing(
    metrics.distanceMeters,
    metrics.durationSeconds,
    departureTimeIso,
    env,
    debug
  );

  const currency = (env.QUOTE_DEFAULT_CURRENCY || DEFAULT_CURRENCY).trim();
  const mapUrl = buildMapsLink(
    payload.starting_address,
    payload.ending_address,
    departureTimeIso
  );

  debugLog(debug, "trip.quote.success", {
    level: "info",
    metrics,
    pricing,
    currency,
    mapUrl,
  });

  return jsonResponse(
    {
      ok: true,
      distanceMeters: metrics.distanceMeters,
      distanceKilometers: roundTo(metrics.distanceMeters / 1000, 3),
      distanceText: formatDistance(metrics.distanceMeters),
      durationSeconds: metrics.durationSeconds,
      durationMinutes: roundTo(metrics.durationSeconds / 60, 1),
      durationText: formatDuration(metrics.durationSeconds),
      price: pricing.total,
      currency,
      pricingBreakdown: pricing.breakdown,
      route: {
        departureTimeIso,
        polyline: primaryRoute.polyline?.encodedPolyline ?? null,
        mapUrl,
      },
    },
    200,
    originHeader,
    allowedOrigins
  );
}

function parseAllowedOrigins(raw: string | undefined): string[] {
  if (!raw) {
    return [...DEFAULT_ALLOWED_ORIGINS];
  }
  const tokens = raw
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
  return tokens.length > 0 ? tokens : [...DEFAULT_ALLOWED_ORIGINS];
}

function isOriginAllowed(origin: string, allowed: string[]): boolean {
  return allowed.includes(origin.trim());
}

function applyCors(
  response: Response,
  origin: string | null,
  allowedOrigins: string[]
): void {
  if (origin && isOriginAllowed(origin, allowedOrigins)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
  }
  response.headers.set("Vary", "Origin");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
}

function jsonResponse(
  payload: Record<string, unknown>,
  status: number,
  origin: string | null,
  allowedOrigins: string[]
): Response {
  const body = JSON.stringify(payload);
  const response = new Response(body, {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
  applyCors(response, origin, allowedOrigins);
  return response;
}

function getClientIp(request: Request): string | null {
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) {
    return cfIp.trim();
  }
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const [first] = forwardedFor.split(",");
    if (first) {
      return first.trim();
    }
  }
  return null;
}

function getRateLimitConfig(env: TripQuoteEnv): RateLimitConfig {
  const windowSeconds = parsePositiveNumber(
    env.QUOTE_RATE_LIMIT_WINDOW_SECONDS,
    DEFAULT_RATE_LIMIT_WINDOW_SECONDS
  );
  const maxRequests = parsePositiveNumber(
    env.QUOTE_RATE_LIMIT_MAX_REQUESTS,
    DEFAULT_RATE_LIMIT_MAX_REQUESTS
  );
  return { windowSeconds, maxRequests };
}

function parsePositiveNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function validatePayload(payload: TripQuoteRequestPayload): {
  ok: true;
} | {
  ok: false;
  issues: string[];
} {
  const issues: string[] = [];

  if (!isNonEmptyString(payload.starting_address)) {
    issues.push("starting_address must be a non-empty string");
  }
  if (!isNonEmptyString(payload.ending_address)) {
    issues.push("ending_address must be a non-empty string");
  }
  if (!isNonEmptyString(payload.pickup_date)) {
    issues.push("pickup_date must be provided (YYYY-MM-DD)");
  }
  if (!isNonEmptyString(payload.pickup_time)) {
    issues.push("pickup_time must be provided (HH:MM)");
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return { ok: true };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function combinePickupDateTime(
  dateRaw: string,
  timeRaw: string,
  timeZone: string
): string | null {
  const dateParts = parseDate(dateRaw);
  const timeParts = parseTime(timeRaw);
  if (!dateParts || !timeParts) {
    return null;
  }

  const { year, month, day } = dateParts;
  const { hour, minute } = timeParts;
  const utcDate = zonedTimeToUtc({ year, month, day, hour, minute }, timeZone);
  if (!utcDate) {
    return null;
  }
  return utcDate.toISOString();
}

function parseDate(value: string): { year: number; month: number; day: number } | null {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }
  const [, yearRaw, monthRaw, dayRaw] = match;
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }
  return { year, month, day };
}

function parseTime(value: string): { hour: number; minute: number } | null {
  const trimmed = value.trim();
  const match24 = trimmed.match(/^(\d{2}):(\d{2})$/);
  if (match24) {
    const hour = Number(match24[1]);
    const minute = Number(match24[2]);
    if (hour >= 0 && hour < 24 && minute >= 0 && minute < 60) {
      return { hour, minute };
    }
    return null;
  }

  const match12 = trimmed.match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
  if (match12) {
    let hour = Number(match12[1]);
    const minute = Number(match12[2]);
    const meridiem = match12[3].toUpperCase();
    if (hour < 1 || hour > 12 || minute < 0 || minute > 59) {
      return null;
    }
    if (meridiem === "PM" && hour < 12) {
      hour += 12;
    }
    if (meridiem === "AM" && hour === 12) {
      hour = 0;
    }
    return { hour, minute };
  }

  return null;
}

function zonedTimeToUtc(
  params: { year: number; month: number; day: number; hour: number; minute: number },
  timeZone: string
): Date | null {
  try {
    const naive = new Date(
      Date.UTC(params.year, params.month - 1, params.day, params.hour, params.minute)
    );
    const offsetMinutes = getTimeZoneOffsetMinutes(naive, timeZone);
    return new Date(naive.getTime() - offsetMinutes * 60_000);
  } catch (error) {
    console.warn("trip.quote.timezone.convert_failed", {
      error: formatError(error),
      params,
      timeZone,
    });
    return null;
  }
}

function getTimeZoneOffsetMinutes(date: Date, timeZone: string): number {
  const formatOptions: Intl.DateTimeFormatOptions = {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  };

  const dtf = new Intl.DateTimeFormat("en-US", formatOptions);
  const parts = dtf.formatToParts(date);

  const data: Record<string, number> = {};
  for (const part of parts) {
    if (part.type === "literal") {
      continue;
    }
    data[part.type] = Number(part.value);
  }

  const timeAsUtc = Date.UTC(
    data.year,
    (data.month || 1) - 1,
    data.day || 1,
    data.hour || 0,
    data.minute || 0,
    data.second || 0
  );

  const offset = (timeAsUtc - date.getTime()) / 60000;
  return offset;
}

async function callRoutesApi(
  originAddress: string,
  destinationAddress: string,
  departureTimeIso: string,
  env: TripQuoteEnv,
  debug: boolean
): Promise<RoutesApiResponse> {
  const payload = {
    origin: {
      location: {
        address: originAddress,
      },
    },
    destination: {
      location: {
        address: destinationAddress,
      },
    },
    travelMode: "DRIVE",
    routingPreference: "TRAFFIC_AWARE",
    departureTime: departureTimeIso,
    computeAlternativeRoutes: false,
    languageCode: "en",
    units: "METRIC",
  };

  const response = await fetch(ROUTES_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": env.GOOGLE_ROUTES_API_KEY,
      "X-Goog-FieldMask": ROUTES_FIELD_MASK,
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let data: RoutesApiResponse;
  try {
    data = text ? (JSON.parse(text) as RoutesApiResponse) : {};
  } catch (error) {
    throw new Error(
      `Failed to parse Google Routes API response: ${String(error)} | body=${text}`
    );
  }

  if (!response.ok) {
    debugLog(debug, "trip.quote.routes.non_200", {
      level: "warn",
      status: response.status,
      data,
    });
    throw new Error(
      data.error?.message || `Google Routes API request failed with status ${response.status}`
    );
  }

  return data;
}

function extractRouteMetrics(route: RoutesApiRoute):
  | { distanceMeters: number; durationSeconds: number }
  | null {
  const distanceMeters = route.distanceMeters ?? sumLegMetric(route.legs, "distanceMeters");
  const durationSeconds = route.duration
    ? parseDurationSeconds(route.duration)
    : sumLegDuration(route.legs);

  if (!distanceMeters || !durationSeconds) {
    return null;
  }

  return { distanceMeters, durationSeconds };
}

function sumLegMetric(
  legs: RoutesApiLeg[] | undefined,
  key: "distanceMeters"
): number | null {
  if (!legs || legs.length === 0) {
    return null;
  }
  let total = 0;
  for (const leg of legs) {
    const value = leg[key];
    if (typeof value !== "number" || value <= 0) {
      return null;
    }
    total += value;
  }
  return total;
}

function sumLegDuration(legs: RoutesApiLeg[] | undefined): number | null {
  if (!legs || legs.length === 0) {
    return null;
  }
  let total = 0;
  for (const leg of legs) {
    if (!leg.duration) {
      return null;
    }
    const seconds = parseDurationSeconds(leg.duration);
    if (!seconds) {
      return null;
    }
    total += seconds;
  }
  return total;
}

function parseDurationSeconds(value: string): number | null {
  const match = value.match(/^(\d+)(?:\.(\d+))?s$/);
  if (!match) {
    return null;
  }
  const base = Number(match[1]);
  if (!Number.isFinite(base)) {
    return null;
  }
  const fractional = match[2] ? Number(`0.${match[2]}`) : 0;
  return base + fractional;
}

function evaluatePricing(
  distanceMeters: number,
  durationSeconds: number,
  pickupTimeIso: string,
  env: TripQuoteEnv,
  debug: boolean
): PricingResult {
  const distanceKm = distanceMeters / 1000;
  const durationMinutes = durationSeconds / 60;

  const context = {
    baseFare: parseCurrency(env.TRIP_BASE_FARE, 0),
    perKmRate: parseCurrency(env.TRIP_PER_KM_RATE, 0),
    perMinuteRate: parseCurrency(env.TRIP_PER_MIN_RATE, 0),
    surgeMultiplier: parsePositiveNumber(env.TRIP_SURGE_MULTIPLIER, 1),
    minimumFare: parseCurrency(env.TRIP_MINIMUM_FARE, 0),
    pickupTimeIso,
  };

  const basePrice =
    (context.baseFare ?? 0) +
    distanceKm * (context.perKmRate ?? 0) +
    durationMinutes * (context.perMinuteRate ?? 0);

  const surgeApplied = basePrice * (context.surgeMultiplier ?? 1);
  const defaultPrice = Math.max(context.minimumFare ?? 0, surgeApplied);

  const formula = env.TRIP_PRICING_FORMULA?.trim();
  if (!formula) {
    const total = roundTo(defaultPrice, 2);
    return {
      total,
      method: "default",
      breakdown: {
        strategy: "linear",
        baseFare: roundTo(context.baseFare ?? 0, 2),
        distanceComponent: roundTo(
          distanceKm * (context.perKmRate ?? 0),
          2
        ),
        timeComponent: roundTo(
          durationMinutes * (context.perMinuteRate ?? 0),
          2
        ),
        surgeMultiplier: roundTo(context.surgeMultiplier ?? 1, 2),
        minimumFare: roundTo(context.minimumFare ?? 0, 2),
        computedBase: roundTo(basePrice, 2),
      },
    };
  }

  try {
    const wrappedFormula = wrapFormula(formula);
    const customFn = new Function(
      "distanceKm",
      "distanceMeters",
      "durationMinutes",
      "durationSeconds",
      "pickupTimeIso",
      "context",
      wrappedFormula
    ) as (
      distanceKm: number,
      distanceMeters: number,
      durationMinutes: number,
      durationSeconds: number,
      pickupTimeIso: string,
      context: Record<string, unknown>
    ) => unknown;

    const result = customFn(
      distanceKm,
      distanceMeters,
      durationMinutes,
      durationSeconds,
      pickupTimeIso,
      context
    );
    const total = toCurrencyNumber(result, defaultPrice);

    debugLog(debug, "trip.quote.pricing.custom_applied", {
      level: "info",
      distanceKm,
      durationMinutes,
      pickupTimeIso,
      total,
    });

    return {
      total,
      method: "custom",
      breakdown: {
        strategy: "custom-formula",
        formula,
        context,
        fallbackPrice: roundTo(defaultPrice, 2),
      },
    };
  } catch (error) {
    debugLog(debug, "trip.quote.pricing.custom_failed", {
      level: "error",
      error: formatError(error),
      formula,
    });
    const total = roundTo(defaultPrice, 2);
    return {
      total,
      method: "default",
      breakdown: {
        strategy: "linear",
        baseFare: roundTo(context.baseFare ?? 0, 2),
        distanceComponent: roundTo(
          distanceKm * (context.perKmRate ?? 0),
          2
        ),
        timeComponent: roundTo(
          durationMinutes * (context.perMinuteRate ?? 0),
          2
        ),
        surgeMultiplier: roundTo(context.surgeMultiplier ?? 1, 2),
        minimumFare: roundTo(context.minimumFare ?? 0, 2),
        computedBase: roundTo(basePrice, 2),
        formulaError: "custom formula failed",
      },
    };
  }
}

function wrapFormula(formula: string): string {
  const body = formula.trim();
  if (/return\s+/i.test(body)) {
    return `"use strict";${body}`;
  }
  return `"use strict";return (() => { ${body} })();`;
}

function toCurrencyNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return roundTo(fallback, 2);
  }
  return roundTo(parsed, 2);
}

function parseCurrency(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const sanitized = value.replace(/[^0-9.+-]/g, "");
  const parsed = Number(sanitized);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return parsed;
}

function roundTo(value: number, precision: number): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function formatDistance(distanceMeters: number): string {
  if (distanceMeters < 1000) {
    return `${roundTo(distanceMeters, 1)} m`;
  }
  return `${roundTo(distanceMeters / 1000, 2)} km`;
}

function formatDuration(durationSeconds: number): string {
  const hours = Math.floor(durationSeconds / 3600);
  const minutes = Math.round((durationSeconds % 3600) / 60);
  if (hours === 0) {
    return `${minutes} min`;
  }
  if (minutes === 0) {
    return `${hours} hr`;
  }
  return `${hours} hr ${minutes} min`;
}

function buildMapsLink(
  origin: string,
  destination: string,
  departureIso: string
): string {
  const params = new URLSearchParams({
    api: "1",
    origin,
    destination,
    travelmode: "driving",
    departure_time: departureIso,
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function isDebugEnabled(flag: string | undefined): boolean {
  if (!flag) {
    return false;
  }
  const normalized = flag.trim().toLowerCase();
  return ["1", "true", "yes", "debug"].includes(normalized);
}

function debugLog(
  enabled: boolean,
  message: string,
  details: { level?: DebugLogLevel } & Record<string, unknown> = {}
): void {
  if (!enabled) {
    return;
  }
  const { level = "info", ...rest } = details;
  const payload = {
    message,
    level,
    timestamp: new Date().toISOString(),
    category: "trip-quote",
    ...rest,
  };
  const logMethod = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  logMethod(JSON.stringify(payload));
}

function formatError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  return { message: String(error) };
}
