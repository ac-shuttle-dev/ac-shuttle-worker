/**
 * AC Shuttles Booking System - Server-Side Worker
 *
 * A simplified, enterprise-grade booking system that handles:
 * - Server-to-server API key authentication
 * - Google Sheets integration with retry and verification
 * - Professional email notifications via Resend
 * - Accept/Deny workflow with secure tokens
 *
 * @version 3.0.0
 */

import { validateRequest, SecurityEnv, SecurityResult } from "./layers/security";
import {
  handleSubmission,
  checkAndUpdateBookingStatus,
  fetchBookingDetails,
  CoordinationEnv,
  CoordinationResult,
  SubmissionSummary,
} from "./layers/coordination";
import {
  generateOwnerNotificationEmail,
  generateCustomerConfirmationEmail,
  generateCustomerDenialEmail,
  generateCustomerSubmissionAckEmail,
  formatPickupDateTime,
  type OwnerNotificationData,
  type CustomerConfirmationData,
  type CustomerDenialData,
  type CustomerSubmissionAckData,
} from "./templates/emails";

const RESEND_API_URL = "https://api.resend.com/emails";

// Combined environment interface
interface Env extends SecurityEnv, CoordinationEnv {
  RESEND_API_KEY: string;
  CUSTOMER_FROM_EMAIL: string;
  OWNER_EMAIL: string;
  WORKER_URL?: string;
  RESEND_DRY_RUN?: string;
  VERBOSE_LOGGING?: string;
}

// Logger utility
const logger = {
  info: (event: string, data?: Record<string, unknown>) =>
    console.log(JSON.stringify({ level: "INFO", event, ...data, timestamp: new Date().toISOString() })),
  warn: (event: string, data?: Record<string, unknown>) =>
    console.warn(JSON.stringify({ level: "WARN", event, ...data, timestamp: new Date().toISOString() })),
  error: (event: string, data?: Record<string, unknown>) =>
    console.error(JSON.stringify({ level: "ERROR", event, ...data, timestamp: new Date().toISOString() })),
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Route: Health check
    if (url.pathname === "/health") {
      return Response.json({ ok: true, timestamp: new Date().toISOString() });
    }

    // Route: Favicon (prevent 404s)
    if (url.pathname === "/favicon.ico") {
      return new Response(null, { status: 204 });
    }

    // Route: Accept booking
    if (url.pathname.startsWith("/accept/")) {
      return handleOwnerDecision(request, env, "Accepted");
    }

    // Route: Deny booking
    if (url.pathname.startsWith("/deny/")) {
      return handleOwnerDecision(request, env, "Denied");
    }

    // Route: Create booking (default)
    if (url.pathname === "/" || url.pathname === "/booking") {
      return handleBookingRequest(request, env);
    }

    // Unknown route
    return Response.json({ ok: false, error: "Not found" }, { status: 404 });
  },
};

/**
 * Handle a new booking request from the server
 */
async function handleBookingRequest(request: Request, env: Env): Promise<Response> {
  const requestId = generateRequestId();

  logger.info("booking.request.received", { requestId });

  // 1. Security validation (API key, rate limit, payload validation)
  let securityResult: SecurityResult;
  try {
    securityResult = await validateRequest(request, env);
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    logger.error("booking.security.error", {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }

  const receivedAt = new Date().toISOString();

  // 2. Coordination (persist to Google Sheets)
  let coordination: CoordinationResult;
  try {
    coordination = await handleSubmission(securityResult, env, receivedAt);
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    logger.error("booking.coordination.error", {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    return Response.json({ ok: false, error: "Failed to process booking" }, { status: 500 });
  }

  const { summary } = coordination;

  logger.info("booking.persisted", {
    requestId,
    transactionId: summary.transactionId.slice(0, 12),
    customer: summary.customerName,
    route: `${summary.startLocation} → ${summary.endLocation}`,
  });

  // 3. Send emails (if not dry run)
  const dryRun = env.RESEND_DRY_RUN?.toLowerCase() === "true";

  if (!dryRun) {
    // Send owner notification
    try {
      await sendOwnerNotification(summary, env);
      logger.info("booking.owner_email.sent", {
        requestId,
        transactionId: summary.transactionId.slice(0, 12),
      });
    } catch (error) {
      logger.error("booking.owner_email.failed", {
        requestId,
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't fail the request if email fails - booking is already saved
    }

    // Send customer acknowledgment
    try {
      await sendCustomerAcknowledgment(summary, env);
      logger.info("booking.customer_ack.sent", {
        requestId,
        transactionId: summary.transactionId.slice(0, 12),
      });
    } catch (error) {
      logger.warn("booking.customer_ack.failed", {
        requestId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.info("booking.complete", {
    requestId,
    transactionId: summary.transactionId,
    dryRun,
  });

  return Response.json({
    ok: true,
    transactionId: summary.transactionId,
    dryRun,
    receivedAt,
  });
}

/**
 * Handle owner accept/deny decision
 */
async function handleOwnerDecision(
  request: Request,
  env: Env,
  decision: "Accepted" | "Denied"
): Promise<Response> {
  const url = new URL(request.url);
  const transactionId = url.pathname.split("/")[2];

  if (!transactionId || transactionId.length < 8) {
    return renderErrorPage("Invalid Request", "The booking link is invalid.");
  }

  logger.info("decision.attempt", {
    transactionId: transactionId.slice(0, 12),
    decision,
  });

  try {
    // Update status in Google Sheets
    const result = await checkAndUpdateBookingStatus(transactionId, decision, env);

    if (!result.updated) {
      // Already processed
      const booking = await fetchBookingDetails(transactionId, env);
      return renderAlreadyProcessedPage(result.currentStatus || "Unknown", booking);
    }

    // Fetch booking details for email
    const booking = await fetchBookingDetails(transactionId, env);

    if (!booking) {
      logger.error("decision.booking_not_found", { transactionId: transactionId.slice(0, 12) });
      return renderErrorPage("Booking Not Found", "Could not find booking details.");
    }

    // Send customer notification (if not dry run)
    const dryRun = env.RESEND_DRY_RUN?.toLowerCase() === "true";
    if (!dryRun) {
      try {
        if (decision === "Accepted") {
          await sendCustomerConfirmation(booking, env);
        } else {
          await sendCustomerDenial(booking, env);
        }
        logger.info("decision.customer_email.sent", {
          transactionId: transactionId.slice(0, 12),
          decision,
        });
      } catch (error) {
        logger.error("decision.customer_email.failed", {
          transactionId: transactionId.slice(0, 12),
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logger.info("decision.complete", {
      transactionId: transactionId.slice(0, 12),
      decision,
    });

    return renderSuccessPage(decision, booking);
  } catch (error) {
    logger.error("decision.error", {
      transactionId: transactionId.slice(0, 12),
      error: error instanceof Error ? error.message : String(error),
    });
    return renderErrorPage("Error", "An error occurred processing your request.");
  }
}

// =============================================================================
// Email Sending Functions
// =============================================================================

async function sendOwnerNotification(summary: SubmissionSummary, env: Env): Promise<void> {
  const workerUrl = env.WORKER_URL || "https://ac-shuttle-worker.workers.dev";
  const { date, time } = formatPickupDateTime(summary.pickupDatetime);

  const emailData: OwnerNotificationData = {
    customerName: summary.customerName,
    customerEmail: summary.customerEmail,
    customerPhone: summary.customerPhone,
    startLocation: summary.startLocation,
    endLocation: summary.endLocation,
    pickupTime: time,
    pickupDate: date,
    passengers: String(summary.passengers),
    estimatedDistance: summary.estimatedDistance,
    estimatedDuration: summary.estimatedDuration,
    price: "Contact for quote",
    notes: summary.notes || undefined,
    bookingRef: summary.transactionId.slice(0, 10).toUpperCase(),
    acceptUrl: `${workerUrl}/accept/${summary.transactionId}`,
    denyUrl: `${workerUrl}/deny/${summary.transactionId}`,
    mapUrl: summary.mapUrl,
  };

  const { html, text } = generateOwnerNotificationEmail(emailData);

  await sendEmail(env.RESEND_API_KEY, {
    from: `AC Shuttles <${env.CUSTOMER_FROM_EMAIL}>`,
    to: env.OWNER_EMAIL,
    subject: `🚐 New Booking: ${summary.customerName} - ${summary.startLocation} → ${summary.endLocation}`,
    html,
    text,
    tags: ["owner-notification", "booking-request"],
  });
}

async function sendCustomerAcknowledgment(summary: SubmissionSummary, env: Env): Promise<void> {
  const { date, time } = formatPickupDateTime(summary.pickupDatetime);

  const emailData: CustomerSubmissionAckData = {
    customerName: summary.customerName,
    customerEmail: summary.customerEmail,
    startLocation: summary.startLocation,
    endLocation: summary.endLocation,
    pickupDate: date,
    pickupTime: time,
    bookingRef: summary.transactionId.slice(0, 10).toUpperCase(),
    contactEmail: env.CUSTOMER_FROM_EMAIL,
    contactPhone: env.DRIVER_CONTACT_PHONE || "",
  };

  const { html, text } = generateCustomerSubmissionAckEmail(emailData);

  await sendEmail(env.RESEND_API_KEY, {
    from: `AC Shuttles <${env.CUSTOMER_FROM_EMAIL}>`,
    to: summary.customerEmail,
    subject: "We received your booking request - AC Shuttles",
    html,
    text,
    tags: ["customer-acknowledgment"],
  });
}

async function sendCustomerConfirmation(booking: SubmissionSummary, env: Env): Promise<void> {
  const { date, time } = formatPickupDateTime(booking.pickupDatetime);

  const emailData: CustomerConfirmationData = {
    customerName: booking.customerName,
    customerEmail: booking.customerEmail,
    startLocation: booking.startLocation,
    endLocation: booking.endLocation,
    pickupDate: date,
    pickupTime: time,
    passengers: String(booking.passengers),
    estimatedDuration: booking.estimatedDuration,
    price: "As quoted",
    driverName: env.DRIVER_CONTACT_NAME || "AC Shuttles Driver",
    driverPhone: env.DRIVER_CONTACT_PHONE || "",
    driverEmail: env.DRIVER_CONTACT_EMAIL || "",
    bookingRef: booking.transactionId.slice(0, 10).toUpperCase(),
    mapUrl: booking.mapUrl,
    notes: booking.notes || undefined,
  };

  const { html, text } = generateCustomerConfirmationEmail(emailData);

  await sendEmail(env.RESEND_API_KEY, {
    from: `AC Shuttles <${env.CUSTOMER_FROM_EMAIL}>`,
    to: booking.customerEmail,
    subject: "✅ Your AC Shuttles Booking is Confirmed!",
    html,
    text,
    tags: ["customer-confirmation", "booking-accepted"],
  });
}

async function sendCustomerDenial(booking: SubmissionSummary, env: Env): Promise<void> {
  const { date, time } = formatPickupDateTime(booking.pickupDatetime);

  const emailData: CustomerDenialData = {
    customerName: booking.customerName,
    customerEmail: booking.customerEmail,
    startLocation: booking.startLocation,
    endLocation: booking.endLocation,
    pickupDate: date,
    pickupTime: time,
    passengers: String(booking.passengers),
    contactPhone: env.DRIVER_CONTACT_PHONE || "",
    contactEmail: env.CUSTOMER_FROM_EMAIL,
    bookingRef: booking.transactionId.slice(0, 10).toUpperCase(),
    mapUrl: booking.mapUrl,
  };

  const { html, text } = generateCustomerDenialEmail(emailData);

  await sendEmail(env.RESEND_API_KEY, {
    from: `AC Shuttles <${env.CUSTOMER_FROM_EMAIL}>`,
    to: booking.customerEmail,
    subject: "Update on Your AC Shuttles Booking Request",
    html,
    text,
    tags: ["customer-denial", "booking-denied"],
  });
}

// =============================================================================
// Email API
// =============================================================================

interface EmailPayload {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  tags?: string[];
}

async function sendEmail(apiKey: string, payload: EmailPayload): Promise<{ id: string }> {
  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Resend API error (${response.status}): ${errorText}`);
  }

  return response.json() as Promise<{ id: string }>;
}

// =============================================================================
// HTML Page Renderers
// =============================================================================

function renderErrorPage(title: string, message: string): Response {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} - AC Shuttles</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 40px; background: #f8f9fa; }
    .container { max-width: 500px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); text-align: center; }
    .icon { font-size: 48px; margin-bottom: 20px; }
    h1 { color: #dc3545; margin-bottom: 16px; }
    p { color: #6c757d; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">⚠️</div>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
  </div>
</body>
</html>`;

  return new Response(html, {
    status: 400,
    headers: { "Content-Type": "text/html" },
  });
}

function renderAlreadyProcessedPage(status: string, booking: SubmissionSummary | null): Response {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Already Processed - AC Shuttles</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 40px; background: #f8f9fa; }
    .container { max-width: 500px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); text-align: center; }
    .icon { font-size: 48px; margin-bottom: 20px; }
    h1 { color: #495057; margin-bottom: 16px; }
    p { color: #6c757d; line-height: 1.6; }
    .status { display: inline-block; padding: 8px 16px; border-radius: 20px; font-weight: 600; background: ${status === "Accepted" ? "#d4edda" : "#f8d7da"}; color: ${status === "Accepted" ? "#155724" : "#721c24"}; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">ℹ️</div>
    <h1>Booking Already Processed</h1>
    <p>This booking has already been processed.</p>
    <div class="status">${escapeHtml(status)}</div>
    ${booking ? `<p style="margin-top: 20px;"><strong>${escapeHtml(booking.customerName)}</strong><br>${escapeHtml(booking.startLocation)} → ${escapeHtml(booking.endLocation)}</p>` : ""}
  </div>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html" },
  });
}

function renderSuccessPage(decision: "Accepted" | "Denied", booking: SubmissionSummary): Response {
  const isAccepted = decision === "Accepted";
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Booking ${decision} - AC Shuttles</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 40px; background: #f8f9fa; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    .icon { font-size: 48px; text-align: center; margin-bottom: 20px; }
    h1 { color: ${isAccepted ? "#28a745" : "#dc3545"}; text-align: center; margin-bottom: 24px; }
    .message { text-align: center; color: #6c757d; margin-bottom: 32px; }
    .details { background: #f8f9fa; border-radius: 8px; padding: 20px; }
    .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e9ecef; }
    .detail-row:last-child { border-bottom: none; }
    .label { color: #6c757d; }
    .value { color: #212529; font-weight: 500; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">${isAccepted ? "✅" : "❌"}</div>
    <h1>Booking ${decision}</h1>
    <p class="message">
      ${isAccepted
        ? "The customer has been notified with driver contact information."
        : "The customer has been notified about the booking status."}
    </p>
    <div class="details">
      <div class="detail-row">
        <span class="label">Customer</span>
        <span class="value">${escapeHtml(booking.customerName)}</span>
      </div>
      <div class="detail-row">
        <span class="label">Route</span>
        <span class="value">${escapeHtml(booking.startLocation)} → ${escapeHtml(booking.endLocation)}</span>
      </div>
      <div class="detail-row">
        <span class="label">Pickup</span>
        <span class="value">${escapeHtml(booking.pickupDatetime)}</span>
      </div>
      <div class="detail-row">
        <span class="label">Passengers</span>
        <span class="value">${booking.passengers}</span>
      </div>
      <div class="detail-row">
        <span class="label">Reference</span>
        <span class="value">${escapeHtml(booking.transactionId.slice(0, 10).toUpperCase())}</span>
      </div>
    </div>
  </div>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html" },
  });
}

// =============================================================================
// Utilities
// =============================================================================

function generateRequestId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char] || char);
}
