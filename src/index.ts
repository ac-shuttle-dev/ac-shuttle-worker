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
  generateOwnerDeliveryNotificationEmail,
  generateCustomerConfirmationEmail,
  generateCustomerDenialEmail,
  generateCustomerSubmissionAckEmail,
  generateCustomerReminderEmail,
  formatPickupDateTime,
  type OwnerNotificationData,
  type OwnerDeliveryNotificationData,
  type CustomerConfirmationData,
  type CustomerDenialData,
  type CustomerReminderData,
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
  // Driver contact information for customer emails
  DRIVER_CONTACT_NAME?: string;
  DRIVER_CONTACT_PHONE?: string;
  DRIVER_CONTACT_EMAIL?: string;
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
  // Flow: Owner notification first, customer acknowledgment only after owner email succeeds
  const dryRun = env.RESEND_DRY_RUN?.toLowerCase() === "true";

  if (!dryRun) {
    let ownerEmailSent = false;

    // Send owner notification first
    try {
      await sendOwnerNotification(summary, env);
      ownerEmailSent = true;
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

    // Only send customer acknowledgment AFTER owner email is successfully delivered
    // This ensures the customer only gets notified once we know the owner has been notified
    if (ownerEmailSent) {
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
    } else {
      logger.warn("booking.customer_ack.skipped", {
        requestId,
        reason: "Owner notification failed - customer acknowledgment not sent",
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
          // Send confirmation email
          await sendCustomerConfirmation(booking, env);
          logger.info("decision.customer_confirmation.sent", {
            transactionId: transactionId.slice(0, 12),
          });

          // Check if trip is within 24 hours - if so, send reminder immediately
          const tripWithin24Hours = isTripWithin24Hours(booking.pickupDatetime);
          if (tripWithin24Hours) {
            try {
              await sendCustomerReminder(booking, env);
              logger.info("decision.customer_reminder.sent", {
                transactionId: transactionId.slice(0, 12),
                reason: "Trip within 24 hours of confirmation",
              });
            } catch (reminderError) {
              // Don't fail if reminder fails - confirmation was sent
              logger.warn("decision.customer_reminder.failed", {
                transactionId: transactionId.slice(0, 12),
                error: reminderError instanceof Error ? reminderError.message : String(reminderError),
              });
            }
          } else {
            logger.info("decision.customer_reminder.scheduled", {
              transactionId: transactionId.slice(0, 12),
              note: "Reminder will be sent within 24 hours of trip",
            });
          }
        } else {
          await sendCustomerDenial(booking, env);
        }
        logger.info("decision.customer_email.sent", {
          transactionId: transactionId.slice(0, 12),
          decision,
        });

        // Send owner delivery confirmation
        try {
          await sendOwnerDeliveryNotification(booking, decision, env);
          logger.info("decision.owner_delivery.sent", {
            transactionId: transactionId.slice(0, 12),
            decision,
          });
        } catch (deliveryError) {
          // Don't fail if owner delivery notification fails - customer already notified
          logger.warn("decision.owner_delivery.failed", {
            transactionId: transactionId.slice(0, 12),
            error: deliveryError instanceof Error ? deliveryError.message : String(deliveryError),
          });
        }
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

async function sendCustomerReminder(booking: SubmissionSummary, env: Env): Promise<void> {
  const { date, time } = formatPickupDateTime(booking.pickupDatetime);

  const emailData: CustomerReminderData = {
    customerName: booking.customerName,
    customerEmail: booking.customerEmail,
    startLocation: booking.startLocation,
    endLocation: booking.endLocation,
    pickupDate: date,
    pickupTime: time,
    passengers: String(booking.passengers),
    driverName: env.DRIVER_CONTACT_NAME || "AC Shuttles Driver",
    driverPhone: env.DRIVER_CONTACT_PHONE || "",
    driverEmail: env.DRIVER_CONTACT_EMAIL || env.CUSTOMER_FROM_EMAIL,
    bookingRef: booking.transactionId.slice(0, 10).toUpperCase(),
  };

  const { html, text } = generateCustomerReminderEmail(emailData);

  await sendEmail(env.RESEND_API_KEY, {
    from: `AC Shuttles <${env.CUSTOMER_FROM_EMAIL}>`,
    to: booking.customerEmail,
    subject: `🔔 Reminder: Your AC Shuttles Ride Tomorrow - ${date}`,
    html,
    text,
    tags: ["customer-reminder", "trip-reminder"],
  });
}

async function sendOwnerDeliveryNotification(
  booking: SubmissionSummary,
  decision: "Accepted" | "Denied",
  env: Env
): Promise<void> {
  const { date, time } = formatPickupDateTime(booking.pickupDatetime);

  const emailData: OwnerDeliveryNotificationData = {
    customerName: booking.customerName,
    customerEmail: booking.customerEmail,
    startLocation: booking.startLocation,
    endLocation: booking.endLocation,
    pickupDate: date,
    pickupTime: time,
    notificationType: decision === "Accepted" ? "accepted" : "denied",
    deliveredAt: new Date().toISOString(),
    bookingRef: booking.transactionId.slice(0, 10).toUpperCase(),
    transactionId: booking.transactionId,
  };

  const { html, text } = generateOwnerDeliveryNotificationEmail(emailData);

  const statusEmoji = decision === "Accepted" ? "✅" : "❌";
  await sendEmail(env.RESEND_API_KEY, {
    from: `AC Shuttles <${env.CUSTOMER_FROM_EMAIL}>`,
    to: env.OWNER_EMAIL,
    subject: `${statusEmoji} Booking ${decision}: ${booking.customerName} notification delivered`,
    html,
    text,
    tags: ["owner-delivery", `booking-${decision.toLowerCase()}`],
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
  // Resend API expects tags as [{name, value}] objects, not strings
  const resendPayload: Record<string, unknown> = {
    from: payload.from,
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
  };

  // Convert string tags to Resend's expected format
  if (payload.tags && payload.tags.length > 0) {
    resendPayload.tags = payload.tags.map(tag => ({ name: tag, value: "true" }));
  }

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(resendPayload),
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

// Brand colors matching the email templates
const PAGE_COLORS = {
  primary: '#14b8a6',
  success: '#14b8a6',
  danger: '#ef4444',
  warning: '#f59e0b',
  info: '#64748b',
  gray100: '#f4f4f5',
  gray200: '#e4e4e7',
  gray500: '#71717a',
  gray600: '#52525b',
  gray700: '#3f3f46',
  gray800: '#27272a',
  gray900: '#18181b',
  white: '#ffffff',
  darkBg: '#0f172a',
  darkCard: '#1e293b',
};

function renderErrorPage(title: string, message: string): Response {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} - AC Shuttles</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 40px 20px;
      background: ${PAGE_COLORS.gray100};
      min-height: 100vh;
    }
    .logo { text-align: center; margin-bottom: 24px; }
    .logo-box { display: inline-block; width: 32px; height: 32px; background: ${PAGE_COLORS.primary}; border-radius: 6px; margin-right: 10px; vertical-align: middle; }
    .logo-text { font-size: 18px; font-weight: 700; color: ${PAGE_COLORS.gray900}; letter-spacing: 2px; vertical-align: middle; }
    .container { max-width: 480px; margin: 0 auto; background: ${PAGE_COLORS.white}; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    .indicator { background: ${PAGE_COLORS.danger}; padding: 14px; text-align: center; }
    .indicator-text { color: ${PAGE_COLORS.white}; font-size: 12px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; }
    .content { padding: 32px; text-align: center; }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h1 { color: ${PAGE_COLORS.gray900}; margin: 0 0 12px 0; font-size: 22px; font-weight: 700; }
    p { color: ${PAGE_COLORS.gray600}; line-height: 1.6; margin: 0; font-size: 15px; }
    @media (prefers-color-scheme: dark) {
      body { background: ${PAGE_COLORS.darkBg}; }
      .container { background: ${PAGE_COLORS.darkCard}; }
      .logo-text, h1 { color: #f1f5f9; }
      p { color: #94a3b8; }
    }
  </style>
</head>
<body>
  <div class="logo">
    <span class="logo-box"></span>
    <span class="logo-text">AC SHUTTLES</span>
  </div>
  <div class="container">
    <div class="indicator">
      <span class="indicator-text">✕ Error</span>
    </div>
    <div class="content">
      <div class="icon">⚠️</div>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(message)}</p>
    </div>
  </div>
</body>
</html>`;

  return new Response(html, {
    status: 400,
    headers: { "Content-Type": "text/html" },
  });
}

function renderAlreadyProcessedPage(status: string, booking: SubmissionSummary | null): Response {
  const isAccepted = status === "Accepted";
  const statusColor = isAccepted ? PAGE_COLORS.success : PAGE_COLORS.danger;
  const statusBg = isAccepted ? '#ccfbf1' : '#fee2e2';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Already Processed - AC Shuttles</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 40px 20px;
      background: ${PAGE_COLORS.gray100};
      min-height: 100vh;
    }
    .logo { text-align: center; margin-bottom: 24px; }
    .logo-box { display: inline-block; width: 32px; height: 32px; background: ${PAGE_COLORS.primary}; border-radius: 6px; margin-right: 10px; vertical-align: middle; }
    .logo-text { font-size: 18px; font-weight: 700; color: ${PAGE_COLORS.gray900}; letter-spacing: 2px; vertical-align: middle; }
    .container { max-width: 480px; margin: 0 auto; background: ${PAGE_COLORS.white}; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    .indicator { background: ${PAGE_COLORS.info}; padding: 14px; text-align: center; }
    .indicator-text { color: ${PAGE_COLORS.white}; font-size: 12px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; }
    .content { padding: 32px; text-align: center; }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h1 { color: ${PAGE_COLORS.gray900}; margin: 0 0 12px 0; font-size: 22px; font-weight: 700; }
    p { color: ${PAGE_COLORS.gray600}; line-height: 1.6; margin: 0 0 16px 0; font-size: 15px; }
    .status { display: inline-block; padding: 10px 20px; border-radius: 24px; font-weight: 700; font-size: 14px; background: ${statusBg}; color: ${statusColor}; border: 2px solid ${statusColor}; }
    .booking-info { margin-top: 20px; padding: 16px; background: ${PAGE_COLORS.gray100}; border-radius: 8px; text-align: left; }
    .booking-info strong { color: ${PAGE_COLORS.gray900}; }
    .booking-info span { color: ${PAGE_COLORS.gray600}; font-size: 14px; }
    @media (prefers-color-scheme: dark) {
      body { background: ${PAGE_COLORS.darkBg}; }
      .container { background: ${PAGE_COLORS.darkCard}; }
      .logo-text, h1, .booking-info strong { color: #f1f5f9; }
      p, .booking-info span { color: #94a3b8; }
      .booking-info { background: ${PAGE_COLORS.darkBg}; }
    }
  </style>
</head>
<body>
  <div class="logo">
    <span class="logo-box"></span>
    <span class="logo-text">AC SHUTTLES</span>
  </div>
  <div class="container">
    <div class="indicator">
      <span class="indicator-text">ℹ️ Already Processed</span>
    </div>
    <div class="content">
      <div class="icon">📋</div>
      <h1>Booking Already Processed</h1>
      <p>This booking has already been processed.</p>
      <div class="status">${isAccepted ? '✓' : '✕'} ${escapeHtml(status)}</div>
      ${booking ? `
      <div class="booking-info">
        <strong>${escapeHtml(booking.customerName)}</strong><br>
        <span>${escapeHtml(booking.startLocation)} → ${escapeHtml(booking.endLocation)}</span>
      </div>
      ` : ""}
    </div>
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
  const indicatorColor = isAccepted ? PAGE_COLORS.success : PAGE_COLORS.danger;
  const indicatorText = isAccepted ? '✓ RIDE CONFIRMED' : '✕ RIDE DECLINED';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Booking ${decision} - AC Shuttles</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 40px 20px;
      background: ${PAGE_COLORS.gray100};
      min-height: 100vh;
    }
    .logo { text-align: center; margin-bottom: 24px; }
    .logo-box { display: inline-block; width: 32px; height: 32px; background: ${PAGE_COLORS.primary}; border-radius: 6px; margin-right: 10px; vertical-align: middle; }
    .logo-text { font-size: 18px; font-weight: 700; color: ${PAGE_COLORS.gray900}; letter-spacing: 2px; vertical-align: middle; }
    .container { max-width: 520px; margin: 0 auto; background: ${PAGE_COLORS.white}; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    .indicator { background: ${indicatorColor}; padding: 14px; text-align: center; }
    .indicator-text { color: ${PAGE_COLORS.white}; font-size: 12px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; }
    .content { padding: 32px; }
    .icon { font-size: 48px; text-align: center; margin-bottom: 16px; }
    h1 { color: ${PAGE_COLORS.gray900}; text-align: center; margin: 0 0 12px 0; font-size: 24px; font-weight: 700; }
    .message { text-align: center; color: ${PAGE_COLORS.gray600}; margin: 0 0 24px 0; font-size: 15px; line-height: 1.5; }
    .details { background: ${PAGE_COLORS.gray100}; border-radius: 10px; padding: 20px; border: 1px solid ${PAGE_COLORS.gray200}; }
    .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid ${PAGE_COLORS.gray200}; }
    .detail-row:last-child { border-bottom: none; }
    .label { color: ${PAGE_COLORS.gray500}; font-size: 14px; }
    .value { color: ${PAGE_COLORS.gray900}; font-weight: 600; font-size: 14px; text-align: right; max-width: 60%; }
    .ref-badge { margin-top: 20px; padding: 14px; background: ${PAGE_COLORS.gray900}; border-radius: 8px; text-align: center; }
    .ref-label { color: ${PAGE_COLORS.gray500}; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
    .ref-value { color: ${PAGE_COLORS.primary}; font-family: 'SF Mono', Monaco, monospace; font-size: 16px; font-weight: 700; letter-spacing: 2px; }
    @media (prefers-color-scheme: dark) {
      body { background: ${PAGE_COLORS.darkBg}; }
      .container { background: ${PAGE_COLORS.darkCard}; }
      .logo-text, h1, .value { color: #f1f5f9; }
      .message, .label { color: #94a3b8; }
      .details { background: ${PAGE_COLORS.darkBg}; border-color: #334155; }
      .detail-row { border-color: #334155; }
    }
  </style>
</head>
<body>
  <div class="logo">
    <span class="logo-box"></span>
    <span class="logo-text">AC SHUTTLES</span>
  </div>
  <div class="container">
    <div class="indicator">
      <span class="indicator-text">${indicatorText}</span>
    </div>
    <div class="content">
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
      </div>
      <div class="ref-badge">
        <div class="ref-label">Reference</div>
        <div class="ref-value">${escapeHtml(booking.transactionId.slice(0, 10).toUpperCase())}</div>
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

/**
 * Check if a trip is within 24 hours from now
 * Used to determine if reminder should be sent immediately with confirmation
 */
function isTripWithin24Hours(pickupDatetime: string): boolean {
  try {
    const tripDate = new Date(pickupDatetime);
    const now = new Date();
    const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Trip is within 24 hours if it's between now and 24 hours from now
    return tripDate >= now && tripDate <= twentyFourHoursFromNow;
  } catch {
    // If we can't parse the date, be safe and return true (send reminder)
    return true;
  }
}

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
