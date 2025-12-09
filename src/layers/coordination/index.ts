/**
 * Coordination Layer - Google Sheets Integration
 *
 * Handles:
 * - Booking data persistence to Google Sheets
 * - Transaction ID generation (UUID)
 * - Google Maps URL construction
 * - Status updates for accept/deny workflow
 * - Audit trail logging
 */

import { GoogleSheetsClient } from "../../integrations/googleSheets";
import { SecurityResult, BookingPayload } from "../security";

const DEFAULT_STATUS = "Pending Review";

// Column indices for Google Sheets (0-indexed)
const COLUMNS = {
  TRANSACTION_ID: 0,    // A
  IDEMPOTENCY_KEY: 1,   // B
  SUBMITTED_AT: 2,      // C
  CUSTOMER_NAME: 3,     // D
  CUSTOMER_EMAIL: 4,    // E
  CUSTOMER_PHONE: 5,    // F
  START_LOCATION: 6,    // G
  END_LOCATION: 7,      // H
  PICKUP_DATETIME: 8,   // I
  ESTIMATED_DISTANCE: 9, // J
  ESTIMATED_DURATION: 10, // K
  PASSENGERS: 11,       // L
  NOTES: 12,            // M
  DRIVER_NAME: 13,      // N
  DRIVER_EMAIL: 14,     // O
  DRIVER_PHONE: 15,     // P
  STATUS: 16,           // Q
  MAP_URL: 17,          // R
  RAW_PAYLOAD: 18,      // S
} as const;

const logger = {
  info: (event: string, data?: Record<string, unknown>) =>
    console.log(JSON.stringify({ level: 'INFO', event, ...data, timestamp: new Date().toISOString() })),
  warn: (event: string, data?: Record<string, unknown>) =>
    console.warn(JSON.stringify({ level: 'WARN', event, ...data, timestamp: new Date().toISOString() })),
  error: (event: string, data?: Record<string, unknown>) =>
    console.error(JSON.stringify({ level: 'ERROR', event, ...data, timestamp: new Date().toISOString() })),
};

export interface CoordinationEnv {
  GOOGLE_SERVICE_ACCOUNT: string;
  GOOGLE_SHEET_ID_PRIMARY: string;
  GOOGLE_SHEET_ID_BACKUP?: string;
  GOOGLE_SHEET_RANGE_PRIMARY?: string;
  GOOGLE_SHEET_RANGE_BACKUP?: string;
  GOOGLE_SHEET_ID_AUDIT?: string;
  GOOGLE_SHEET_RANGE_AUDIT?: string;
  DRIVER_CONTACT_NAME?: string;
  DRIVER_CONTACT_EMAIL?: string;
  DRIVER_CONTACT_PHONE?: string;
  SHEETS_MAX_RETRIES?: string;
  SHEETS_RETRY_DELAY_MS?: string;
  SHEETS_VERIFY_WRITES?: string;
}

export interface SubmissionSummary {
  transactionId: string;
  idempotencyKey: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  startLocation: string;
  endLocation: string;
  pickupDatetime: string;
  estimatedDistance: string;
  estimatedDuration: string;
  passengers: number;
  submittedAt: string;
  notes: string | null;
  mapUrl: string;
}

export interface CoordinationResult {
  summary: SubmissionSummary;
  rowNumber: number;
}

/**
 * Handle a new booking submission
 */
export async function handleSubmission(
  securityResult: SecurityResult,
  env: CoordinationEnv,
  receivedAt: string
): Promise<CoordinationResult> {
  const operationId = generateOperationId();

  logger.info('coordination.submission.start', {
    operationId,
    customerEmail: securityResult.customerEmail,
    idempotencyKey: securityResult.idempotencyKey.slice(0, 12),
  });

  // Validate environment
  if (!env.GOOGLE_SHEET_ID_PRIMARY) {
    logger.error('coordination.config_error', { operationId, error: 'Missing GOOGLE_SHEET_ID_PRIMARY' });
    throw new Response("Server configuration error", { status: 500 });
  }

  if (!env.GOOGLE_SERVICE_ACCOUNT) {
    logger.error('coordination.config_error', { operationId, error: 'Missing GOOGLE_SERVICE_ACCOUNT' });
    throw new Response("Server configuration error", { status: 500 });
  }

  // Build submission summary
  const payload = securityResult.payload;
  const transactionId = generateTransactionId();
  const mapUrl = buildGoogleMapsUrl(payload.start_location, payload.end_location);

  const summary: SubmissionSummary = {
    transactionId,
    idempotencyKey: securityResult.idempotencyKey,
    customerName: payload.customer_name,
    customerEmail: payload.customer_email,
    customerPhone: payload.customer_phone ?? null,
    startLocation: payload.start_location,
    endLocation: payload.end_location,
    pickupDatetime: payload.pickup_datetime,
    estimatedDistance: payload.estimated_distance,
    estimatedDuration: payload.estimated_duration,
    passengers: typeof payload.passengers === 'number' ? payload.passengers : parseInt(String(payload.passengers), 10),
    submittedAt: receivedAt,
    notes: payload.notes ?? null,
    mapUrl,
  };

  // Create Google Sheets client with retry configuration
  const sheetsClient = new GoogleSheetsClient({
    credentialsJson: env.GOOGLE_SERVICE_ACCOUNT,
    maxRetries: parseEnvNumber(env.SHEETS_MAX_RETRIES, 3),
    retryDelayMs: parseEnvNumber(env.SHEETS_RETRY_DELAY_MS, 1000),
    verifyWrites: env.SHEETS_VERIFY_WRITES !== 'false',
  });

  // Build the row data
  const submissionRow = buildSubmissionRow({
    summary,
    rawPayload: JSON.stringify(payload),
    driverContact: {
      name: env.DRIVER_CONTACT_NAME ?? "",
      email: env.DRIVER_CONTACT_EMAIL ?? "",
      phone: env.DRIVER_CONTACT_PHONE ?? "",
    },
  });

  // Write to primary sheet
  const primaryRange = env.GOOGLE_SHEET_RANGE_PRIMARY ?? "Sheet1!A:Z";
  const appendResult = await sheetsClient.appendRow({
    sheetId: env.GOOGLE_SHEET_ID_PRIMARY,
    range: primaryRange,
    values: submissionRow,
  });

  logger.info('coordination.primary_write.success', {
    operationId,
    transactionId: transactionId.slice(0, 12),
    rowNumber: appendResult.rowNumber,
  });

  // Write to backup sheet (fire-and-forget, don't block on failure)
  if (env.GOOGLE_SHEET_ID_BACKUP) {
    const backupRange = env.GOOGLE_SHEET_RANGE_BACKUP ?? "Sheet1!A:Z";
    sheetsClient.appendRow({
      sheetId: env.GOOGLE_SHEET_ID_BACKUP,
      range: backupRange,
      values: submissionRow,
    }).catch(error => {
      logger.warn('coordination.backup_write.failed', {
        operationId,
        transactionId: transactionId.slice(0, 12),
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  // Write audit entry (fire-and-forget)
  const auditSheetId = env.GOOGLE_SHEET_ID_AUDIT ?? env.GOOGLE_SHEET_ID_BACKUP;
  if (auditSheetId) {
    const auditRange = env.GOOGLE_SHEET_RANGE_AUDIT ?? "Sheet1!A:Z";
    sheetsClient.appendAuditEntry({
      sheetId: auditSheetId,
      range: auditRange,
      values: [
        transactionId,
        "submission_received",
        receivedAt,
        payload.customer_email,
        JSON.stringify({
          idempotencyKey: securityResult.idempotencyKey,
          route: `${payload.start_location} → ${payload.end_location}`,
        }),
      ],
    });
  }

  logger.info('coordination.submission.complete', {
    operationId,
    transactionId: transactionId.slice(0, 12),
    customerName: summary.customerName,
    route: `${summary.startLocation} → ${summary.endLocation}`,
  });

  return {
    summary,
    rowNumber: appendResult.rowNumber,
  };
}

/**
 * Build the row data for Google Sheets
 */
interface SubmissionRowInput {
  summary: SubmissionSummary;
  rawPayload: string;
  driverContact: {
    name: string;
    email: string;
    phone: string;
  };
}

function buildSubmissionRow({
  summary,
  rawPayload,
  driverContact,
}: SubmissionRowInput): (string | number | null)[] {
  return [
    summary.transactionId,              // Column A - Transaction ID
    summary.idempotencyKey,             // Column B - Idempotency Key
    summary.submittedAt,                // Column C - Submitted At
    summary.customerName,               // Column D - Customer Name
    summary.customerEmail,              // Column E - Customer Email
    sanitizeForSheet(summary.customerPhone), // Column F - Customer Phone
    summary.startLocation,              // Column G - Start Location
    summary.endLocation,                // Column H - End Location
    summary.pickupDatetime,             // Column I - Pickup DateTime
    summary.estimatedDistance,          // Column J - Estimated Distance
    summary.estimatedDuration,          // Column K - Estimated Duration
    summary.passengers,                 // Column L - Passengers
    summary.notes ?? "",                // Column M - Notes
    driverContact.name,                 // Column N - Driver Name
    driverContact.email,                // Column O - Driver Email
    sanitizeForSheet(driverContact.phone), // Column P - Driver Phone
    DEFAULT_STATUS,                     // Column Q - Status
    summary.mapUrl,                     // Column R - Google Maps URL
    rawPayload,                         // Column S - Raw Payload (JSON)
  ];
}

/**
 * Sanitize a value for safe insertion into Google Sheets
 * Prevents formula injection attacks
 */
function sanitizeForSheet(value: string | null): string {
  if (value == null) {
    return "";
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  // Prefix with single quote if starts with a formula character
  // but contains non-numeric content (to prevent formula injection)
  const startsWithRiskyChar = /^[=+@-]/.test(trimmed);
  const containsNonNumeric = /[^0-9.+-]/.test(trimmed.slice(1));

  if (startsWithRiskyChar && containsNonNumeric) {
    return `'${trimmed}`;
  }

  return trimmed;
}

/**
 * Generate a unique transaction ID (UUID v4)
 */
function generateTransactionId(): string {
  return crypto.randomUUID();
}

/**
 * Build a Google Maps directions URL
 */
function buildGoogleMapsUrl(start: string, end: string): string {
  const params = new URLSearchParams({
    api: '1',
    origin: start,
    destination: end,
    travelmode: 'driving',
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/**
 * Check and update booking status (for accept/deny workflow)
 */
export interface BookingStatusResult {
  currentStatus: string | null;
  rowIndex: number | null;
  updated: boolean;
}

interface BookingStatusOptions {
  metadata?: string;
}

export async function checkAndUpdateBookingStatus(
  transactionId: string,
  newStatus: 'Accepted' | 'Denied',
  env: CoordinationEnv,
  options: BookingStatusOptions = {}
): Promise<BookingStatusResult> {
  const operationId = generateOperationId();

  logger.info('coordination.status_update.start', {
    operationId,
    transactionId: transactionId.slice(0, 12),
    newStatus,
  });

  if (!env.GOOGLE_SHEET_ID_PRIMARY) {
    throw new Error("Missing GOOGLE_SHEET_ID_PRIMARY");
  }

  if (!env.GOOGLE_SERVICE_ACCOUNT) {
    throw new Error("Missing GOOGLE_SERVICE_ACCOUNT secret");
  }

  const sheetsClient = new GoogleSheetsClient({
    credentialsJson: env.GOOGLE_SERVICE_ACCOUNT,
    maxRetries: parseEnvNumber(env.SHEETS_MAX_RETRIES, 3),
    retryDelayMs: parseEnvNumber(env.SHEETS_RETRY_DELAY_MS, 1000),
  });

  const primaryRange = env.GOOGLE_SHEET_RANGE_PRIMARY ?? "Sheet1!A:Z";

  // Read all rows to find the matching transaction ID
  const rows = await sheetsClient.readRange({
    sheetId: env.GOOGLE_SHEET_ID_PRIMARY,
    range: primaryRange,
  });

  // Find the row with matching transaction ID (column A, index 0)
  let targetRowIndex = -1;
  let currentStatus: string | null = null;

  for (let i = 0; i < rows.length; i++) {
    if (rows[i][COLUMNS.TRANSACTION_ID] === transactionId) {
      targetRowIndex = i;
      // Status is in column Q (index 16) based on new buildSubmissionRow
      currentStatus = rows[i][COLUMNS.STATUS] as string || DEFAULT_STATUS;
      break;
    }
  }

  if (targetRowIndex === -1) {
    logger.warn('coordination.status_update.not_found', {
      operationId,
      transactionId: transactionId.slice(0, 12),
    });
    throw new Error(`Transaction ID ${transactionId} not found in sheets`);
  }

  // Check if already processed
  if (currentStatus && currentStatus !== DEFAULT_STATUS) {
    logger.info('coordination.status_update.already_processed', {
      operationId,
      transactionId: transactionId.slice(0, 12),
      currentStatus,
    });
    return {
      currentStatus,
      rowIndex: targetRowIndex + 1,
      updated: false,
    };
  }

  // Update the status in the specific cell (Column Q)
  const statusRange = `Sheet1!Q${targetRowIndex + 1}:Q${targetRowIndex + 1}`;
  await sheetsClient.updateRange({
    sheetId: env.GOOGLE_SHEET_ID_PRIMARY,
    range: statusRange,
    values: [[newStatus]],
  });

  logger.info('coordination.status_update.success', {
    operationId,
    transactionId: transactionId.slice(0, 12),
    newStatus,
    rowIndex: targetRowIndex + 1,
  });

  // Also update backup sheet if configured (fire-and-forget)
  if (env.GOOGLE_SHEET_ID_BACKUP) {
    updateBackupSheetStatus(sheetsClient, env, transactionId, newStatus, operationId);
  }

  // Add audit entry (fire-and-forget)
  const auditSheetId = env.GOOGLE_SHEET_ID_AUDIT ?? env.GOOGLE_SHEET_ID_BACKUP;
  if (auditSheetId) {
    const auditRange = env.GOOGLE_SHEET_RANGE_AUDIT ?? "Sheet1!A:Z";
    sheetsClient.appendAuditEntry({
      sheetId: auditSheetId,
      range: auditRange,
      values: [
        transactionId,
        `status_updated_to_${newStatus.toLowerCase()}`,
        new Date().toISOString(),
        options.metadata ?? '',
      ],
    });
  }

  return {
    currentStatus: newStatus,
    rowIndex: targetRowIndex + 1,
    updated: true,
  };
}

/**
 * Update status in backup sheet (async, doesn't block main flow)
 */
async function updateBackupSheetStatus(
  sheetsClient: GoogleSheetsClient,
  env: CoordinationEnv,
  transactionId: string,
  newStatus: string,
  operationId: string
): Promise<void> {
  try {
    const backupRange = env.GOOGLE_SHEET_RANGE_BACKUP ?? "Sheet1!A:Z";
    const backupRows = await sheetsClient.readRange({
      sheetId: env.GOOGLE_SHEET_ID_BACKUP!,
      range: backupRange,
    });

    for (let i = 0; i < backupRows.length; i++) {
      if (backupRows[i][COLUMNS.TRANSACTION_ID] === transactionId) {
        const backupStatusRange = `Sheet1!Q${i + 1}:Q${i + 1}`;
        await sheetsClient.updateRange({
          sheetId: env.GOOGLE_SHEET_ID_BACKUP!,
          range: backupStatusRange,
          values: [[newStatus]],
        });
        break;
      }
    }
  } catch (error) {
    logger.warn('coordination.backup_status_update.failed', {
      operationId,
      transactionId: transactionId.slice(0, 12),
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Fetch booking details by transaction ID
 */
export async function fetchBookingDetails(
  transactionId: string,
  env: CoordinationEnv
): Promise<SubmissionSummary | null> {
  if (!env.GOOGLE_SHEET_ID_PRIMARY || !env.GOOGLE_SERVICE_ACCOUNT) {
    throw new Error("Missing Google Sheets configuration");
  }

  const sheetsClient = new GoogleSheetsClient({
    credentialsJson: env.GOOGLE_SERVICE_ACCOUNT,
  });

  const primaryRange = env.GOOGLE_SHEET_RANGE_PRIMARY ?? "Sheet1!A:Z";
  const rows = await sheetsClient.readRange({
    sheetId: env.GOOGLE_SHEET_ID_PRIMARY,
    range: primaryRange,
  });

  for (const row of rows) {
    if (row[COLUMNS.TRANSACTION_ID] === transactionId) {
      return {
        transactionId: String(row[COLUMNS.TRANSACTION_ID] ?? ''),
        idempotencyKey: String(row[COLUMNS.IDEMPOTENCY_KEY] ?? ''),
        customerName: String(row[COLUMNS.CUSTOMER_NAME] ?? ''),
        customerEmail: String(row[COLUMNS.CUSTOMER_EMAIL] ?? ''),
        customerPhone: row[COLUMNS.CUSTOMER_PHONE] ? String(row[COLUMNS.CUSTOMER_PHONE]) : null,
        startLocation: String(row[COLUMNS.START_LOCATION] ?? ''),
        endLocation: String(row[COLUMNS.END_LOCATION] ?? ''),
        pickupDatetime: String(row[COLUMNS.PICKUP_DATETIME] ?? ''),
        estimatedDistance: String(row[COLUMNS.ESTIMATED_DISTANCE] ?? ''),
        estimatedDuration: String(row[COLUMNS.ESTIMATED_DURATION] ?? ''),
        passengers: parseInt(String(row[COLUMNS.PASSENGERS] ?? '1'), 10) || 1,
        submittedAt: String(row[COLUMNS.SUBMITTED_AT] ?? ''),
        notes: row[COLUMNS.NOTES] ? String(row[COLUMNS.NOTES]) : null,
        mapUrl: String(row[COLUMNS.MAP_URL] ?? ''),
      };
    }
  }

  return null;
}

// Helper functions

function parseEnvNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function generateOperationId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// Re-export types
export type { BookingPayload } from "../security";
