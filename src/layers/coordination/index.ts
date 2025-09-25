import bookingFlow from "../../../flows/booking.json" assert { type: "json" };
import { GoogleSheetsClient } from "../../integrations/googleSheets";
import { SecurityResult } from "../security";
import { computeTransactionId } from "./transaction";

interface BookingFlowConfig {
  requiredFields: string[];
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
  const price = requireField(payload, ["price", "estimated_price"]);
  const passengers = requireField(payload, ["passengers", "passenger_count"]);
  const phone = optionalField(payload, ["phone", "phone_number", "contact_phone"]);
  const vehicleType = optionalField(payload, ["vehicle_type", "vehicleType"]);
  const notes = optionalField(payload, ["notes", "customer_notes", "additional_notes", "special_requests", "message"]);

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
    summary.transactionId,
    submissionId,
    summary.submittedAt,
    summary.customerName,
    summary.customerEmail,
    sanitizeForSheet(summary.customerPhone),
    summary.startLocation,
    summary.endLocation,
    summary.pickupTime,
    summary.estimatedDistance,
    summary.estimatedDuration,
    summary.passengers,
    summary.price,
    summary.vehicleType ?? "",
    summary.notes ?? "",
    driverContact.name,
    driverContact.email,
    sanitizeForSheet(driverContact.phone),
    DEFAULT_STATUS,
    rawBody,
  ];
}

function ensureRequiredFields(payload: Record<string, unknown>): void {
  for (const key of bookingConfig.requiredFields ?? []) {
    if (!hasValue(payload, key)) {
      throw new Response(`Missing required field: ${key}`, { status: 400 });
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
