// Entry point for the Resend-backed webhook worker.
// The request lifecycle is deliberately staged so the structured logs contain
// a complete narrative for every Framer webhook attempt:
//   1. Capture request metadata (URL, Ray ID, retry attempt, source IP) and
//      emit a `[webhook] received` log before we inspect the body.
//   2. Run the security layer, which enforces HTTP method, HMAC verification,
//      rate limits, and duplicate suppression. Any failure is reported via a
//      `[webhook] failed` log that includes the HTTP status and rejection text.
//   3. Forward the normalized payload to the coordination layer so the
//      submission is persisted to Google Sheets and audit trails.
//   4. Compose the owner notification and, unless `RESEND_DRY_RUN` is active,
//      relay it through Resend. Delivery problems are surfaced together with
//      Resend’s response text to simplify debugging.
//   5. Mark the submission as processed in KV and emit a terminal
//      `[webhook] completed` log containing the transaction ID, payload
//      snapshot, and (when applicable) the Resend message identifier.

import type { SecurityResult } from "./layers/security";
import { validateRequest, SecurityEnv } from "./layers/security";
import { handleSubmission, CoordinationEnv, CoordinationResult, checkAndUpdateBookingStatus } from "./layers/coordination";
import { GoogleSheetsClient } from "./integrations/googleSheets";

const RESEND_API_URL = "https://api.resend.com/emails";
const DEFAULT_TOKEN_TTL_MINUTES = 60;

interface Env extends SecurityEnv, CoordinationEnv {
  RESEND_API_KEY: string;
  CUSTOMER_FROM_EMAIL: string;
  OWNER_EMAIL: string;
  RESEND_DRY_RUN?: string;
  VERBOSE_LOGGING?: string;
  TOKEN_TTL_MINUTES?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    // Handle accept/deny routes
    if (url.pathname.startsWith('/accept/')) {
      return handleOwnerDecision(request, env, 'accepted');
    }
    
    if (url.pathname.startsWith('/deny/')) {
      return handleOwnerDecision(request, env, 'denied');
    }
    
    // Default webhook handling
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
        return error;
      }
      console.error("Security layer failure", error);
      await logRequestEvent("failed", {
        ...requestMeta,
        stage: "security",
        status: 500,
        reason: "Unhandled security exception",
      });
      return new Response("Internal Server Error", { status: 500 });
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
        return error;
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
      return new Response("Internal Server Error", { status: 500 });
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

    if (!dryRun) {
      try {
        resendResult = await sendEmail(env.RESEND_API_KEY, ownerEmailRequest, verbose);
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
        return Response.json(
          {
            ok: false,
            dryRun,
            receivedAt,
            error: "Failed to send notification",
          },
          { status: 502 }
        );
      }
    }

    await securityResult.markProcessed();
    logVerbose(verbose, "booking completed", {
      customer: coordination.summary.customerName,
      email: securityResult.customerEmail,
      route: `${coordination.summary.startLocation} → ${coordination.summary.endLocation}`,
      actionRequired: "Owner needs to accept/deny this booking",
      notificationSent: !dryRun,
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

    return Response.json(
      {
        ok: true,
        dryRun,
        receivedAt,
        resendId: resendResult?.id ?? null,
      },
      { status: 200 }
    );
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
    throw new Error(`Booking has already been ${currentStatus.toLowerCase()}. Links are no longer valid.`);
  }
  
  // Mark token as used
  tokenData.usedAt = new Date().toISOString();
  await kv.put(tokenKey, JSON.stringify(tokenData), { expirationTtl: 300 }); // Keep for 5 minutes for logging
  
  return tokenData;
}

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
    
    // Check current booking status in Google Sheets and attempt to update
    const newDecisionStatus = decision === 'accepted' ? 'Accepted' : 'Denied';
    const statusResult = await checkAndUpdateBookingStatus(
      tokenData.transactionId,
      newDecisionStatus,
      env
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
      const customerEmail = buildCustomerNotificationEmail(decision, customerDetails, env);
      await sendEmail(env.RESEND_API_KEY, customerEmail, isVerbose(env));
    }
    
    return new Response(
      renderSuccessPage(decision, tokenData.transactionId, customerDetails.name),
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

function buildCustomerNotificationEmail(
  decision: 'accepted' | 'denied',
  customer: { name: string; email: string },
  env: Env
): EmailPayload {
  const isAccepted = decision === 'accepted';
  const subject = `${isAccepted ? '✅' : '❌'} Your AC Shuttles Booking ${isAccepted ? 'Confirmed' : 'Update'}`;
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Booking ${isAccepted ? 'Confirmed' : 'Update'} - AC Shuttles</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8f9fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <div style="background: ${isAccepted ? 'linear-gradient(135deg, #28a745 0%, #20c997 100%)' : 'linear-gradient(135deg, #dc3545 0%, #e74c3c 100%)'}; color: white; padding: 40px; text-align: center;">
            <h1 style="margin: 0; font-size: 28px;">${isAccepted ? '✅ Booking Confirmed!' : '❌ Booking Update'}</h1>
            <p style="margin: 10px 0 0 0; font-size: 18px; opacity: 0.9;">AC Shuttles</p>
        </div>
        <div style="padding: 40px;">
            <p style="font-size: 16px; margin-bottom: 24px;">Dear ${escapeHtml(customer.name)},</p>
            ${isAccepted ? `
            <p style="font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
                Great news! Your shuttle booking has been <strong>confirmed</strong>. Our driver will contact you shortly with final details.
            </p>
            <div style="background-color: #d4edda; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
                <h3 style="margin: 0 0 16px 0; color: #155724;">Driver Contact Information</h3>
                <p style="margin: 0; font-size: 16px;">
                    <strong>Name:</strong> ${env.DRIVER_CONTACT_NAME || 'AC Shuttles Driver'}<br>
                    <strong>Phone:</strong> <a href="tel:${env.DRIVER_CONTACT_PHONE}" style="color: #28a745;">${env.DRIVER_CONTACT_PHONE}</a><br>
                    <strong>Email:</strong> <a href="mailto:${env.DRIVER_CONTACT_EMAIL}" style="color: #28a745;">${env.DRIVER_CONTACT_EMAIL}</a>
                </p>
            </div>
            <p style="font-size: 16px; line-height: 1.6;">
                Please be ready at your pickup location 5-10 minutes before your scheduled time. Our driver will call you upon arrival.
            </p>
            ` : `
            <p style="font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
                We regret to inform you that we cannot accommodate your shuttle booking at this time. This may be due to scheduling conflicts or route limitations.
            </p>
            <p style="font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
                Please feel free to contact us directly at <a href="tel:${env.DRIVER_CONTACT_PHONE}" style="color: #007bff;">${env.DRIVER_CONTACT_PHONE}</a> to discuss alternative arrangements.
            </p>
            `}
            <p style="font-size: 16px; margin-top: 32px;">
                Thank you for choosing AC Shuttles!<br>
                <strong>AC Shuttles Team</strong>
            </p>
        </div>
    </div>
</body>
</html>`;

  return {
    from: `AC Shuttles <${env.CUSTOMER_FROM_EMAIL}>`,
    to: customer.email,
    subject,
    html,
    text: isAccepted 
      ? `Booking Confirmed!\n\nDear ${customer.name},\n\nYour shuttle booking has been confirmed. Our driver will contact you shortly.\n\nDriver Contact:\nName: ${env.DRIVER_CONTACT_NAME}\nPhone: ${env.DRIVER_CONTACT_PHONE}\nEmail: ${env.DRIVER_CONTACT_EMAIL}\n\nThank you for choosing AC Shuttles!`
      : `Booking Update\n\nDear ${customer.name},\n\nWe regret that we cannot accommodate your shuttle booking at this time. Please contact us at ${env.DRIVER_CONTACT_PHONE} for alternatives.\n\nThank you for considering AC Shuttles.`,
    tags: [`booking-${decision}`, "customer-notification"],
  };
}

function renderSuccessPage(decision: 'accepted' | 'denied', transactionId: string, customerName: string): string {
  const isAccepted = decision === 'accepted';
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Booking ${isAccepted ? 'Accepted' : 'Declined'} - AC Shuttles</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 40px; background: #f8f9fa; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .icon { font-size: 48px; text-align: center; margin-bottom: 24px; }
        .title { font-size: 24px; font-weight: 600; text-align: center; margin-bottom: 16px; color: ${isAccepted ? '#28a745' : '#dc3545'}; }
        .message { font-size: 16px; line-height: 1.6; text-align: center; color: #6c757d; margin-bottom: 32px; }
        .details { background: #f8f9fa; border-radius: 8px; padding: 20px; }
        .detail-row { display: flex; justify-content: space-between; margin-bottom: 8px; }
        .detail-label { font-weight: 500; color: #495057; }
        .detail-value { color: #6c757d; }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">${isAccepted ? '✅' : '❌'}</div>
        <div class="title">Booking ${isAccepted ? 'Accepted' : 'Declined'}</div>
        <div class="message">
            ${isAccepted 
              ? `You have successfully accepted the booking request from <strong>${escapeHtml(customerName)}</strong>. The customer has been notified and will receive driver contact information.`
              : `You have declined the booking request from <strong>${escapeHtml(customerName)}</strong>. The customer has been notified about this decision.`
            }
        </div>
        <div class="details">
            <div class="detail-row">
                <span class="detail-label">Transaction ID:</span>
                <span class="detail-value">${transactionId.slice(0, 16)}...</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Customer:</span>
                <span class="detail-value">${escapeHtml(customerName)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Decision:</span>
                <span class="detail-value" style="color: ${isAccepted ? '#28a745' : '#dc3545'}; font-weight: 500;">${isAccepted ? 'Accepted' : 'Declined'}</span>
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
        <div class="icon">⚠️</div>
        <div class="title">${escapeHtml(title)}</div>
        <div class="message">${escapeHtml(message)}</div>
    </div>
</body>
</html>`;
}

function renderDecisionAlreadyMadePage(currentStatus: string, transactionId: string, customerName: string, customerEmail: string, ownerEmail: string): string {
  const isAccepted = currentStatus.toLowerCase() === 'accepted';
  const statusColor = isAccepted ? '#28a745' : '#dc3545';
  const statusIcon = isAccepted ? '✅' : '❌';
  
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
        <div class="icon">${statusIcon}</div>
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
                📧 Contact to Change Decision
            </a>
            <button onclick="toggleEmailTemplate()" class="copy-button">
                📋 Show Email Template
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
                    button.textContent = '📋 Hide Email Template';
                } else {
                    template.style.display = 'none';
                    button.textContent = '📋 Show Email Template';
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
  tags?: string[];
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

async function buildOwnerEmailPayload({
  summary,
  rawBody,
  env,
}: {
  summary: CoordinationResult["summary"];
  rawBody: string;
  env: Env;
}): Promise<EmailPayload> {
  const priceDisplay = summary.price === "TBD" ? "TBD" : summary.price;
  const subject = `💰 ${priceDisplay} Ride Request – ${summary.startLocation} → ${summary.endLocation}`;
  
  // Generate secure one-time tokens for accept/deny actions
  const { acceptToken, denyToken } = await generateDecisionTokens(
    summary.transactionId,
    summary.customerName,
    summary.customerEmail,
    env.SECURITY_STATE
  );
  
  const baseUrl = env.WORKER_URL || 'https://ac-shuttle-dev-worker.goldenkey-realestate-residential.workers.dev';
  const acceptUrl = `${baseUrl}/accept/${acceptToken}`;
  const denyUrl = `${baseUrl}/deny/${denyToken}`;
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Ride Request - AC Shuttles</title>
    <style>
        /* Print-friendly styles */
        @media print {
            * { 
                -webkit-print-color-adjust: exact !important; 
                color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
            body { 
                background-color: white !important; 
                color: black !important;
            }
            .container { 
                background-color: white !important; 
                border: 1px solid #ccc !important;
                box-shadow: none !important;
            }
            .header-section {
                background-color: #0D9B8A !important;
                color: white !important;
                -webkit-print-color-adjust: exact !important;
            }
            .price-highlight {
                background-color: #0D9B8A !important;
                color: white !important;
                -webkit-print-color-adjust: exact !important;
            }
            .info-section {
                background-color: #f5f5f5 !important;
                border: 1px solid #ddd !important;
                color: black !important;
            }
            .section-label {
                color: #0D9B8A !important;
                font-weight: bold !important;
            }
            .action-button {
                border: 2px solid #0D9B8A !important;
                background-color: white !important;
                color: #0D9B8A !important;
                font-weight: bold !important;
            }
        }
        
        /* Mobile responsive */
        @media only screen and (max-width: 600px) {
            .container { width: 100% !important; }
            .content { padding: 24px !important; }
            table { width: 100% !important; }
            td { display: block !important; width: 100% !important; padding: 8px 0 !important; }
        }
    </style>
    <!--[if mso]>
    <noscript>
        <xml>
            <o:OfficeDocumentSettings>
                <o:AllowPNG/>
                <o:PixelsPerInch>96</o:PixelsPerInch>
            </o:OfficeDocumentSettings>
        </xml>
    </noscript>
    <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #000000; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #ffffff; min-height: 100vh;">
    <div class="container" style="max-width: 600px; margin: 0 auto; background-color: #000000;">
        <!-- Header -->
        <div class="header-section" style="background: linear-gradient(135deg, #0D9B8A 0%, #0BD8B6 100%); color: #000000; padding: 30px; text-align: center;">
            <h1 style="margin: 0; font-size: 28px; font-weight: 700;">🚗 AC Shuttles Booking Request</h1>
            <p style="margin: 8px 0 0 0; font-size: 16px; opacity: 0.8; font-weight: 500;">Action Required</p>
        </div>
        
        <!-- Content -->
        <div style="padding: 40px;">
            <!-- Price & Route Summary -->
            <div class="price-highlight" style="background: linear-gradient(135deg, #0D9B8A 0%, #0BD8B6 100%); border-radius: 12px; padding: 24px; margin-bottom: 32px; text-align: center;">
                <div style="font-size: 36px; font-weight: 900; color: #000000; line-height: 1; margin-bottom: 12px;">
                    💰 ${summary.price === "TBD" ? "PRICING TBD" : escapeHtml(summary.price)}
                </div>
                <div style="font-size: 18px; font-weight: 700; color: #000000; margin-bottom: 8px;">
                    📍 ${escapeHtml(summary.startLocation)} → ${escapeHtml(summary.endLocation)}
                </div>
                <div style="font-size: 14px; color: #000000; opacity: 0.8; font-weight: 600;">
                    🕒 ${escapeHtml(summary.pickupTime)} • 👥 ${escapeHtml(summary.passengers)} passenger${parseInt(summary.passengers) === 1 ? '' : 's'} • ⏱️ ${escapeHtml(summary.estimatedDuration)}
                </div>
            </div>
            
            <!-- Trip Details -->
            <div class="info-section" style="background-color: #1a1a1a; border-radius: 12px; padding: 24px; margin-bottom: 32px; border: 1px solid #333;">
                <h2 style="margin: 0 0 16px 0; font-size: 18px; color: #0BD8B6; font-weight: 600;">
                    📋 Trip Details
                </h2>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="width: 50%; padding-right: 12px; vertical-align: top; padding-bottom: 16px;">
                            <div class="section-label" style="color: #0D9B8A; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; font-weight: 600;">Distance</div>
                            <div style="font-size: 16px; color: #ffffff; font-weight: 600;">${escapeHtml(summary.estimatedDistance)}</div>
                        </td>
                        <td style="width: 50%; padding-left: 12px; vertical-align: top; padding-bottom: 16px;">
                            <div class="section-label" style="color: #0D9B8A; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; font-weight: 600;">Duration</div>
                            <div style="font-size: 16px; color: #ffffff; font-weight: 600;">${escapeHtml(summary.estimatedDuration)}</div>
                        </td>
                    </tr>
                    ${summary.vehicleType || summary.notes ? `<tr>
                        ${summary.vehicleType ? `<td style="width: 50%; padding-right: 12px; vertical-align: top; padding-bottom: 16px;">
                            <div class="section-label" style="color: #0D9B8A; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; font-weight: 600;">Vehicle Type</div>
                            <div style="font-size: 16px; color: #ffffff; font-weight: 600;">${escapeHtml(summary.vehicleType)}</div>
                        </td>` : '<td></td>'}
                        ${summary.notes ? `<td style="width: 50%; padding-left: 12px; vertical-align: top; padding-bottom: 16px;">
                            <div class="section-label" style="color: #0D9B8A; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; font-weight: 600;">Special Notes</div>
                            <div style="font-size: 16px; color: #ffffff; font-weight: 600;">${escapeHtml(summary.notes)}</div>
                        </td>` : '<td></td>'}
                    </tr>` : ''}
                </table>
            </div>
            
            <!-- Customer Contact -->
            <div class="info-section" style="background-color: #1a1a1a; border-radius: 12px; padding: 24px; margin-bottom: 32px; border: 1px solid #333;">
                <h2 style="margin: 0 0 16px 0; font-size: 18px; color: #0BD8B6; font-weight: 600;">
                    📞 Customer Information
                </h2>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="width: 50%; padding-right: 12px; vertical-align: top; padding-bottom: 16px;">
                            <div class="section-label" style="color: #0D9B8A; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; font-weight: 600;">Customer Name</div>
                            <div style="font-size: 16px; color: #ffffff; font-weight: 600;">${escapeHtml(summary.customerName)}</div>
                        </td>
                        <td style="width: 50%; padding-left: 12px; vertical-align: top; padding-bottom: 16px;">
                            <div class="section-label" style="color: #0D9B8A; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; font-weight: 600;">Phone</div>
                            <div style="font-size: 16px; color: #ffffff; font-weight: 600;">
                                ${summary.customerPhone ? `<a href="tel:${escapeHtml(summary.customerPhone)}" style="color: #0BD8B6; text-decoration: none;">${escapeHtml(summary.customerPhone)}</a>` : '<span style="color: #666;">Not provided</span>'}
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td colspan="2" style="padding-bottom: 0;">
                            <div class="section-label" style="color: #0D9B8A; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; font-weight: 600;">Email Address</div>
                            <div style="font-size: 16px; color: #ffffff; font-weight: 600;">
                                <a href="mailto:${escapeHtml(summary.customerEmail)}" style="color: #0BD8B6; text-decoration: none; word-break: break-word;">${escapeHtml(summary.customerEmail)}</a>
                            </div>
                        </td>
                    </tr>
                </table>
            </div>
            
            <!-- Action Buttons -->
            <div style="text-align: center; margin-bottom: 40px;">
                <h2 style="margin: 0 0 24px 0; font-size: 24px; color: #ffffff; font-weight: 700;">⚡ IMMEDIATE ACTION REQUIRED</h2>
                <table style="margin: 0 auto; border-collapse: separate; border-spacing: 16px;">
                    <tr>
                        <td style="text-align: center;">
                            <a href="${acceptUrl}" class="action-button" style="display: inline-block; background: linear-gradient(135deg, #0D9B8A 0%, #0BD8B6 100%); color: #000000; padding: 18px 36px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 16px; text-transform: uppercase; letter-spacing: 1px; min-width: 180px; text-align: center; box-shadow: 0 4px 12px rgba(13, 155, 138, 0.3);">
                                ✅ ACCEPT
                            </a>
                        </td>
                        <td style="text-align: center;">
                            <a href="${denyUrl}" class="action-button" style="display: inline-block; background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); color: #ffffff; padding: 18px 36px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 16px; text-transform: uppercase; letter-spacing: 1px; min-width: 180px; text-align: center; box-shadow: 0 4px 12px rgba(231, 76, 60, 0.3);">
                                ❌ DECLINE
                            </a>
                        </td>
                    </tr>
                </table>
                <p style="margin: 16px 0 0 0; font-size: 13px; color: #999;">Click to respond immediately</p>
            </div>
            
            <!-- Footer Information -->
            <div style="border-top: 2px solid #333; padding: 32px 0; text-align: center;">
                <p style="margin: 0 0 12px 0; color: #666; font-size: 13px;">
                    This is an automated message from AC Shuttles booking system.
                </p>
                <p style="margin: 0; color: #0BD8B6; font-size: 12px; font-weight: 500;">
                    ℹ️ Links are valid until a decision is made (status: "Pending Review").
                </p>
            </div>
        </div>
    </div>
</body>
</html>`;

  const textLines = [
    "🚗 NEW RIDE REQUEST - AC SHUTTLES",
    "=" .repeat(40),
    "",
    "CUSTOMER DETAILS:",
    `Name: ${summary.customerName}`,
    `Email: ${summary.customerEmail}`,
    `Phone: ${summary.customerPhone ?? "Not provided"}`,
    `Passengers: ${summary.passengers} ${parseInt(summary.passengers) === 1 ? 'person' : 'people'}`,
    "",
    "TRIP DETAILS:",
    `Pickup: ${summary.startLocation}`,
    `Drop-off: ${summary.endLocation}`,
    `Time: ${summary.pickupTime}`,
    `Distance: ${summary.estimatedDistance}`,
    `Duration: ${summary.estimatedDuration}`,
    `Price: ${summary.price === "TBD" ? "To Be Calculated" : summary.price}`,
    ...(summary.notes ? ["", `Notes: ${summary.notes}`] : []),
    "",
    "ACTION REQUIRED:",
    `Accept: ${acceptUrl}`,
    `Decline: ${denyUrl}`,
    "",
    `Transaction ID: ${summary.transactionId.slice(0, 16)}...`,
    "",
    "This is an automated message from AC Shuttles booking system.",
    "Security Notice: Links are valid until a decision is made (status: 'Pending Review').",
  ];

  return {
    from: `AC Shuttles Booking System <${env.CUSTOMER_FROM_EMAIL}>`,
    to: env.OWNER_EMAIL,
    subject,
    html,
    text: textLines.join("\n"),
    tags: ["booking-alert", "owner-notification", "action-required"],
    replyTo: summary.customerEmail, // Allow direct reply to customer
    headers: {
      'X-Entity-Ref-ID': summary.transactionId.slice(0, 16),
      'List-Unsubscribe': '<mailto:unsubscribe@ac-shuttles.com>',
      'X-Auto-Response-Suppress': 'OOF, DR, RN, NRN',
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
  verbose: boolean
): Promise<ResendResult> {
  const tagObjects = payload.tags?.map((tag) => ({ name: tag }));

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
  const isCustomerNotification = payload.tags?.some(tag => tag.includes('customer'));
  const logMessage = isCustomerNotification ? "sending customer notification" : "sending owner alert";
  const alertType = isCustomerNotification ? "Booking Decision Notification" : "New Booking Request";
  
  logVerbose(verbose, logMessage, {
    recipient: payload.to,
    alertType, 
    tags: payload.tags ?? [],
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
