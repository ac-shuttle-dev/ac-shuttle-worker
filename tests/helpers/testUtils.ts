/**
 * Test Utilities and Fixtures
 *
 * Shared utilities for testing the AC Shuttles booking worker.
 */

import { vi, expect } from 'vitest';

// =============================================================================
// MOCK DATA FIXTURES
// =============================================================================

export const mockBookingPayload = {
  customer_name: 'John Smith',
  customer_email: 'john.smith@example.com',
  customer_phone: '609-555-0100',
  start_location: '123 Main Street, Philadelphia, PA 19103',
  end_location: 'Newark Liberty International Airport, Newark, NJ',
  pickup_datetime: '2025-02-20T14:30:00',
  passengers: 3,
  estimated_distance: '95 miles',
  estimated_duration: '1 hour 45 minutes',
  notes: 'Please call 5 minutes before arrival',
};

export const mockEnv = {
  // API Authentication
  API_KEY: 'test-api-key-12345',

  // Rate Limiter Mock
  BOOKING_RATE_LIMIT: {
    limit: vi.fn().mockResolvedValue({ success: true }),
  },

  // Resend Configuration
  RESEND_API_KEY: 'test-resend-api-key',
  CUSTOMER_FROM_EMAIL: 'contact@acshuttles.com',
  OWNER_EMAIL: 'owner@acshuttles.com',
  RESEND_DRY_RUN: 'false',

  // Worker URL
  WORKER_URL: 'https://test-worker.example.com',

  // Driver Contact Info
  DRIVER_CONTACT_NAME: 'Mike Johnson',
  DRIVER_CONTACT_EMAIL: 'driver@acshuttles.com',
  DRIVER_CONTACT_PHONE: '609-555-0199',

  // Google Sheets Configuration
  GOOGLE_SERVICE_ACCOUNT: JSON.stringify({
    client_email: 'test@test-project.iam.gserviceaccount.com',
    private_key: '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAAOCAQ8A\n-----END PRIVATE KEY-----',
  }),
  GOOGLE_SHEET_ID_PRIMARY: 'primary-sheet-id-123',
  GOOGLE_SHEET_ID_BACKUP: 'backup-sheet-id-456',
  GOOGLE_SHEET_ID_AUDIT: 'audit-sheet-id-789',
  GOOGLE_SHEET_RANGE_PRIMARY: 'Sheet1!A:Z',
  GOOGLE_SHEET_RANGE_BACKUP: 'Sheet1!A:Z',
  GOOGLE_SHEET_RANGE_AUDIT: 'Sheet1!A:Z',

  // Sheets Reliability
  SHEETS_MAX_RETRIES: '3',
  SHEETS_RETRY_DELAY_MS: '10', // Fast for tests
  SHEETS_VERIFY_WRITES: 'true',

  // Logging
  VERBOSE_LOGGING: 'false',
};

// =============================================================================
// MOCK GOOGLE SHEETS
// =============================================================================

export interface MockSheetRow {
  transactionId: string;
  idempotencyKey: string;
  submittedAt: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  startLocation: string;
  endLocation: string;
  pickupDatetime: string;
  estimatedDistance: string;
  estimatedDuration: string;
  passengers: number;
  notes: string;
  driverName: string;
  driverEmail: string;
  driverPhone: string;
  status: string;
  mapUrl: string;
  rawPayload: string;
}

export function createMockSheetRow(overrides: Partial<MockSheetRow> = {}): (string | number)[] {
  const row: MockSheetRow = {
    transactionId: 'txn-test-12345678',
    idempotencyKey: 'idem-test-key',
    submittedAt: new Date().toISOString(),
    customerName: 'John Smith',
    customerEmail: 'john.smith@example.com',
    customerPhone: '609-555-0100',
    startLocation: '123 Main Street, Philadelphia, PA 19103',
    endLocation: 'Newark Liberty International Airport, Newark, NJ',
    pickupDatetime: '2025-02-20T14:30:00',
    estimatedDistance: '95 miles',
    estimatedDuration: '1 hour 45 minutes',
    passengers: 3,
    notes: 'Test notes',
    driverName: 'Mike Johnson',
    driverEmail: 'driver@acshuttles.com',
    driverPhone: '609-555-0199',
    status: 'Pending Review',
    mapUrl: 'https://google.com/maps/dir/?api=1&origin=...',
    rawPayload: '{}',
    ...overrides,
  };

  return [
    row.transactionId,
    row.idempotencyKey,
    row.submittedAt,
    row.customerName,
    row.customerEmail,
    row.customerPhone,
    row.startLocation,
    row.endLocation,
    row.pickupDatetime,
    row.estimatedDistance,
    row.estimatedDuration,
    row.passengers,
    row.notes,
    row.driverName,
    row.driverEmail,
    row.driverPhone,
    row.status,
    row.mapUrl,
    row.rawPayload,
  ];
}

export function createMockGoogleSheetsClient(options: {
  existingRows?: (string | number)[][];
  appendRowNumber?: number;
  shouldFailAppend?: boolean;
  shouldFailRead?: boolean;
  shouldFailUpdate?: boolean;
} = {}) {
  const {
    existingRows = [],
    appendRowNumber = 5,
    shouldFailAppend = false,
    shouldFailRead = false,
    shouldFailUpdate = false,
  } = options;

  // Track writes for verification
  const appendedRows: (string | number | null)[][] = [];
  const updatedCells: { range: string; values: (string | number | null)[][] }[] = [];

  return {
    appendRow: vi.fn().mockImplementation(async ({ values }: { values: (string | number | null)[] }) => {
      if (shouldFailAppend) {
        throw new Error('Mock append failed');
      }
      appendedRows.push(values);
      return {
        success: true,
        updatedRange: `Sheet1!A${appendRowNumber}:Z${appendRowNumber}`,
        rowNumber: appendRowNumber,
      };
    }),
    appendAuditEntry: vi.fn().mockResolvedValue(undefined),
    readRange: vi.fn().mockImplementation(async () => {
      if (shouldFailRead) {
        throw new Error('Mock read failed');
      }
      // Return existing rows plus any appended rows
      return [...existingRows, ...appendedRows];
    }),
    updateRange: vi.fn().mockImplementation(async ({ range, values }: { range: string; values: (string | number | null)[][] }) => {
      if (shouldFailUpdate) {
        throw new Error('Mock update failed');
      }
      updatedCells.push({ range, values });
      return undefined;
    }),
    // Test helpers
    getAppendedRows: () => appendedRows,
    getUpdatedCells: () => updatedCells,
  };
}

// =============================================================================
// MOCK RESEND API
// =============================================================================

export interface CapturedEmail {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  tags?: { name: string; value: string }[];
  timestamp: string;
}

export function createMockResendApi(options: {
  shouldFail?: boolean;
  failOnNthCall?: number;
} = {}) {
  const { shouldFail = false, failOnNthCall } = options;
  const sentEmails: CapturedEmail[] = [];
  let callCount = 0;

  const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
    callCount++;

    // Handle Resend API calls
    if (url === 'https://api.resend.com/emails') {
      const body = JSON.parse(init?.body as string);

      // Check if this call should fail
      if (shouldFail || (failOnNthCall && callCount === failOnNthCall)) {
        return {
          ok: false,
          status: 500,
          text: async () => JSON.stringify({ error: 'Mock Resend error' }),
          json: async () => ({ error: 'Mock Resend error' }),
        };
      }

      // Capture the email
      sentEmails.push({
        from: body.from,
        to: body.to,
        subject: body.subject,
        html: body.html,
        text: body.text,
        tags: body.tags,
        timestamp: new Date().toISOString(),
      });

      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ id: `msg-${Date.now()}` }),
        json: async () => ({ id: `msg-${Date.now()}` }),
      };
    }

    // Default: pass through
    return {
      ok: true,
      status: 200,
      text: async () => '{}',
      json: async () => ({}),
    };
  });

  return {
    fetch: mockFetch,
    getSentEmails: () => sentEmails,
    getCallCount: () => callCount,
    clearEmails: () => {
      sentEmails.length = 0;
      callCount = 0;
    },
  };
}

// =============================================================================
// REQUEST BUILDERS
// =============================================================================

export function createBookingRequest(
  payload: Record<string, unknown> = mockBookingPayload,
  apiKey: string = mockEnv.API_KEY
): Request {
  return new Request('https://test-worker.example.com/booking', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify(payload),
  });
}

export function createAcceptRequest(transactionId: string): Request {
  return new Request(`https://test-worker.example.com/accept/${transactionId}`, {
    method: 'GET',
  });
}

export function createDenyRequest(transactionId: string): Request {
  return new Request(`https://test-worker.example.com/deny/${transactionId}`, {
    method: 'GET',
  });
}

export function createHealthRequest(): Request {
  return new Request('https://test-worker.example.com/health', {
    method: 'GET',
  });
}

// =============================================================================
// RESPONSE VALIDATORS
// =============================================================================

export async function expectSuccessResponse(response: Response): Promise<{
  transactionId: string;
  receivedAt: string;
  dryRun: boolean;
}> {
  expect(response.status).toBe(200);
  const body = await response.json() as { ok: boolean; transactionId: string; receivedAt: string; dryRun: boolean };
  expect(body.ok).toBe(true);
  expect(body.transactionId).toBeDefined();
  expect(body.transactionId.length).toBe(36); // UUID format
  expect(body.receivedAt).toBeDefined();
  return body;
}

export async function expectErrorResponse(
  response: Response,
  expectedStatus: number,
  expectedError?: string
): Promise<{ ok: boolean; error: string; details?: unknown }> {
  expect(response.status).toBe(expectedStatus);
  const body = await response.json() as { ok: boolean; error: string; details?: unknown };
  expect(body.ok).toBe(false);
  if (expectedError) {
    expect(body.error).toContain(expectedError);
  }
  return body;
}

export async function expectHtmlResponse(response: Response, expectedStatus: number = 200): Promise<string> {
  expect(response.status).toBe(expectedStatus);
  expect(response.headers.get('Content-Type')).toBe('text/html');
  return await response.text();
}

// =============================================================================
// EMAIL VALIDATORS
// =============================================================================

export function validateOwnerNotificationEmail(email: CapturedEmail, booking: typeof mockBookingPayload) {
  expect(email.to).toBe(mockEnv.OWNER_EMAIL);
  expect(email.subject).toContain('New Booking');
  expect(email.subject).toContain(booking.customer_name);
  expect(email.html).toContain(booking.customer_name);
  expect(email.html).toContain(booking.customer_email);
  // Check for action buttons (Accept and Decline)
  expect(email.html).toContain('Accept');
  expect(email.html).toContain('Decline');
  // Check for action URLs
  expect(email.html).toContain('/accept/');
  expect(email.html).toContain('/deny/');
}

export function validateCustomerAckEmail(email: CapturedEmail, booking: typeof mockBookingPayload) {
  expect(email.to).toBe(booking.customer_email);
  expect(email.subject).toContain('received');
  expect(email.html).toContain(booking.customer_name);
  expect(email.html).toContain('Reference');
}

export function validateCustomerConfirmationEmail(email: CapturedEmail, booking: typeof mockBookingPayload) {
  expect(email.to).toBe(booking.customer_email);
  expect(email.subject).toContain('Confirmed');
  expect(email.html).toContain(booking.customer_name);
  expect(email.html).toContain(mockEnv.DRIVER_CONTACT_NAME);
  expect(email.html).toContain(mockEnv.DRIVER_CONTACT_PHONE);
}

export function validateCustomerDenialEmail(email: CapturedEmail, booking: typeof mockBookingPayload) {
  expect(email.to).toBe(booking.customer_email);
  expect(email.subject).toContain('Update');
  expect(email.html).toContain(booking.customer_name);
  expect(email.html).toContain("We're sorry");
}

export function validateCustomerReminderEmail(email: CapturedEmail, booking: typeof mockBookingPayload) {
  expect(email.to).toBe(booking.customer_email);
  expect(email.subject).toContain('Reminder');
  expect(email.html).toContain(booking.customer_name);
  expect(email.html).toContain('coming up');
}
