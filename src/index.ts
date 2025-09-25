// Entry point for the Resend-backed webhook worker.
// Security layer handles signature verification and rate limiting before the
// coordination layer persists data and prepares notifications.

import { validateRequest, SecurityEnv } from "./layers/security";
import { handleSubmission, CoordinationEnv, CoordinationResult } from "./layers/coordination";

const RESEND_API_URL = "https://api.resend.com/emails";

interface Env extends SecurityEnv, CoordinationEnv {
  RESEND_API_KEY: string;
  CUSTOMER_FROM_EMAIL: string;
  OWNER_EMAIL: string;
  RESEND_DRY_RUN?: string;
  VERBOSE_LOGGING?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    let securityResult: Awaited<ReturnType<typeof validateRequest>>;
    try {
      securityResult = await validateRequest(request, env);
    } catch (error) {
      if (error instanceof Response) {
        return error;
      }
      console.error("Security layer failure", error);
      return new Response("Internal Server Error", { status: 500 });
    }

    const verbose = isVerbose(env);
    logVerbose(verbose, "request passed security", {
      submissionId: securityResult.submissionId,
      customerEmail: securityResult.customerEmail,
    });

    console.log({
      message: "[webhook] payload received",
      submissionId: securityResult.submissionId,
      requestUrl: request.url,
      payload: securityResult.body,
      rawBody: securityResult.rawBody,
    });

    const receivedAt = new Date().toISOString();

    let coordination: CoordinationResult;
    try {
      coordination = await handleSubmission(securityResult, env, receivedAt);
    } catch (error) {
      if (error instanceof Response) {
        return error;
      }
      console.error("Coordination layer failure", error);
      return new Response("Internal Server Error", { status: 500 });
    }

    logVerbose(verbose, "submission persisted", {
      transactionId: coordination.summary.transactionId,
    });

    const ownerEmailRequest = buildOwnerEmailPayload({
      summary: coordination.summary,
      rawBody: securityResult.rawBody,
      env,
    });

    const dryRun = env.RESEND_DRY_RUN?.toLowerCase() === "true";
    logVerbose(verbose, "owner email prepared", {
      dryRun,
      submissionId: securityResult.submissionId,
      transactionId: coordination.summary.transactionId,
      ownerEmail: ownerEmailRequest.to,
    });

    let resendResult: ResendResult | undefined;

    if (dryRun) {
      console.log("[dry-run] Skipping call to Resend", { ownerEmailRequest });
    } else {
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
    logVerbose(verbose, "submission marked processed", {
      submissionId: securityResult.submissionId,
      transactionId: coordination.summary.transactionId,
    });

    console.log("Webhook received", {
      receivedAt,
      dryRun,
      resendResult,
      submissionId: securityResult.submissionId,
      transactionId: coordination.summary.transactionId,
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

type EmailPayload = {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  tags?: string[];
};

type ResendResult = {
  id: string;
};

function buildOwnerEmailPayload({
  summary,
  rawBody,
  env,
}: {
  summary: CoordinationResult["summary"];
  rawBody: string;
  env: Env;
}): EmailPayload {
  const subject = `New Passenger Alert – ${summary.customerName}`;
  const html = `<!DOCTYPE html>
  <html>
  <body>
    <h2>New Passenger Alert</h2>
    <p><strong>Transaction ID:</strong> ${summary.transactionId}</p>
    <ul>
      <li><strong>Name:</strong> ${escapeHtml(summary.customerName)}</li>
      <li><strong>Email:</strong> ${escapeHtml(summary.customerEmail)}</li>
      <li><strong>Phone:</strong> ${escapeHtml(summary.customerPhone ?? "N/A")}</li>
      <li><strong>Price:</strong> ${escapeHtml(summary.price)}</li>
      <li><strong>Start Location:</strong> ${escapeHtml(summary.startLocation)}</li>
      <li><strong>End Location:</strong> ${escapeHtml(summary.endLocation)}</li>
      <li><strong>Pickup Time:</strong> ${escapeHtml(summary.pickupTime)}</li>
      <li><strong>Estimated Distance:</strong> ${escapeHtml(summary.estimatedDistance)}</li>
      <li><strong>Estimated Duration:</strong> ${escapeHtml(summary.estimatedDuration)}</li>
      <li><strong>Passengers:</strong> ${escapeHtml(summary.passengers)}</li>
    </ul>
    <h3>Raw Submission</h3>
    <pre style="white-space: pre-wrap; word-break: break-word;">${escapeHtml(rawBody)}</pre>
  </body>
  </html>`;

  const textLines = [
    "New Passenger Alert",
    `Transaction ID: ${summary.transactionId}`,
    `Name: ${summary.customerName}`,
    `Email: ${summary.customerEmail}`,
    `Phone: ${summary.customerPhone ?? "N/A"}`,
    `Price: ${summary.price}`,
    `Start Location: ${summary.startLocation}`,
    `End Location: ${summary.endLocation}`,
    `Pickup Time: ${summary.pickupTime}`,
    `Estimated Distance: ${summary.estimatedDistance}`,
    `Estimated Duration: ${summary.estimatedDuration}`,
    `Passengers: ${summary.passengers}`,
    "",
    "Raw Submission:",
    rawBody,
  ];

  return {
    from: env.CUSTOMER_FROM_EMAIL,
    to: env.OWNER_EMAIL,
    subject,
    html,
    text: textLines.join("\n"),
    tags: ["owner", "phase2"],
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
  };

  logVerbose(verbose, "resend sending", {
    to: payload.to,
    from: payload.from,
    subject: payload.subject,
    tags: tagObjects ?? [],
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

  logVerbose(verbose, "resend success", {});

  return (await response.json()) as ResendResult;
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
  const payload = { ...data, message: `[webhook] ${message}` };
  if (level === "warn") {
    console.warn(payload);
  } else {
    console.log(payload);
  }
}

export { summarizeBody, escapeHtml };
export type { Env, EmailPayload };
