import bookingFlow from "../../../flows/booking.json" assert { type: "json" };
import { GoogleSheetsClient } from "../../integrations/googleSheets";
import { SecurityResult } from "../security";
import { computeTransactionId } from "./transaction";

type RequiredField = string | string[];

interface BookingFlowConfig {
  requiredFields: RequiredField[];
}

const bookingConfig = bookingFlow as BookingFlowConfig;
const DEFAULT_STATUS = "Pending Review";

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
  DECISION_MIN_AGE_MS?: string;
}

export interface SubmissionSummary {
  transactionId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  price: string;
  startLocation: string;
  endLocation: string;
  pickupTime: string;
  estimatedDistance: string;
  estimatedDuration: string;
  passengers: string;
  submittedAt: string;
  vehicleType: string | null;
  notes: string | null;
  mapUrl: string | null;
}

export interface CoordinationResult {
  summary: SubmissionSummary;
  submissionRow: (string | number | null)[];
}

export async function handleSubmission(
  securityResult: SecurityResult<Record<string, unknown>>,
  env: CoordinationEnv,
  receivedAt: string
): Promise<CoordinationResult> {
  const primarySheetId = env.GOOGLE_SHEET_ID_PRIMARY;
  if (!primarySheetId) {
    throw new Response("Missing GOOGLE_SHEET_ID_PRIMARY", { status: 500 });
  }

  if (!env.GOOGLE_SERVICE_ACCOUNT) {
    throw new Response("Missing GOOGLE_SERVICE_ACCOUNT secret", { status: 500 });
  }

  const payload = securityResult.body;
  const summary = await buildSubmissionSummary(payload, securityResult.customerEmail, receivedAt);

  const sheetsClient = new GoogleSheetsClient({
    credentialsJson: env.GOOGLE_SERVICE_ACCOUNT,
  });

  const primaryRange = env.GOOGLE_SHEET_RANGE_PRIMARY ?? "Sheet1!A:Z";
  const backupRange = env.GOOGLE_SHEET_RANGE_BACKUP ?? "Sheet1!A:Z";
  const auditRange = env.GOOGLE_SHEET_RANGE_AUDIT ?? "Audit!A:Z";
  const backupSheetId = env.GOOGLE_SHEET_ID_BACKUP;
  const auditSheetId = env.GOOGLE_SHEET_ID_AUDIT ?? backupSheetId;

  const submissionRow = buildSubmissionRow({
    summary,
    rawBody: securityResult.rawBody,
    submissionId: securityResult.submissionId,
    driverContact: {
      name: env.DRIVER_CONTACT_NAME ?? "",
      email: env.DRIVER_CONTACT_EMAIL ?? "",
      phone: env.DRIVER_CONTACT_PHONE ?? "",
    },
  });

  await sheetsClient.appendRow({
    sheetId: primarySheetId,
    range: primaryRange,
    values: submissionRow,
  });

  if (backupSheetId) {
    await sheetsClient.appendRow({
      sheetId: backupSheetId,
      range: backupRange,
      values: submissionRow,
    });
  }

  if (auditSheetId) {
    await sheetsClient.appendAuditEntry({
      sheetId: auditSheetId,
      range: auditRange,
      values: [
        summary.transactionId,
        "submission_received",
        summary.submittedAt,
        summary.customerEmail,
      ],
    });
  }

  return {
    summary,
    submissionRow,
  };
}

async function buildSubmissionSummary(
  payload: Record<string, unknown>,
  customerEmail: string,
  submittedAt: string
): Promise<SubmissionSummary> {
  ensureRequiredFields(payload);

  const customerName = requireField(payload, ["customer_name", "name"]);
  const startLocation = requireField(payload, ["start_location", "start", "from"]);
  const endLocation = requireField(payload, ["end_location", "end", "to"]);
  const pickupTime = requireField(payload, ["pickup_time", "pickupTime"]);
  const estimatedDistance = requireField(payload, ["estimated_distance", "distance"]);
  const estimatedDuration = requireField(payload, ["estimated_duration", "duration"]);
  const price = optionalField(payload, ["price", "estimated_price"]) ?? "TBD";
  const passengers = requireField(payload, ["passengers", "passenger_count"]);
  const phone = optionalField(payload, ["phone", "phone_number", "contact_phone"]);
  const vehicleType = optionalField(payload, ["vehicle_type", "vehicleType"]);
  const notes = optionalField(payload, ["notes", "customer_notes", "additional_notes", "special_requests", "message"]);
  const mapUrl = optionalField(payload, ["map_url", "mapUrl"]);

  const transactionId = await computeTransactionId({
    customerName,
    startLocation,
    endLocation,
    pickupTime,
    submittedAt,
    customerEmail,
  });

  return {
    transactionId,
    customerName,
    customerEmail,
    customerPhone: phone,
    price,
    startLocation,
    endLocation,
    pickupTime,
    estimatedDistance,
    estimatedDuration,
    passengers,
    submittedAt,
    vehicleType,
    notes,
    mapUrl,
  };
}

interface SubmissionRowInput {
  summary: SubmissionSummary;
  rawBody: string;
  submissionId: string;
  driverContact: {
    name: string;
    email: string;
    phone: string;
  };
}

function buildSubmissionRow({
  summary,
  rawBody,
  submissionId,
  driverContact,
}: SubmissionRowInput): (string | number | null)[] {
  return [
    summary.transactionId,        // Column A (0)
    submissionId,                 // Column B (1)
    summary.submittedAt,          // Column C (2)
    summary.customerName,         // Column D (3)
    summary.customerEmail,        // Column E (4)
    sanitizeForSheet(summary.customerPhone), // Column F (5)
    summary.startLocation,        // Column G (6)
    summary.endLocation,          // Column H (7)
    summary.pickupTime,           // Column I (8)
    summary.estimatedDistance,    // Column J (9)
    summary.estimatedDuration,    // Column K (10)
    summary.passengers,           // Column L (11)
    summary.price,                // Column M (12)
    summary.vehicleType ?? "",    // Column N (13)
    summary.notes ?? "",          // Column O (14)
    driverContact.name,           // Column P (15)
    driverContact.email,          // Column Q (16)
    sanitizeForSheet(driverContact.phone), // Column R (17)
    DEFAULT_STATUS,               // Column S (18)
    rawBody,                      // Column T (19)
    summary.mapUrl ?? "",         // Column U (20) - Google Maps URL
  ];
}

function ensureRequiredFields(payload: Record<string, unknown>): void {
  for (const field of bookingConfig.requiredFields ?? []) {
    if (Array.isArray(field)) {
      // Some Framer forms rename core fields (e.g. `customer_email` vs
      // `email`). A field array means "at least one of these keys must be
      // present" so we can tolerate those variations without rewriting the
      // JSON config per form.
      if (field.some((key) => hasValue(payload, key))) {
        continue;
      }
      throw new Response(`Missing required field: ${field[0]}`, { status: 400 });
    }

    if (!hasValue(payload, field)) {
      throw new Response(`Missing required field: ${field}`, { status: 400 });
    }
  }
}

function sanitizeForSheet(value: string | null): string {
  if (value == null) {
    return "";
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const startsWithRiskyChar = /^[=+@-]/.test(trimmed);
  const containsNonNumeric = /[^0-9.]/.test(trimmed.slice(1));

  if (startsWithRiskyChar && containsNonNumeric) {
    return `'${trimmed}`;
  }

  return trimmed;
}

function requireField(payload: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number") {
      return value.toString();
    }
  }

  throw new Response(`Missing required field: ${keys[0]}`, { status: 400 });
}

function optionalField(payload: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number") {
      return value.toString();
    }
  }

  return null;
}

function hasValue(payload: Record<string, unknown>, key: string): boolean {
  const value = payload[key];
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  return value !== undefined && value !== null;
}

export interface BookingStatusResult {
  currentStatus: string | null;
  rowIndex: number | null;
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
  let targetRowIndex = -1;
  let currentStatus: string | null = null;

  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === transactionId) {
      targetRowIndex = i;
      // Status is in column S (index 18) based on buildSubmissionRow
      currentStatus = rows[i][18] as string || DEFAULT_STATUS;
      break;
    }
  }

  if (targetRowIndex === -1) {
    throw new Error(`Transaction ID ${transactionId} not found in sheets`);
  }

  // Check if already processed
  if (currentStatus && currentStatus !== DEFAULT_STATUS) {
    // Return the existing status without updating
    return {
      currentStatus,
      rowIndex: targetRowIndex + 1, // Convert to 1-indexed for Google Sheets
    };
  }

  // Update the status in the specific cell (Column S)
  const statusRange = `Sheet1!S${targetRowIndex + 1}:S${targetRowIndex + 1}`;
  await sheetsClient.updateRange({
    sheetId: primarySheetId,
    range: statusRange,
    values: [[newStatus]],
  });

  // Also update backup sheet if configured
  const backupSheetId = env.GOOGLE_SHEET_ID_BACKUP;
  if (backupSheetId) {
    const backupRange = env.GOOGLE_SHEET_RANGE_BACKUP ?? "Sheet1!A:Z";
    const backupRows = await sheetsClient.readRange({
      sheetId: backupSheetId,
      range: backupRange,
    });

    for (let i = 0; i < backupRows.length; i++) {
      if (backupRows[i][0] === transactionId) {
        const backupStatusRange = `Sheet1!S${i + 1}:S${i + 1}`;
        await sheetsClient.updateRange({
          sheetId: backupSheetId,
          range: backupStatusRange,
          values: [[newStatus]],
        });
        break;
      }
    }
  }

  // Add audit entry
  const auditSheetId = env.GOOGLE_SHEET_ID_AUDIT ?? env.GOOGLE_SHEET_ID_BACKUP;
  if (auditSheetId) {
    const auditRange = env.GOOGLE_SHEET_RANGE_AUDIT ?? "Audit!A:Z";
    const metadata = options.metadata ?? '';

    await sheetsClient.appendAuditEntry({
      sheetId: auditSheetId,
      range: auditRange,
      values: [
        transactionId,
        `status_updated_to_${newStatus.toLowerCase()}`,
        new Date().toISOString(),
        metadata,
      ],
    });
  }

  return {
    currentStatus: newStatus,
    rowIndex: targetRowIndex + 1,
  };
}
