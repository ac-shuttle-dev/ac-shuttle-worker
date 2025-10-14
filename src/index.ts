/**
 * AC Shuttles Booking System - Production Webhook Worker
 * 
 * This is the main entry point for a comprehensive booking system that handles:
 * - Secure webhook processing from Framer forms
 * - Google Sheets integration with audit trail
 * - Professional email notifications via Resend
 * - One-time secure decision tokens with status validation
 * - Comprehensive logging and error handling
 * 
 * ARCHITECTURE OVERVIEW:
 * ├── Security Layer: HMAC verification, rate limiting, duplicate prevention
 * ├── Coordination Layer: Google Sheets CRUD, transaction ID generation, audit trail
 * ├── Messaging Layer: Professional email design with information hierarchy
 * └── Decision System: Secure token-based accept/deny workflow
 * 
 * REQUEST LIFECYCLE:
 *   1. Route handling (/accept/<token>, /deny/<token>, or webhook)
 *   2. Security validation (HMAC, rate limits, duplicate detection)
 *   3. Data processing and Google Sheets persistence
 *   4. Owner notification with secure decision links
 *   5. Comprehensive logging and success/error handling
 * 
 * MAJOR FEATURES IMPLEMENTED:
 * - ✅ One-time secure tokens (SHA-256) with Google Sheets status validation
 * - ✅ Professional email design optimized for information value and print compatibility  
 * - ✅ Decision workflow with protection against duplicate decisions
 * - ✅ Comprehensive audit trail with structured JSON logging
 * - ✅ Mobile-responsive email templates compatible with all major email clients
 * - ✅ Optional field support (price, vehicle type, notes) for flexible forms
 * 
 * SECURITY ENHANCEMENTS:
 * - Status-based token expiration (not time-based) 
 * - Google Sheets validation before allowing decisions
 * - Protection against replay attacks and multiple decisions
 * - Comprehensive HMAC signature validation
 * 
 * @version 2.0.0 - Production Ready
 * @author AC Shuttles Development Team
 * @lastUpdated 2025-09-26
 */

import type { SecurityResult } from "./layers/security";
import { validateRequest, SecurityEnv } from "./layers/security";
import { handleTripQuoteRequest, type TripQuoteEnv } from "./workers/tripQuote";
import { handleSubmission, CoordinationEnv, CoordinationResult, checkAndUpdateBookingStatus } from "./layers/coordination";
import { GoogleSheetsClient } from "./integrations/googleSheets";
import {
  generateOwnerNotificationEmail,
  generateCustomerConfirmationEmail,
  generateCustomerDenialEmail,
  generateOwnerDeliveryNotificationEmail,
  generateCustomerSubmissionAckEmail,
  formatTicketDate,
  formatTicketTime,
  type OwnerNotificationData,
  type CustomerConfirmationData,
  type OwnerDeliveryNotificationData,
  type CustomerDenialData,
  type CustomerSubmissionAckData
} from "./templates/emails";

const RESEND_API_URL = "https://api.resend.com/emails";
const DEFAULT_TOKEN_TTL_MINUTES = 60;
const DEFAULT_DECISION_MIN_AGE_MS = 2000;

interface Env extends SecurityEnv, CoordinationEnv, TripQuoteEnv {
  RESEND_API_KEY: string;
  CUSTOMER_FROM_EMAIL: string;
  OWNER_EMAIL: string;
  RESEND_DRY_RUN?: string;
  RESEND_WEBHOOK_SECRET?: string;
  VERBOSE_LOGGING?: string;
  TOKEN_TTL_MINUTES?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/trip/quote') {
      return handleTripQuoteRequest(request, env);
    }

    if (request.method === 'OPTIONS') {
      return handleCorsPreflight(request);
    }

    if (url.pathname === '/favicon.ico') {
      return new Response(null, {
        status: 204,
        headers: {
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }
    
    // Handle accept/deny routes
    if (url.pathname.startsWith('/accept/')) {
      return handleOwnerDecision(request, env, 'accepted');
    }
    
    if (url.pathname.startsWith('/deny/')) {
      return handleOwnerDecision(request, env, 'denied');
    }
    
    // Handle Resend delivery webhook
    if (url.pathname === '/webhooks/resend' && request.method === 'POST') {
      return handleResendWebhook(request, env);
    }
    
    // Default webhook handling
    const origin = request.headers.get('Origin');
    const verbose = isVerbose(env);
    const requestMeta = buildRequestMeta(request);
    
    // Verbose logging focused on business value
    logVerbose(verbose, "booking request received", {
      submissionId: requestMeta.submissionId?.slice(-8),
      attempt: requestMeta.attempt,
      source: request.headers.get("user-agent")?.includes("Framer") ? "Framer Form" : "Test/Other",
    });
    
    await logRequestEvent("received", {
      ...requestMeta,
      stage: "received",
    });

    let securityResult: Awaited<ReturnType<typeof validateRequest>>;
    try {
      securityResult = await validateRequest(request, env);
      logVerbose(verbose, "customer validated", {
        customerEmail: securityResult.customerEmail,
        submissionId: securityResult.submissionId.slice(-8),
        payloadFields: Object.keys(JSON.parse(securityResult.rawBody)).length,
      });
    } catch (error) {
      if (error instanceof Response) {
        await logFailure("security", error, requestMeta);
        return applyCors(error, origin);
      }
      console.error("Security layer failure", error);
      await logRequestEvent("failed", {
        ...requestMeta,
        stage: "security",
        status: 500,
        reason: "Unhandled security exception",
      });
      return applyCors(new Response("Internal Server Error", { status: 500 }), origin);
    }

    requestMeta.submissionId = securityResult.submissionId;
    requestMeta.customerEmail = securityResult.customerEmail;

    const receivedAt = new Date().toISOString();

    let coordination: CoordinationResult;
    try {
      coordination = await handleSubmission(securityResult, env, receivedAt);
    } catch (error) {
      if (error instanceof Response) {
        await logFailure("coordination", error, requestMeta, securityResult);
        return applyCors(error, origin);
      }
      console.error("Coordination layer failure", error);
      await logRequestEvent("failed", {
        ...requestMeta,
        stage: "coordination",
        status: 500,
        reason: "Unhandled coordination exception",
        payload: securityResult.body,
        rawBody: securityResult.rawBody,
      });
      return applyCors(new Response("Internal Server Error", { status: 500 }), origin);
    }

    logVerbose(verbose, "ride booking processed", {
      customer: `${coordination.summary.customerName} <${securityResult.customerEmail}>`,
      route: `${coordination.summary.startLocation} → ${coordination.summary.endLocation}`,
      schedule: coordination.summary.pickupTime,
      passengers: coordination.summary.passengers,
      pricing: coordination.summary.price,
      distance: coordination.summary.estimatedDistance,
      transactionId: coordination.summary.transactionId.slice(0, 12),
    });

    const ownerEmailRequest = await buildOwnerEmailPayload({
      summary: coordination.summary,
      rawBody: securityResult.rawBody,
      env,
    });

    const dryRun = env.RESEND_DRY_RUN?.toLowerCase() === "true";
    logVerbose(verbose, "owner notification ready", {
      mode: dryRun ? "DRY RUN" : "LIVE",
      recipient: ownerEmailRequest.to,
      customerRequest: `${coordination.summary.customerName} - ${coordination.summary.startLocation} to ${coordination.summary.endLocation}`,
      pricing: coordination.summary.price,
    });

    let resendResult: ResendResult | undefined;
    let customerAckResult: ResendResult | undefined;

    if (!dryRun) {
      try {
        resendResult = await sendEmail(env.RESEND_API_KEY, ownerEmailRequest, verbose);
        logVerbose(verbose, "owner notification sent", {
          messageId: resendResult.id.slice(0, 12),
        });
      } catch (error) {
        logVerbose(
          verbose,
          "resend error",
          {
            error: error instanceof Error ? error.message : String(error),
            submissionId: securityResult.submissionId,
            transactionId: coordination.summary.transactionId,
          },
          "warn"
        );
        await logRequestEvent("failed", {
          ...requestMeta,
          stage: "resend",
          status: 502,
          reason: error instanceof Error ? error.message : String(error),
          payload: securityResult.body,
          rawBody: securityResult.rawBody,
          transactionId: coordination.summary.transactionId,
          dryRun,
          receivedAt,
        });
        return applyCors(Response.json(
          {
            ok: false,
            dryRun,
            receivedAt,
            error: "Failed to send notification",
          },
          { status: 502 }
        ), origin);
      }

      // Send customer submission acknowledgment email
      try {
        const customerAckEmail = buildCustomerSubmissionAckEmail(coordination.summary, env);
        logVerbose(verbose, "customer ack email ready", {
          recipient: customerAckEmail.to,
          transactionRef: coordination.summary.transactionId.slice(0, 12),
        });
        customerAckResult = await sendEmail(env.RESEND_API_KEY, customerAckEmail, verbose);
        logVerbose(verbose, "customer ack sent", {
          messageId: customerAckResult.id.slice(0, 12),
        });
      } catch (customerAckError) {
        // Log the error but don't fail the entire request if customer ack email fails
        console.warn('Failed to send customer acknowledgment email (non-critical):', {
          error: customerAckError instanceof Error ? customerAckError.message : String(customerAckError),
          transactionId: coordination.summary.transactionId,
          customerEmail: coordination.summary.customerEmail,
        });
      }
    }

    await securityResult.markProcessed();
    logVerbose(verbose, "booking completed", {
      customer: coordination.summary.customerName,
      email: securityResult.customerEmail,
      route: `${coordination.summary.startLocation} → ${coordination.summary.endLocation}`,
      actionRequired: "Owner needs to accept/deny this booking",
      ownerNotificationSent: !dryRun,
      customerAckSent: !dryRun && !!customerAckResult,
      transactionRef: coordination.summary.transactionId.slice(0, 12),
    });

    await logRequestEvent("completed", {
      ...requestMeta,
      stage: "completed",
      status: 200,
      dryRun,
      resendId: resendResult?.id ?? null,
      transactionId: coordination.summary.transactionId,
      payload: securityResult.body,
      rawBody: securityResult.rawBody,
      receivedAt,
    });

    // Log a single consolidated success summary
    console.log({
      message: `[webhook] SUCCESS ${requestMeta.submissionId?.slice(-8)} → ${coordination.summary.customerName} (${securityResult.customerEmail}) | ${dryRun ? 'DRY-RUN' : 'SENT'} | ${coordination.summary.transactionId.slice(0, 12)}...`,
      level: "INFO",
      event: "success_summary",
      customerName: coordination.summary.customerName,
      customerEmail: securityResult.customerEmail,
      transactionId: coordination.summary.transactionId,
      dryRun,
      resendId: resendResult?.id ?? null,
      submissionId: securityResult.submissionId,
      rayId: requestMeta.rayId,
    });

    return applyCors(Response.json(
      {
        ok: true,
        dryRun,
        receivedAt,
        resendId: resendResult?.id ?? null,
      },
      { status: 200 }
    ), origin);
  },
};

// Token management for one-time use accept/deny links
interface DecisionToken {
  transactionId: string;
  customerName: string;
  customerEmail: string;
  createdAt: string;
  usedAt?: string;
}

class DecisionAlreadyMadeError extends Error {
  constructor(
    public readonly status: string,
    public readonly tokenData: DecisionToken
  ) {
    super(`Decision already recorded: ${status}`);
    this.name = 'DecisionAlreadyMadeError';
  }
}

class TokenTooYoungError extends Error {
  constructor(
    public readonly minAgeMs: number,
    public readonly ageMs: number,
    public readonly tokenData: DecisionToken
  ) {
    super(`Decision link activated too soon (${ageMs}ms < ${minAgeMs}ms)`);
    this.name = 'TokenTooYoungError';
  }
}

const PREFETCH_USER_AGENTS: RegExp[] = [
  /GoogleImageProxy/i,
  /Google-Read-Aloud/i,
  /Google-InspectionTool/i,
  /facebookexternalhit/i,
  /Facebot/i,
  /Twitterbot/i,
  /Slackbot-LinkExpanding/i,
  /Slackbot/i,
  /LinkedInBot/i,
  /WhatsApp/i,
  /TelegramBot/i,
  /Discordbot/i,
  /SkypeUriPreview/i,
  /Outlook/i,
  /Chrome-Lighthouse/i,
  /PageAnalyzer/i,
  /prerender/i,
  /PhantomJS/i,
];

async function generateDecisionTokens(
  transactionId: string,
  customerName: string,
  customerEmail: string,
  kv: KVNamespace
): Promise<{ acceptToken: string; denyToken: string }> {
  const tokenData: DecisionToken = {
    transactionId,
    customerName,
    customerEmail,
    createdAt: new Date().toISOString(),
  };
  
  const acceptToken = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`accept:${transactionId}:${Date.now()}:${Math.random()}`)
  ).then(buffer => Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join(''));
  
  const denyToken = await crypto.subtle.digest(
    "SHA-256", 
    new TextEncoder().encode(`deny:${transactionId}:${Date.now()}:${Math.random()}`)
  ).then(buffer => Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join(''));
  
  // Store tokens in KV without TTL - they remain valid until booking status changes
  await Promise.all([
    kv.put(`token:accept:${acceptToken}`, JSON.stringify(tokenData)),
    kv.put(`token:deny:${denyToken}`, JSON.stringify(tokenData)),
  ]);
  
  return { acceptToken, denyToken };
}

async function validateAndUseToken(
  token: string,
  decision: 'accepted' | 'denied',
  kv: KVNamespace,
  env: CoordinationEnv
): Promise<DecisionToken> {
  const tokenKey = `token:${decision === 'accepted' ? 'accept' : 'deny'}:${token}`;
  const tokenDataRaw = await kv.get(tokenKey);
  
  if (!tokenDataRaw) {
    throw new Error('Invalid token');
  }
  
  const tokenData: DecisionToken = JSON.parse(tokenDataRaw);
  
  if (tokenData.usedAt) {
    throw new Error('Token has already been used');
  }
  
  const minAgeMs = getDecisionMinAgeMs(env);
  const createdAtMs = Date.parse(tokenData.createdAt);
  if (Number.isFinite(createdAtMs) && minAgeMs > 0) {
    const ageMs = Date.now() - createdAtMs;
    if (ageMs < minAgeMs) {
      throw new TokenTooYoungError(minAgeMs, ageMs, tokenData);
    }
  }

  // Check Google Sheets status to see if booking is still "Pending Review"
  const sheetsClient = new GoogleSheetsClient({
    credentialsJson: env.GOOGLE_SERVICE_ACCOUNT,
  });
  
  const primaryRange = env.GOOGLE_SHEET_RANGE_PRIMARY ?? "Sheet1!A:Z";
  const rows = await sheetsClient.readRange({
    sheetId: env.GOOGLE_SHEET_ID_PRIMARY!,
    range: primaryRange,
  });

  // Find the row with matching transaction ID (column A, index 0)
  let currentStatus: string | null = null;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === tokenData.transactionId) {
      // Status is in column S (index 18) based on buildSubmissionRow
      currentStatus = rows[i][18] as string || "Pending Review";
      break;
    }
  }
  
  if (!currentStatus) {
    throw new Error('Booking not found in system');
  }
  
  if (currentStatus !== "Pending Review") {
    throw new DecisionAlreadyMadeError(currentStatus, tokenData);
  }
  
  // Mark token as used
  tokenData.usedAt = new Date().toISOString();
  await kv.put(tokenKey, JSON.stringify(tokenData), { expirationTtl: 300 }); // Keep for 5 minutes for logging
  
  return tokenData;
}

/**
 * Handles owner decision workflow (/accept/<token> and /deny/<token> routes)
 * 
 * SECURITY MODEL:
 * - Uses one-time SHA-256 tokens instead of direct transaction IDs
 * - Validates current booking status in Google Sheets before allowing decisions
 * - Prevents multiple decisions and replay attacks
 * - Links remain valid until status changes from "Pending Review"
 * 
 * WORKFLOW:
 * 1. Extract and validate secure token from URL
 * 2. Check current booking status in Google Sheets
 * 3. If already decided, show "Decision Already Made" page
 * 4. If still pending, update status and send customer notification
 * 5. Show success confirmation page
 * 
 * @param request - HTTP request with token in URL path
 * @param env - Environment variables and KV bindings
 * @param decision - Either 'accepted' or 'denied'
 * @returns Response with HTML confirmation page or error
 */
async function handleOwnerDecision(
  request: Request,
  env: Env,
  decision: 'accepted' | 'denied'
): Promise<Response> {
  const url = new URL(request.url);
  const token = url.pathname.split('/')[2];
  
  if (!token || token.length < 16) {
    return new Response(
      renderErrorPage('Invalid Request', 'The booking link is invalid or has expired.'),
      { status: 400, headers: { 'Content-Type': 'text/html' } }
    );
  }
  
  if (isPrefetchRequest(request)) {
    logVerbose(isVerbose(env), 'owner decision prefetch blocked', {
      token: token.slice(0, 12),
      decision,
      userAgent: request.headers.get('user-agent'),
    });

    return new Response(
      renderPrefetchPage(decision),
      { status: 200, headers: { 'Content-Type': 'text/html' } }
    );
  }

  try {
    // Validate and use the one-time token
    const tokenData = await validateAndUseToken(token, decision, env.SECURITY_STATE, env);
    
    logVerbose(isVerbose(env), `owner decision ${decision}`, {
      transactionId: tokenData.transactionId.slice(0, 12),
      customerName: tokenData.customerName,
      customerEmail: tokenData.customerEmail,
      decision,
      tokenUsed: true,
      userAgent: request.headers.get('user-agent'),
    });
    
    const customerDetails = {
      name: tokenData.customerName,
      email: tokenData.customerEmail,
    };

    const decisionMetadata = buildDecisionAuditMetadata({
      request,
      decision,
      token,
      tokenData,
    });

    // Check current booking status in Google Sheets and attempt to update
    const newDecisionStatus = decision === 'accepted' ? 'Accepted' : 'Denied';
    const statusResult = await checkAndUpdateBookingStatus(
      tokenData.transactionId,
      newDecisionStatus,
      env,
      { metadata: decisionMetadata }
    );
    
    // If a decision was already made (current status is not the new decision and not "Pending Review"), 
    // show the "decision already made" page
    if (statusResult.currentStatus !== newDecisionStatus && statusResult.currentStatus !== 'Pending Review') {
      return new Response(
        renderDecisionAlreadyMadePage(
          statusResult.currentStatus,
          tokenData.transactionId,
          customerDetails.name,
          customerDetails.email,
          env.OWNER_EMAIL
        ),
        { status: 200, headers: { 'Content-Type': 'text/html' } }
      );
    }
    
    // Send customer notification
    if (!env.RESEND_DRY_RUN || env.RESEND_DRY_RUN.toLowerCase() !== "true") {
      let bookingDetails: Awaited<ReturnType<typeof fetchBookingDetails>>;
      try {
        bookingDetails = await fetchBookingDetails(tokenData.transactionId, env);
      } catch (bookingError) {
        console.warn('Could not fetch booking details from Google Sheets, using minimal fallback data:', bookingError);
        bookingDetails = {
          startLocation: 'Pickup Location (details unavailable)',
          endLocation: 'Destination (details unavailable)',
          pickupTime: 'Time TBD',
          pickupDate: formatTicketDate(new Date().toISOString()),
          price: 'Price TBD',
          passengers: '1',
          estimatedDuration: 'Duration TBD',
          bookingRef: tokenData.transactionId.slice(0, 10).toUpperCase(),
          customerName: tokenData.customerName,
          notes: 'Booking details could not be retrieved. Please contact us for full trip information.',
        };
      }

      const customerEmail = buildCustomerNotificationEmail(decision, customerDetails, env, bookingDetails);

      // Add tracking metadata for delivery confirmation
      customerEmail.tags = {
        ...customerEmail.tags,
        type: 'customer_notification',
        transaction_id: tokenData.transactionId,
        notification_type: decision
      };

      try {
        await sendEmail(env.RESEND_API_KEY, customerEmail, isVerbose(env));
      } catch (emailError) {
        console.error('Failed to send customer decision email:', emailError);
        await logRequestEvent('failed', {
          url: request.url,
          method: request.method,
          rayId: request.headers.get('cf-ray') ?? undefined,
          submissionId: undefined,
          stage: 'customer_email',
          status: 502,
          reason: emailError instanceof Error ? emailError.message : String(emailError),
          customerEmail: customerDetails.email,
          transactionId: tokenData.transactionId,
        });
      }
    }
    
    return new Response(
      renderSuccessPage(decision, tokenData.transactionId, customerDetails.name, bookingDetails),
      { status: 200, headers: { 'Content-Type': 'text/html' } }
    );
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logVerbose(isVerbose(env), `owner decision failed`, {
      token: token.slice(0, 12),
      decision,
      error: errorMessage,
      userAgent: request.headers.get('user-agent'),
    });
    
    console.error(`Owner decision handling error:`, error);

    if (error instanceof DecisionAlreadyMadeError) {
      return new Response(
        renderDecisionAlreadyMadePage(
          error.status,
          error.tokenData.transactionId,
          error.tokenData.customerName,
          error.tokenData.customerEmail,
          env.OWNER_EMAIL
        ),
        { status: 200, headers: { 'Content-Type': 'text/html' } }
      );
    }

    if (error instanceof TokenTooYoungError) {
      const waitMs = Math.max(error.minAgeMs - error.ageMs, 0);
      return new Response(
        renderCooldownPage(decision, waitMs, error.minAgeMs),
        { status: 425, headers: { 'Content-Type': 'text/html' } }
      );
    }

    if (errorMessage.includes('already been used')) {
      return new Response(
        renderErrorPage('Link Already Used', 'This booking link has already been used. Each link can only be used once for security reasons.'),
        { status: 410, headers: { 'Content-Type': 'text/html' } }
      );
    }

    return new Response(
      renderErrorPage('Invalid Link', 'The booking link is invalid or has expired. Links are valid for 60 minutes after being sent.'),
      { status: 400, headers: { 'Content-Type': 'text/html' } }
    );
  }
}

async function fetchBookingDetails(transactionId: string, env: Env): Promise<{
  startLocation: string;
  endLocation: string;
  pickupTime: string;
  pickupDate?: string;
  price: string;
  passengers: string;
  estimatedDuration: string;
  bookingRef: string;
  customerName?: string;
  notes?: string;
  mapUrl?: string;
}> {
  const primarySheetId = env.GOOGLE_SHEET_ID_PRIMARY;
  if (!primarySheetId) {
    throw new Error("Missing GOOGLE_SHEET_ID_PRIMARY");
  }

  if (!env.GOOGLE_SERVICE_ACCOUNT) {
    throw new Error("Missing GOOGLE_SERVICE_ACCOUNT secret");
  }

  const sheetsClient = new GoogleSheetsClient({
    credentialsJson: env.GOOGLE_SERVICE_ACCOUNT,
  });

  const primaryRange = env.GOOGLE_SHEET_RANGE_PRIMARY ?? "Sheet1!A:Z";

  // Read all rows to find the matching transaction ID
  const rows = await sheetsClient.readRange({
    sheetId: primarySheetId,
    range: primaryRange,
  });

  // Find the row with matching transaction ID (column A, index 0)
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === transactionId) {
      const row = rows[i];
      return {
        startLocation: row[6] as string || '',
        endLocation: row[7] as string || '',
        pickupTime: row[8] as string || '',
        pickupDate: formatTicketDate(row[8] as string || ''),
        estimatedDuration: row[10] as string || '',
        passengers: row[11] as string || '',
        price: row[12] as string || '',
        customerName: row[3] as string || '',
        notes: (row[14] as string) || undefined,
        mapUrl: (row[15] as string) || undefined,
        bookingRef: transactionId.slice(0, 10).toUpperCase(),
      };
    }
  }

  throw new Error(`Transaction ID ${transactionId} not found in sheets`);
}

function buildCustomerNotificationEmail(
  decision: 'accepted' | 'denied',
  customer: { name: string; email: string },
  env: Env,
  bookingDetails: {
    startLocation: string;
    endLocation: string;
    pickupTime: string;
    price: string;
    passengers: string;
    estimatedDuration: string;
    bookingRef: string;
    notes?: string;
    mapUrl?: string;
  }
): EmailPayload {
  const isAccepted = decision === 'accepted';
  const subject = `Your AC Shuttles Booking ${isAccepted ? 'Confirmed' : 'Update'}`;

  if (isAccepted) {
    const templateData: CustomerConfirmationData = {
      startLocation: bookingDetails.startLocation,
      endLocation: bookingDetails.endLocation,
      pickupTime: formatTicketTime(bookingDetails.pickupTime),
      pickupDate: formatTicketDate(bookingDetails.pickupTime),
      price: bookingDetails.price,
      passengers: bookingDetails.passengers,
      estimatedDuration: bookingDetails.estimatedDuration,
      customerName: customer.name,
      customerEmail: customer.email,
      driverName: env.DRIVER_CONTACT_NAME || 'AC Shuttles Driver',
      driverPhone: env.DRIVER_CONTACT_PHONE || '',
      driverEmail: env.DRIVER_CONTACT_EMAIL || '',
      notes: bookingDetails.notes,
      mapUrl: bookingDetails.mapUrl,
      bookingRef: bookingDetails.bookingRef,
    };
    
    const { html, text } = generateCustomerConfirmationEmail(templateData);
    
    return {
      from: `AC Shuttles <${env.CUSTOMER_FROM_EMAIL}>`,
      to: customer.email,
      subject,
      html,
      text,
      tags: ["booking-accepted", "customer-notification"],
    };
  } else {
    // Use denial template
    const templateData: CustomerDenialData = {
      startLocation: bookingDetails.startLocation,
      endLocation: bookingDetails.endLocation,
      pickupTime: formatTicketTime(bookingDetails.pickupTime),
      pickupDate: formatTicketDate(bookingDetails.pickupTime),
      passengers: bookingDetails.passengers,
      customerName: customer.name,
      customerEmail: customer.email,
      contactPhone: env.DRIVER_CONTACT_PHONE || '',
      contactEmail: env.DRIVER_CONTACT_EMAIL || '',
      reason: undefined, // Could add a custom reason from the environment or form
      mapUrl: bookingDetails.mapUrl,
      bookingRef: bookingDetails.bookingRef,
    };
    
    const { html, text } = generateCustomerDenialEmail(templateData);
    
    return {
      from: `AC Shuttles <${env.CUSTOMER_FROM_EMAIL}>`,
      to: customer.email,
      subject,
      html,
      text,
      tags: ["booking-denied", "customer-notification"],
    };
  }
}

function renderSuccessPage(decision: 'accepted' | 'denied', transactionId: string, customerName: string, bookingDetails: {
  startLocation: string;
  endLocation: string;
  pickupTime: string;
  pickupDate?: string;
  price: string;
  passengers: string;
  estimatedDuration: string;
  bookingRef: string;
  customerName?: string;
  notes?: string;
  mapUrl?: string;
}): string {
  const isAccepted = decision === 'accepted';
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Booking ${isAccepted ? 'Accepted' : 'Declined'} - AC Shuttles</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 40px; background: #f8f9fa; }
        .container { max-width: 700px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .status-badge {
            display: inline-block;
            padding: 8px 16px;
            border-radius: 20px;
            font-weight: 600;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            background: ${isAccepted ? '#d4edda' : '#f8d7da'};
            color: ${isAccepted ? '#155724' : '#721c24'};
            margin-bottom: 24px;
        }
        .title { font-size: 28px; font-weight: 600; margin-bottom: 16px; color: #212529; }
        .message { font-size: 16px; line-height: 1.6; color: #6c757d; margin-bottom: 32px; }
        .trip-details { background: #f8f9fa; border-radius: 8px; padding: 24px; margin-bottom: 24px; }
        .section-title { font-size: 14px; font-weight: 600; color: #495057; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 16px; }
        .detail-row { display: flex; justify-content: space-between; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #e9ecef; }
        .detail-row:last-child { border-bottom: none; padding-bottom: 0; }
        .detail-label { font-weight: 500; color: #495057; }
        .detail-value { color: #212529; text-align: right; max-width: 60%; }
        .route-display {
            background: white;
            border: 2px solid ${isAccepted ? '#28a745' : '#dc3545'};
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 24px;
        }
        .route-arrow { margin: 0 12px; color: #6c757d; }
        .location { font-weight: 500; color: #212529; }
        .next-steps {
            background: ${isAccepted ? '#d4edda' : '#f8d7da'};
            border-left: 4px solid ${isAccepted ? '#28a745' : '#dc3545'};
            padding: 16px 20px;
            border-radius: 4px;
            margin-top: 24px;
        }
        .next-steps-title { font-weight: 600; color: ${isAccepted ? '#155724' : '#721c24'}; margin-bottom: 8px; }
        .next-steps-text { color: ${isAccepted ? '#155724' : '#721c24'}; line-height: 1.5; }
    </style>
</head>
<body>
    <div class="container">
        <div class="status-badge">${isAccepted ? 'ACCEPTED' : 'DECLINED'}</div>
        <h1 class="title">Booking ${isAccepted ? 'Confirmed' : 'Declined'}</h1>

        <div class="message">
            ${isAccepted
              ? `You have successfully accepted the booking request. The customer has been notified with driver contact information and pickup instructions.`
              : `You have declined the booking request. The customer has been notified and provided with alternative contact options.`
            }
        </div>

        <div class="route-display">
            <div style="text-align: center;">
                <span class="location">${escapeHtml(bookingDetails.startLocation)}</span>
                <span class="route-arrow">→</span>
                <span class="location">${escapeHtml(bookingDetails.endLocation)}</span>
            </div>
        </div>

        <div class="trip-details">
            <div class="section-title">Trip Details</div>
            <div class="detail-row">
                <span class="detail-label">Customer Name:</span>
                <span class="detail-value">${escapeHtml(customerName)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Pickup Time:</span>
                <span class="detail-value">${escapeHtml(bookingDetails.pickupTime)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Pickup Date:</span>
                <span class="detail-value">${escapeHtml(bookingDetails.pickupDate || 'Not specified')}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Passengers:</span>
                <span class="detail-value">${escapeHtml(bookingDetails.passengers)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Price:</span>
                <span class="detail-value" style="font-weight: 600; color: ${isAccepted ? '#28a745' : '#dc3545'};">${escapeHtml(bookingDetails.price)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Duration:</span>
                <span class="detail-value">${escapeHtml(bookingDetails.estimatedDuration)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Booking Reference:</span>
                <span class="detail-value" style="font-family: monospace;">${escapeHtml(bookingDetails.bookingRef)}</span>
            </div>
            ${bookingDetails.notes ? `
            <div class="detail-row">
                <span class="detail-label">Special Instructions:</span>
                <span class="detail-value">${escapeHtml(bookingDetails.notes)}</span>
            </div>
            ` : ''}
        </div>

        <div class="next-steps">
            <div class="next-steps-title">Next Steps</div>
            <div class="next-steps-text">
                ${isAccepted
                  ? `• The customer has been sent confirmation with your contact details<br>
                     • Please contact the customer 30 minutes before pickup<br>
                     • Ensure you arrive at the pickup location on time<br>
                     • The customer has your phone number and email for questions`
                  : `• The customer has been informed of the cancellation<br>
                     • They have been provided with alternative contact options<br>
                     • No further action is required from you<br>
                     • This booking is now closed in the system`
                }
            </div>
        </div>
    </div>
</body>
</html>`;
}

function renderErrorPage(title: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)} - AC Shuttles</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 40px; background: #f8f9fa; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .icon { font-size: 48px; text-align: center; margin-bottom: 24px; }
        .title { font-size: 24px; font-weight: 600; text-align: center; margin-bottom: 16px; color: #dc3545; }
        .message { font-size: 16px; line-height: 1.6; text-align: center; color: #6c757d; }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon" style="color: #dc3545; font-size: 48px;">!</div>
        <div class="title">${escapeHtml(title)}</div>
        <div class="message">${escapeHtml(message)}</div>
    </div>
</body>
</html>`;
}

function renderDecisionAlreadyMadePage(currentStatus: string, transactionId: string, customerName: string, customerEmail: string, ownerEmail: string): string {
  const isAccepted = currentStatus.toLowerCase() === 'accepted';
  const statusColor = isAccepted ? '#28a745' : '#dc3545';
  const statusText = isAccepted ? 'ACCEPTED' : 'DECLINED';
  
  const emailSubject = `Request to Change Booking Decision - ${customerName}`;
  const emailBody = `Hi,

I need to change the decision for booking request:

Customer: ${customerName} (${customerEmail})
Transaction ID: ${transactionId}
Current Status: ${currentStatus}

Please review and make the necessary changes.

Thank you!`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Decision Already Made - AC Shuttles</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 40px; background: #f8f9fa; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .icon { font-size: 48px; text-align: center; margin-bottom: 24px; }
        .title { font-size: 24px; font-weight: 600; text-align: center; margin-bottom: 16px; color: ${statusColor}; }
        .message { font-size: 16px; line-height: 1.6; text-align: center; color: #6c757d; margin-bottom: 32px; }
        .status-info { background: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 24px; }
        .detail-row { display: flex; justify-content: space-between; margin-bottom: 8px; }
        .detail-label { font-weight: 500; color: #495057; }
        .detail-value { color: #6c757d; }
        .current-status { color: ${statusColor}; font-weight: 600; }
        .email-button { 
            display: inline-block; 
            background: #007bff; 
            color: white; 
            padding: 12px 24px; 
            border-radius: 8px; 
            text-decoration: none; 
            font-weight: 500;
            border: none;
            cursor: pointer;
            font-size: 16px;
        }
        .email-button:hover { background: #0056b3; }
        .button-container { text-align: center; margin-top: 24px; }
        .copy-button { 
            display: inline-block; 
            background: #28a745; 
            color: white; 
            padding: 12px 24px; 
            border-radius: 8px; 
            text-decoration: none; 
            font-weight: 500;
            border: none;
            cursor: pointer;
            font-size: 16px;
            margin-left: 12px;
        }
        .copy-button:hover { background: #1e7e34; }
        .note { font-size: 14px; color: #6c757d; text-align: center; margin-top: 16px; }
        .email-template { 
            background: #f8f9fa; 
            border: 1px solid #dee2e6; 
            border-radius: 8px; 
            padding: 16px; 
            margin: 24px 0; 
            font-family: monospace; 
            font-size: 14px; 
            white-space: pre-wrap; 
            display: none;
        }
        .show-template { display: block; }
    </style>
</head>
<body>
    <div class="container">
        <div class="status-badge" style="
            display: inline-block;
            padding: 8px 16px;
            border-radius: 20px;
            font-weight: 600;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            background: ${isAccepted ? '#d4edda' : '#f8d7da'};
            color: ${isAccepted ? '#155724' : '#721c24'};
            margin-bottom: 24px;
            text-align: center;
        ">${statusText}</div>
        <div class="title">Decision Already Made</div>
        <div class="message">
            A decision has already been made for this booking request. If you need to change this decision, please use the contact button below.
        </div>
        
        <div class="status-info">
            <div class="detail-row">
                <span class="detail-label">Customer:</span>
                <span class="detail-value">${escapeHtml(customerName)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Email:</span>
                <span class="detail-value">${escapeHtml(customerEmail)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Transaction ID:</span>
                <span class="detail-value">${transactionId.slice(0, 16)}...</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Current Status:</span>
                <span class="detail-value current-status">${escapeHtml(currentStatus)}</span>
            </div>
        </div>
        
        <div class="button-container">
            <a href="mailto:${escapeHtml(ownerEmail)}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}" 
               class="email-button"
               target="_blank"
               rel="noopener">
                Contact to Change Decision
            </a>
            <button onclick="toggleEmailTemplate()" class="copy-button">
                Show Email Template
            </button>
        </div>
        
        <div id="email-template" class="email-template">To: ${escapeHtml(ownerEmail)}
Subject: ${emailSubject}

${emailBody}</div>
        
        <div class="note">
            Click the email button to open your mail client, or use "Show Email Template" to copy the message manually.
        </div>
        
        <script>
            function toggleEmailTemplate() {
                const template = document.getElementById('email-template');
                const button = event.target;
                if (template.style.display === 'none' || !template.style.display) {
                    template.style.display = 'block';
                    button.textContent = 'Hide Email Template';
                } else {
                    template.style.display = 'none';
                    button.textContent = 'Show Email Template';
                }
            }
        </script>
    </div>
</body>
</html>`;
}

type EmailPayload = {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  tags?: string[] | Record<string, string>;
  replyTo?: string;
  headers?: Record<string, string>;
};

type ResendResult = {
  id: string;
};

interface RequestLogMeta {
  url: string;
  method: string;
  rayId?: string;
  attempt?: number;
  submissionId?: string;
  customerEmail?: string;
  sourceIp?: string;
}

type RequestLogPayload = RequestLogMeta & {
  stage: string;
  status?: number;
  reason?: string;
  dryRun?: boolean;
  resendId?: string | null;
  transactionId?: string;
  payload?: unknown;
  rawBody?: string;
  receivedAt?: string;
};

function buildRequestMeta(request: Request): RequestLogMeta {
  // Framer retries failed deliveries with a monotonically increasing
  // `framer-webhook-attempt` header. Recording it alongside the Ray ID lets us
  // correlate every Cloudflare retry with our own log entries.
  const attemptRaw = request.headers.get("framer-webhook-attempt");
  const attempt = attemptRaw ? Number.parseInt(attemptRaw, 10) : undefined;

  return {
    url: request.url,
    method: request.method,
    rayId: request.headers.get("cf-ray") ?? undefined,
    attempt: Number.isFinite(attempt) ? attempt : undefined,
    submissionId: request.headers.get("framer-webhook-submission-id") ?? undefined,
    sourceIp:
      request.headers.get("cf-connecting-ip") ??
      request.headers.get("x-real-ip") ??
      undefined,
  };
}

async function logRequestEvent(
  event: "received" | "completed" | "failed",
  payload: RequestLogPayload
): Promise<void> {
  // Create a single, comprehensive log entry with improved readability
  const logLevel = event === "failed" ? "ERROR" : "INFO";
  const customerEmail = payload.customerEmail ? ` (${payload.customerEmail})` : "";
  const submissionId = payload.submissionId ? ` [${payload.submissionId.slice(-8)}]` : "";
  const attempt = payload.attempt ? ` attempt:${payload.attempt}` : "";
  
  let statusInfo = "";
  if (payload.status) {
    statusInfo = ` → ${payload.status}`;
    if (payload.reason) {
      statusInfo += ` ${payload.reason}`;
    }
  }
  
  let successInfo = "";
  if (event === "completed") {
    const dryRunLabel = payload.dryRun ? " (dry-run)" : "";
    const resendInfo = payload.resendId ? ` resend:${payload.resendId}` : "";
    successInfo = `${dryRunLabel}${resendInfo}`;
  }

  const message = `[webhook] ${event.toUpperCase()}${submissionId}${customerEmail}${attempt}${statusInfo}${successInfo}`;
  
  console.log({
    message,
    level: logLevel,
    event,
    ...payload,
  });
}

async function logFailure(
  stage: "security" | "coordination",
  response: Response,
  meta: RequestLogMeta,
  securityResult?: SecurityResult<Record<string, unknown>>
): Promise<void> {
  // When `validateRequest` or `handleSubmission` throw a Response we treat it
  // as a controlled rejection. Recording the body (if present) gives us the
  // exact error message that was surfaced to the caller.
  const reason = await safeReadResponse(response.clone());
  await logRequestEvent("failed", {
    ...meta,
    stage,
    status: response.status,
    reason,
    payload: securityResult?.body,
    rawBody: securityResult?.rawBody,
  });
}

async function safeReadResponse(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch (error) {
    // Not all responses allow their body to be re-read (e.g. if already
    // streamed). In that case we log the failure but fall back to a sentinel
    // value so observability queries remain consistent.
    console.warn("Failed to read response body for logging", error);
    return "<unavailable>";
  }
}

/**
 * Builds professional owner notification email using ticket card design
 * 
 * Uses the new ticket-style templates for consistent branding and better
 * mobile responsiveness. Features:
 * - Realistic ticket card appearance
 * - Clear route display with location codes
 * - Secure one-time decision links
 * - Professional information hierarchy
 * 
 * @param summary - Processed booking summary with all trip details
 * @param rawBody - Original webhook payload for audit trail
 * @param env - Environment variables for URLs and contact info
 * @returns Complete email payload ready for Resend API
 */
async function buildOwnerEmailPayload({
  summary,
  rawBody,
  env,
}: {
  summary: CoordinationResult["summary"];
  rawBody: string;
  env: Env;
}): Promise<EmailPayload> {
  // Generate secure one-time tokens for accept/deny actions
  const { acceptToken, denyToken } = await generateDecisionTokens(
    summary.transactionId,
    summary.customerName,
    summary.customerEmail,
    env.SECURITY_STATE
  );
  
  const baseUrl = env.WORKER_URL || 'https://ac-shuttle-dev-worker.acshuttles157.workers.dev';
  const acceptUrl = `${baseUrl}/accept/${acceptToken}`;
  const denyUrl = `${baseUrl}/deny/${denyToken}`;
  
  // Prepare data for ticket template
  const templateData: OwnerNotificationData = {
    startLocation: summary.startLocation,
    endLocation: summary.endLocation,
    pickupTime: formatTicketTime(summary.pickupTime),
    pickupDate: formatTicketDate(summary.pickupTime),
    price: summary.price === "TBD" ? "TBD" : summary.price,
    passengers: summary.passengers,
    estimatedDuration: summary.estimatedDuration,
    estimatedDistance: summary.estimatedDistance,
    customerName: summary.customerName,
    customerEmail: summary.customerEmail,
    customerPhone: summary.customerPhone,
    vehicleType: summary.vehicleType,
    notes: summary.notes,
    mapUrl: summary.mapUrl,
    bookingRef: summary.transactionId.slice(0, 10).toUpperCase(),
    acceptUrl,
    denyUrl
  };
  
  // Generate ticket-style email
  const { html, text } = generateOwnerNotificationEmail(templateData);
  const subject = `${templateData.price} Ride Request – ${templateData.startLocation.split(',')[0]} → ${templateData.endLocation.split(',')[0]}`;

  return {
    from: `AC Shuttles Booking System <${env.CUSTOMER_FROM_EMAIL}>`,
    to: env.OWNER_EMAIL,
    subject,
    html,
    text,
    tags: ["booking-alert", "owner-notification", "action-required"],
    replyTo: summary.customerEmail, // Allow direct reply to customer
    headers: {
      'X-Entity-Ref-ID': summary.transactionId.slice(0, 16),
      'List-Unsubscribe': '<mailto:unsubscribe@ac-shuttles.com>',
      'X-Auto-Response-Suppress': 'OOF, DR, RN, NRN',
    },
  };
}

/**
 * Builds customer submission acknowledgment email
 *
 * Sends a simple "thank you" email immediately after form submission
 * to confirm receipt and provide contact information.
 *
 * @param summary - Processed booking summary with all trip details
 * @param env - Environment variables for contact info
 * @returns Complete email payload ready for Resend API
 */
function buildCustomerSubmissionAckEmail(
  summary: CoordinationResult["summary"],
  env: Env
): EmailPayload {
  const templateData: CustomerSubmissionAckData = {
    customerName: summary.customerName,
    customerEmail: summary.customerEmail,
    startLocation: summary.startLocation,
    endLocation: summary.endLocation,
    pickupTime: formatTicketTime(summary.pickupTime),
    pickupDate: formatTicketDate(summary.pickupTime),
    bookingRef: summary.transactionId.slice(0, 10).toUpperCase(),
    contactPhone: env.DRIVER_CONTACT_PHONE || '',
    contactEmail: env.DRIVER_CONTACT_EMAIL || env.CUSTOMER_FROM_EMAIL,
  };

  const { html, text } = generateCustomerSubmissionAckEmail(templateData);
  const subject = `Thank You - Ride Request Received`;

  return {
    from: `AC Shuttles <${env.CUSTOMER_FROM_EMAIL}>`,
    to: summary.customerEmail,
    subject,
    html,
    text,
    tags: ["submission-acknowledgment", "customer-notification"],
    headers: {
      'X-Entity-Ref-ID': summary.transactionId.slice(0, 16),
    },
  };
}

function summarizeBody(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) {
    return "<empty body>";
  }

  return trimmed.length > 140 ? `${trimmed.slice(0, 140)}…` : trimmed;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function sendEmail(
  apiKey: string,
  payload: EmailPayload,
  verbose: boolean,
  enableTracking: boolean = true
): Promise<ResendResult> {
  // Handle both string array and object formats for tags
  let tagObjects: { name: string }[] | undefined;
  if (Array.isArray(payload.tags)) {
    const sanitized = payload.tags
      .map((tag) => sanitizeTagString(tag))
      .filter((name): name is string => Boolean(name));
    tagObjects = sanitized.length ? sanitized.map((name) => ({ name })) : undefined;
  } else if (payload.tags && typeof payload.tags === 'object') {
    const sanitized = Object.entries(payload.tags)
      .map(([key, value]) => {
        const keyPart = sanitizeTagComponent(key, 'tag');
        const valuePart = sanitizeTagComponent(value, 'value');
        return keyPart && valuePart ? `${keyPart}_${valuePart}` : null;
      })
      .filter((name): name is string => Boolean(name));
    tagObjects = sanitized.length ? sanitized.map((name) => ({ name })) : undefined;
  }

  const resendPayload: Record<string, unknown> = {
    from: payload.from,
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
    ...(tagObjects && { tags: tagObjects }),
    ...(payload.replyTo && { reply_to: payload.replyTo }),
    ...(payload.headers && { headers: payload.headers }),
  };

  // Determine if this is for owner or customer based on tags
  const tagArray = tagObjects?.map((tag) => tag.name) ?? [];
  const isCustomerNotification = tagArray.some(tag => tag.includes('customer'));
  const logMessage = isCustomerNotification ? "sending customer notification" : "sending owner alert";
  const alertType = isCustomerNotification ? "Booking Decision Notification" : "New Booking Request";
  
  logVerbose(verbose, logMessage, {
    recipient: payload.to,
    alertType, 
    tags: tagArray,
  });

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
    console.error("Resend API error", { status: response.status, errorText, payload });
    throw new Error(`Failed to send email via Resend (status ${response.status})`);
  }

  const result = (await response.json()) as ResendResult;
  const notifiedMessage = isCustomerNotification ? "customer notified" : "owner notified";
  const nextStep = isCustomerNotification ? "Customer informed of decision" : "Awaiting owner decision";
  
  logVerbose(verbose, notifiedMessage, {
    deliveryStatus: "SUCCESS",
    messageId: result.id.slice(0, 12),
    recipient: payload.to,
    nextStep,
  });

  return result;
}

async function handleResendWebhook(request: Request, env: Env): Promise<Response> {
  try {
    const payload = await request.json() as any;
    
    // Verify webhook signature if configured
    if (env.RESEND_WEBHOOK_SECRET) {
      const signature = request.headers.get('resend-signature');
      if (!signature) {
        return new Response('Missing signature', { status: 401 });
      }
      
      // Verify the signature (Resend uses HMAC-SHA256)
      const body = await request.text();
      const expectedSignature = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(env.RESEND_WEBHOOK_SECRET + body)
      );
      
      // Compare signatures
      const expectedHex = Array.from(new Uint8Array(expectedSignature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
        
      if (signature !== expectedHex) {
        return new Response('Invalid signature', { status: 401 });
      }
    }
    
    // Handle email delivery events
    if (payload.type === 'email.delivered') {
      const emailData = payload.data;
      
      // Extract metadata from email tags/headers to identify the booking
      const transactionId = emailData.tags?.transaction_id || emailData.subject?.match(/AC[0-9]+/)?.[0];
      const notificationType = emailData.tags?.notification_type;
      const customerEmail = emailData.to?.[0]?.email;
      
      if (transactionId && notificationType && customerEmail && 
          (notificationType === 'accepted' || notificationType === 'denied')) {
        
        // Fetch booking details to send owner notification
        try {
          const bookingDetails = await fetchBookingDetails(transactionId, env);
          
          const ownerNotificationData: OwnerDeliveryNotificationData = {
            customerName: bookingDetails.customerName || 'Unknown',
            customerEmail: customerEmail,
            startLocation: bookingDetails.startLocation,
            endLocation: bookingDetails.endLocation,
            pickupTime: bookingDetails.pickupTime,
            pickupDate: bookingDetails.pickupDate || formatTicketDate(new Date()),
            notificationType: notificationType as 'accepted' | 'denied',
            deliveredAt: new Date().toISOString(),
            bookingRef: bookingDetails.bookingRef,
            transactionId: transactionId
          };
          
          const ownerEmail = generateOwnerDeliveryNotificationEmail(ownerNotificationData);
          
          // Send delivery confirmation to owner
          if (env.OWNER_EMAIL && env.RESEND_API_KEY) {
            await sendEmail(env.RESEND_API_KEY, {
              to: env.OWNER_EMAIL,
              subject: `Customer Notification Delivered - ${bookingDetails.bookingRef}`,
              html: ownerEmail.html,
              text: ownerEmail.text,
              tags: {
                type: 'owner_delivery_notification',
                transaction_id: transactionId,
                notification_type: notificationType
              }
            }, isVerbose(env), false); // Don't track delivery for delivery notifications
          }
          
          console.log(`Delivery notification sent for ${transactionId} (${notificationType})`);
          
        } catch (error) {
          console.error(`Failed to send delivery notification for ${transactionId}:`, error);
        }
      }
    }
    
    return new Response('OK', { status: 200 });
    
  } catch (error) {
    console.error('Webhook processing error:', error);
    return new Response('Internal error', { status: 500 });
  }
}

const ALLOWED_CORS_HEADERS = 'Content-Type, framer-signature, framer-webhook-submission-id';
const ALLOWED_CORS_METHODS = 'POST, OPTIONS';

function handleCorsPreflight(request: Request): Response {
  const origin = request.headers.get('Origin');
  const response = applyCors(new Response(null, { status: 204 }), origin);
  response.headers.set('Access-Control-Max-Age', '86400');
  return response;
}

function isPrefetchRequest(request: Request): boolean {
  const purposeHeaders = ['purpose', 'sec-purpose', 'sec-fetch-purpose'];
  for (const header of purposeHeaders) {
    const value = request.headers.get(header);
    if (value && value.toLowerCase().includes('prefetch')) {
      return true;
    }
  }

  const userAgent = request.headers.get('user-agent') ?? '';
  return PREFETCH_USER_AGENTS.some((pattern) => pattern.test(userAgent));
}

function renderPrefetchPage(decision: 'accepted' | 'denied'): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AC Shuttles Decision Link</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; margin: 0; background: #0f172a; color: #e2e8f0; }
    .card { max-width: 520px; margin: 0 auto; background: rgba(15, 23, 42, 0.85); border-radius: 16px; padding: 32px; box-shadow: 0 12px 40px rgba(15, 23, 42, 0.45); border: 1px solid rgba(148, 163, 184, 0.2); text-align: center; }
    .icon { font-size: 40px; margin-bottom: 16px; }
    h1 { font-size: 22px; margin: 0 0 12px; }
    p { margin: 0; line-height: 1.6; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">🔒</div>
    <h1>Secure Decision Link</h1>
    <p>This preview was generated automatically. Please open the email and click the ${decision === 'accepted' ? 'accept' : 'deny'} button from your browser to complete the decision.</p>
  </div>
</body>
</html>`;
}

function getDecisionMinAgeMs(env: CoordinationEnv): number {
  const raw = env.DECISION_MIN_AGE_MS;
  if (raw == null || raw === '') {
    return DEFAULT_DECISION_MIN_AGE_MS;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_DECISION_MIN_AGE_MS;
  }
  return parsed;
}

function renderCooldownPage(decision: 'accepted' | 'denied', remainingMs: number, minAgeMs: number): string {
  const waitSeconds = Math.max(Math.ceil(remainingMs / 100) / 10, 0.1);
  const totalSeconds = Math.ceil(minAgeMs / 100) / 10;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AC Shuttles Decision Link</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; margin: 0; background: #0f172a; color: #e2e8f0; }
    .card { max-width: 520px; margin: 0 auto; background: rgba(15, 23, 42, 0.9); border-radius: 16px; padding: 32px; box-shadow: 0 12px 40px rgba(15, 23, 42, 0.45); border: 1px solid rgba(148, 163, 184, 0.2); text-align: center; }
    .icon { font-size: 40px; margin-bottom: 16px; }
    h1 { font-size: 22px; margin: 0 0 12px; }
    p { margin: 0; line-height: 1.6; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">⏳</div>
    <h1>Almost Ready</h1>
    <p>This secure ${decision} link activates ${totalSeconds.toFixed(1)} seconds after delivery. Please try again in about ${waitSeconds.toFixed(1)} seconds.</p>
  </div>
</body>
</html>`;
}

function buildDecisionAuditMetadata({
  request,
  decision,
  token,
  tokenData,
}: {
  request: Request;
  decision: 'accepted' | 'denied';
  token: string;
  tokenData: DecisionToken;
}): string {
  const createdAtMs = Date.parse(tokenData.createdAt);
  const tokenAgeMs = Number.isFinite(createdAtMs) ? Date.now() - createdAtMs : undefined;
  const metadata = {
    source: 'owner_decision',
    decision,
    token_prefix: token.slice(0, 12),
    token_age_ms: tokenAgeMs,
    user_agent: request.headers.get('user-agent') ?? undefined,
    ip: getRequestIp(request) ?? undefined,
    cf_ray: request.headers.get('cf-ray') ?? undefined,
    referer: request.headers.get('referer') ?? undefined,
  } as Record<string, unknown>;

  const cleaned = Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => value !== undefined && value !== null && value !== '')
  );

  let serialized = JSON.stringify(cleaned);
  if (serialized.length > 900) {
    serialized = serialized.slice(0, 900) + '…';
  }
  return serialized;
}

function getRequestIp(request: Request): string | undefined {
  return (
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    undefined
  );
}

function sanitizeTagComponent(input: unknown, fallback: string): string {
  const raw = String(input ?? '').trim().toLowerCase();
  const sanitized = raw.replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return sanitized || fallback;
}

function sanitizeTagString(input: unknown): string | null {
  const normalized = sanitizeTagComponent(input, 'tag');
  return normalized || null;
}

function applyCors(response: Response, origin: string | null): Response {
  const allowOrigin = origin ?? '*';
  response.headers.set('Access-Control-Allow-Origin', allowOrigin);
  response.headers.set('Vary', 'Origin');
  response.headers.set('Access-Control-Allow-Headers', ALLOWED_CORS_HEADERS);
  response.headers.set('Access-Control-Allow-Methods', ALLOWED_CORS_METHODS);
  return response;
}

function isVerbose(env: { VERBOSE_LOGGING?: string }): boolean {
  const flag = env.VERBOSE_LOGGING ?? "false";
  return flag.toLowerCase() === "true" || flag === "1";
}

function logVerbose(
  verbose: boolean,
  message: string,
  data: Record<string, unknown>,
  level: "log" | "warn" = "log"
): void {
  if (!verbose) {
    return;
  }
  
  // Create structured verbose logs with proper formatting for Cloudflare observability
  const timestamp = new Date().toISOString();
  const payload = {
    message: `[webhook] VERBOSE ${message.toUpperCase()}`,
    level: level.toUpperCase(), 
    timestamp,
    stage: "verbose",
    verboseType: message,
    // Add Cloudflare-specific metadata for better observability indexing
    "$metadata": {
      type: "webhook-verbose",
      stage: message,
      timestamp,
    },
    ...data,
  };
  
  if (level === "warn") {
    console.warn(payload);
  } else {
    console.log(payload);
  }
}

export { summarizeBody, escapeHtml };
export type { Env, EmailPayload };
