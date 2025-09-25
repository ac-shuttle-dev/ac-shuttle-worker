#!/usr/bin/env node
// Helper script to replay a Framer-style webhook against the local Worker.
// It automatically loads secrets from .dev.vars so `npm run webhook:test`
// works out of the box.

import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

async function loadDevVars() {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const projectRoot = path.resolve(path.dirname(__filename), "..");
    const file = await readFile(path.join(projectRoot, ".dev.vars"), "utf8");
    const vars = {};
    for (const rawLine of file.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      vars[key] = value;
    }
    return vars;
  } catch (error) {
    if (error.code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

const fileVars = await loadDevVars();
const env = { ...fileVars, ...process.env };

const secret = env.WEBHOOK_SECRET;
if (!secret) {
  console.error("WEBHOOK_SECRET not found in environment or .dev.vars");
  process.exit(1);
}

const rawWebhookUrl = env.WEBHOOK_URL ?? "http://127.0.0.1:8787/";
const webhookUrl = normaliseUrl(rawWebhookUrl);
const submissionId = env.SUBMISSION_ID ?? `local-test-${Date.now()}`;
const payload = env.WEBHOOK_PAYLOAD ?? JSON.stringify({
  example: true,
  at: new Date().toISOString(),
});

const bodyBuffer = Buffer.from(payload);
const hmac = createHmac("sha256", secret);
hmac.update(bodyBuffer);
hmac.update(submissionId);
const signature = `sha256=${hmac.digest("hex")}`;

console.log("Invoking webhook", {
  webhookUrl,
  submissionId,
  payload,
});

try {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "framer-signature": signature,
      "framer-webhook-submission-id": submissionId,
    },
    body: bodyBuffer,
  });

  const text = await response.text();
  console.log(`status: ${response.status}`);
  console.log(`response: ${text}`);
} catch (error) {
  console.error("Failed to invoke webhook", error);
  process.exit(1);
}

function normaliseUrl(value) {
  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  return `https://${value}`;
}
