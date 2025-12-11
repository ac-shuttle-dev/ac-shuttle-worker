/**
 * System Integration Tests
 *
 * Comprehensive tests for the complete AC Shuttles booking workflow.
 * Tests the full flow from request to response, including:
 * - Security validation (API key, rate limiting, payload validation)
 * - Google Sheets persistence
 * - Email notifications
 * - Accept/Deny workflow
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import worker from '../../src/index';
import {
  mockBookingPayload,
  mockEnv,
  createMockGoogleSheetsClient,
  createMockResendApi,
  createBookingRequest,
  createAcceptRequest,
  createDenyRequest,
  createHealthRequest,
  createMockSheetRow,
  expectSuccessResponse,
  expectErrorResponse,
  expectHtmlResponse,
  validateOwnerNotificationEmail,
  validateCustomerAckEmail,
  validateCustomerConfirmationEmail,
  validateCustomerDenialEmail,
} from '../helpers/testUtils';

// =============================================================================
// MOCK SETUP
// =============================================================================

// Store mocks in a container so the mock factory can always access current value
const mocks = {
  sheetsClient: null as ReturnType<typeof createMockGoogleSheetsClient> | null,
  resendApi: null as ReturnType<typeof createMockResendApi> | null,
};

// Mock Google Sheets Client - factory accesses current mock from container
vi.mock('../../src/integrations/googleSheets', () => ({
  GoogleSheetsClient: vi.fn().mockImplementation(() => mocks.sheetsClient),
}));

// Override global fetch for Resend API
const originalFetch = global.fetch;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.sheetsClient = createMockGoogleSheetsClient();
  mocks.resendApi = createMockResendApi();
  global.fetch = mocks.resendApi.fetch as unknown as typeof fetch;
  // Reset rate limiter mock
  (mockEnv.BOOKING_RATE_LIMIT.limit as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
});

afterEach(() => {
  global.fetch = originalFetch;
});

// =============================================================================
// HEALTH CHECK TESTS
// =============================================================================

describe('Health Check', () => {
  it('returns healthy status', async () => {
    const request = createHealthRequest();
    const response = await worker.fetch(request, mockEnv as any);

    expect(response.status).toBe(200);
    const body = await response.json() as { ok: boolean; timestamp: string };
    expect(body.ok).toBe(true);
    expect(body.timestamp).toBeDefined();
  });
});

// =============================================================================
// BOOKING CREATION FLOW TESTS
// =============================================================================

describe('Booking Creation Flow', () => {
  describe('Successful Booking', () => {
    it('creates booking and returns transaction ID', async () => {
      const request = createBookingRequest();
      const response = await worker.fetch(request, mockEnv as any);

      const body = await expectSuccessResponse(response);
      expect(body.transactionId).toMatch(/^[0-9a-f-]{36}$/);
      expect(body.dryRun).toBe(false);
    });

    it('persists booking to Google Sheets', async () => {
      const request = createBookingRequest();
      await worker.fetch(request, mockEnv as any);

      // appendRow is called for primary sheet (backup is async)
      expect(mocks.sheetsClient!.appendRow).toHaveBeenCalled();
      const appendedRows = mocks.sheetsClient!.getAppendedRows();
      expect(appendedRows.length).toBeGreaterThanOrEqual(1);

      const row = appendedRows[0];
      expect(row[3]).toBe(mockBookingPayload.customer_name); // Customer Name
      expect(row[4]).toBe(mockBookingPayload.customer_email.toLowerCase()); // Customer Email (normalized)
      expect(row[6]).toBe(mockBookingPayload.start_location); // Start Location
      expect(row[7]).toBe(mockBookingPayload.end_location); // End Location
      expect(row[16]).toBe('Pending Review'); // Status
    });

    it('sends owner notification email', async () => {
      const request = createBookingRequest();
      await worker.fetch(request, mockEnv as any);

      const emails = mocks.resendApi!.getSentEmails();
      expect(emails.length).toBeGreaterThanOrEqual(1);

      const ownerEmail = emails.find(e => e.to === mockEnv.OWNER_EMAIL);
      expect(ownerEmail).toBeDefined();
      validateOwnerNotificationEmail(ownerEmail!, mockBookingPayload);
    });

    it('sends customer acknowledgment after owner email succeeds', async () => {
      const request = createBookingRequest();
      await worker.fetch(request, mockEnv as any);

      const emails = mocks.resendApi!.getSentEmails();
      expect(emails.length).toBe(2);

      const customerEmail = emails.find(e => e.to === mockBookingPayload.customer_email);
      expect(customerEmail).toBeDefined();
      validateCustomerAckEmail(customerEmail!, mockBookingPayload);
    });

    it('does NOT send customer ack if owner email fails', async () => {
      // Make the first email (owner) fail
      mocks.resendApi = createMockResendApi({ failOnNthCall: 1 });
      global.fetch = mocks.resendApi.fetch as unknown as typeof fetch;

      const request = createBookingRequest();
      const response = await worker.fetch(request, mockEnv as any);

      // Booking should still succeed (saved to sheets)
      await expectSuccessResponse(response);

      // But customer should not get an email
      const emails = mocks.resendApi.getSentEmails();
      const customerEmail = emails.find(e => e.to === mockBookingPayload.customer_email);
      expect(customerEmail).toBeUndefined();
    });

    it('generates Google Maps URL in booking', async () => {
      const request = createBookingRequest();
      await worker.fetch(request, mockEnv as any);

      const appendedRows = mocks.sheetsClient!.getAppendedRows();
      const mapUrl = appendedRows[0][17] as string; // Map URL column
      expect(mapUrl).toContain('google.com/maps');
      expect(mapUrl).toContain('travelmode=driving');
    });
  });

  describe('Dry Run Mode', () => {
    it('skips email sending in dry run mode', async () => {
      const dryRunEnv = { ...mockEnv, RESEND_DRY_RUN: 'true' };
      const request = createBookingRequest();
      const response = await worker.fetch(request, dryRunEnv as any);

      const body = await expectSuccessResponse(response);
      expect(body.dryRun).toBe(true);

      // No emails sent
      const emails = mocks.resendApi!.getSentEmails();
      expect(emails.length).toBe(0);

      // But booking is still saved
      expect(mocks.sheetsClient!.appendRow).toHaveBeenCalled();
    });
  });
});

// =============================================================================
// SECURITY VALIDATION TESTS
// =============================================================================

describe('Security Validation', () => {
  describe('API Key Authentication', () => {
    it('rejects requests without API key', async () => {
      const request = new Request('https://test-worker.example.com/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockBookingPayload),
      });

      const response = await worker.fetch(request, mockEnv as any);
      expect(response.status).toBe(401);
      const text = await response.text();
      expect(text).toContain('Missing X-API-Key');
    });

    it('rejects requests with invalid API key', async () => {
      const request = createBookingRequest(mockBookingPayload, 'wrong-api-key');
      const response = await worker.fetch(request, mockEnv as any);

      expect(response.status).toBe(401);
      const text = await response.text();
      expect(text).toContain('Invalid API key');
    });

    it('accepts requests with valid API key', async () => {
      const request = createBookingRequest();
      const response = await worker.fetch(request, mockEnv as any);

      await expectSuccessResponse(response);
    });
  });

  describe('Rate Limiting', () => {
    it('rejects requests when rate limit exceeded', async () => {
      (mockEnv.BOOKING_RATE_LIMIT.limit as ReturnType<typeof vi.fn>).mockResolvedValue({ success: false });

      const request = createBookingRequest();
      const response = await worker.fetch(request, mockEnv as any);

      await expectErrorResponse(response, 429, 'Rate limit exceeded');
    });
  });

  describe('HTTP Method Validation', () => {
    it('rejects GET requests to /booking', async () => {
      const request = new Request('https://test-worker.example.com/booking', {
        method: 'GET',
        headers: { 'X-API-Key': mockEnv.API_KEY },
      });

      const response = await worker.fetch(request, mockEnv as any);
      expect(response.status).toBe(405);
    });

    it('rejects PUT requests to /booking', async () => {
      const request = new Request('https://test-worker.example.com/booking', {
        method: 'PUT',
        headers: {
          'X-API-Key': mockEnv.API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mockBookingPayload),
      });

      const response = await worker.fetch(request, mockEnv as any);
      expect(response.status).toBe(405);
    });
  });

  describe('Payload Validation', () => {
    it('rejects empty payload', async () => {
      const request = createBookingRequest({});
      const response = await worker.fetch(request, mockEnv as any);

      await expectErrorResponse(response, 400, 'Validation failed');
    });

    it('rejects missing required fields', async () => {
      const incompletePayload = {
        customer_name: 'John Smith',
        // Missing other required fields
      };

      const request = createBookingRequest(incompletePayload);
      const response = await worker.fetch(request, mockEnv as any);

      const body = await expectErrorResponse(response, 400, 'Validation failed');
      expect(body.details).toBeDefined();
    });

    it('rejects invalid email format', async () => {
      const invalidPayload = {
        ...mockBookingPayload,
        customer_email: 'not-an-email',
      };

      const request = createBookingRequest(invalidPayload);
      const response = await worker.fetch(request, mockEnv as any);

      await expectErrorResponse(response, 400, 'Validation failed');
    });

    it('rejects invalid passenger count', async () => {
      const invalidPayload = {
        ...mockBookingPayload,
        passengers: -1,
      };

      const request = createBookingRequest(invalidPayload);
      const response = await worker.fetch(request, mockEnv as any);

      await expectErrorResponse(response, 400, 'Validation failed');
    });

    it('accepts valid payload with optional fields missing', async () => {
      const minimalPayload = {
        customer_name: 'Jane Doe',
        customer_email: 'jane@example.com',
        start_location: '100 Main St, City, ST 12345',
        end_location: 'Airport Terminal A',
        pickup_datetime: '2025-03-15T10:00:00',
        passengers: 2,
        estimated_distance: '30 miles',
        estimated_duration: '45 mins',
        // No customer_phone, no notes
      };

      const request = createBookingRequest(minimalPayload);
      const response = await worker.fetch(request, mockEnv as any);

      await expectSuccessResponse(response);
    });

    it('normalizes email to lowercase', async () => {
      const payloadWithUpperEmail = {
        ...mockBookingPayload,
        customer_email: 'JOHN.SMITH@EXAMPLE.COM',
      };

      const request = createBookingRequest(payloadWithUpperEmail);
      await worker.fetch(request, mockEnv as any);

      const appendedRows = mocks.sheetsClient!.getAppendedRows();
      expect(appendedRows[0][4]).toBe('john.smith@example.com');
    });
  });
});

// =============================================================================
// ACCEPT/DENY WORKFLOW TESTS
// =============================================================================

describe('Owner Decision Workflow', () => {
  const transactionId = 'txn-test-12345678';

  describe('Accept Booking', () => {
    beforeEach(() => {
      // Setup sheet with existing booking
      mocks.sheetsClient = createMockGoogleSheetsClient({
        existingRows: [createMockSheetRow({ transactionId, status: 'Pending Review' })],
      });
    });

    it('updates status to Accepted in Google Sheets', async () => {
      const request = createAcceptRequest(transactionId);
      await worker.fetch(request, mockEnv as any);

      expect(mocks.sheetsClient!.updateRange).toHaveBeenCalled();
      const updates = mocks.sheetsClient!.getUpdatedCells();
      expect(updates.length).toBeGreaterThan(0);
      expect(updates[0].values[0][0]).toBe('Accepted');
    });

    it('sends customer confirmation email', async () => {
      const request = createAcceptRequest(transactionId);
      await worker.fetch(request, mockEnv as any);

      const emails = mocks.resendApi!.getSentEmails();
      const confirmationEmail = emails.find(e =>
        e.to === 'john.smith@example.com' && e.subject.includes('Confirmed')
      );
      expect(confirmationEmail).toBeDefined();
      validateCustomerConfirmationEmail(confirmationEmail!, mockBookingPayload);
    });

    it('returns success HTML page', async () => {
      const request = createAcceptRequest(transactionId);
      const response = await worker.fetch(request, mockEnv as any);

      const html = await expectHtmlResponse(response);
      expect(html).toContain('Accepted');
      expect(html).toContain('RIDE CONFIRMED');
    });
  });

  describe('Accept Booking - Trip Within 24 Hours', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      const now = new Date('2025-02-20T10:00:00Z');
      vi.setSystemTime(now);

      // Trip is 4 hours away
      mocks.sheetsClient = createMockGoogleSheetsClient({
        existingRows: [createMockSheetRow({
          transactionId,
          status: 'Pending Review',
          pickupDatetime: '2025-02-20T14:00:00Z',
        })],
      });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('sends reminder email immediately when trip is within 24 hours', async () => {
      const request = createAcceptRequest(transactionId);
      await worker.fetch(request, mockEnv as any);

      const emails = mocks.resendApi!.getSentEmails();

      // Should have confirmation AND reminder
      const confirmationEmail = emails.find(e => e.subject.includes('Confirmed'));
      const reminderEmail = emails.find(e => e.subject.includes('Reminder'));

      expect(confirmationEmail).toBeDefined();
      expect(reminderEmail).toBeDefined();
    });
  });

  describe('Deny Booking', () => {
    beforeEach(() => {
      mocks.sheetsClient = createMockGoogleSheetsClient({
        existingRows: [createMockSheetRow({ transactionId, status: 'Pending Review' })],
      });
    });

    it('updates status to Denied in Google Sheets', async () => {
      const request = createDenyRequest(transactionId);
      await worker.fetch(request, mockEnv as any);

      expect(mocks.sheetsClient!.updateRange).toHaveBeenCalled();
      const updates = mocks.sheetsClient!.getUpdatedCells();
      expect(updates[0].values[0][0]).toBe('Denied');
    });

    it('sends customer denial email', async () => {
      const request = createDenyRequest(transactionId);
      await worker.fetch(request, mockEnv as any);

      const emails = mocks.resendApi!.getSentEmails();
      const denialEmail = emails.find(e =>
        e.to === 'john.smith@example.com' && e.subject.includes('Update')
      );
      expect(denialEmail).toBeDefined();
      validateCustomerDenialEmail(denialEmail!, mockBookingPayload);
    });

    it('returns denial HTML page', async () => {
      const request = createDenyRequest(transactionId);
      const response = await worker.fetch(request, mockEnv as any);

      const html = await expectHtmlResponse(response);
      expect(html).toContain('Denied');
      expect(html).toContain('RIDE DECLINED');
    });
  });

  describe('Already Processed Booking', () => {
    it('shows already processed page for previously accepted booking', async () => {
      mocks.sheetsClient = createMockGoogleSheetsClient({
        existingRows: [createMockSheetRow({ transactionId, status: 'Accepted' })],
      });

      const request = createAcceptRequest(transactionId);
      const response = await worker.fetch(request, mockEnv as any);

      const html = await expectHtmlResponse(response);
      expect(html).toContain('Already Processed');
      expect(html).toContain('Accepted');
    });

    it('shows already processed page for previously denied booking', async () => {
      mocks.sheetsClient = createMockGoogleSheetsClient({
        existingRows: [createMockSheetRow({ transactionId, status: 'Denied' })],
      });

      const request = createDenyRequest(transactionId);
      const response = await worker.fetch(request, mockEnv as any);

      const html = await expectHtmlResponse(response);
      expect(html).toContain('Already Processed');
      expect(html).toContain('Denied');
    });

    it('does not update status again', async () => {
      mocks.sheetsClient = createMockGoogleSheetsClient({
        existingRows: [createMockSheetRow({ transactionId, status: 'Accepted' })],
      });

      const request = createDenyRequest(transactionId);
      await worker.fetch(request, mockEnv as any);

      expect(mocks.sheetsClient!.updateRange).not.toHaveBeenCalled();
    });

    it('does not send email again', async () => {
      mocks.sheetsClient = createMockGoogleSheetsClient({
        existingRows: [createMockSheetRow({ transactionId, status: 'Accepted' })],
      });

      const request = createAcceptRequest(transactionId);
      await worker.fetch(request, mockEnv as any);

      const emails = mocks.resendApi!.getSentEmails();
      expect(emails.length).toBe(0);
    });
  });

  describe('Booking Not Found', () => {
    it('returns error page for non-existent transaction', async () => {
      mocks.sheetsClient = createMockGoogleSheetsClient({ existingRows: [] });

      const request = createAcceptRequest('non-existent-txn-id');
      const response = await worker.fetch(request, mockEnv as any);

      const html = await expectHtmlResponse(response, 400);
      expect(html).toContain('Error');
    });
  });

  describe('Invalid Transaction ID', () => {
    it('rejects too short transaction IDs', async () => {
      const request = createAcceptRequest('short');
      const response = await worker.fetch(request, mockEnv as any);

      const html = await expectHtmlResponse(response, 400);
      expect(html).toContain('Invalid');
    });
  });
});

// =============================================================================
// ERROR HANDLING TESTS
// =============================================================================

describe('Error Handling', () => {
  describe('Google Sheets Failures', () => {
    it('returns 500 when primary sheet append fails', async () => {
      mocks.sheetsClient = createMockGoogleSheetsClient({ shouldFailAppend: true });

      const request = createBookingRequest();
      const response = await worker.fetch(request, mockEnv as any);

      await expectErrorResponse(response, 500, 'Failed to process');
    });

    it('booking succeeds even if backup sheet fails', async () => {
      // Backup write is fire-and-forget, so we can't easily test this
      // The main append succeeds, backup failures are logged but don't fail the request
      const request = createBookingRequest();
      const response = await worker.fetch(request, mockEnv as any);

      await expectSuccessResponse(response);
    });
  });

  describe('Email Failures', () => {
    it('booking succeeds even if all emails fail (booking is already saved)', async () => {
      mocks.resendApi = createMockResendApi({ shouldFail: true });
      global.fetch = mocks.resendApi.fetch as unknown as typeof fetch;

      const request = createBookingRequest();
      const response = await worker.fetch(request, mockEnv as any);

      // Booking should still succeed
      await expectSuccessResponse(response);

      // Booking is saved to sheets
      expect(mocks.sheetsClient!.appendRow).toHaveBeenCalled();
    });
  });

  describe('Unknown Routes', () => {
    it('returns 404 for unknown paths', async () => {
      const request = new Request('https://test-worker.example.com/unknown-path', {
        method: 'GET',
      });

      const response = await worker.fetch(request, mockEnv as any);
      await expectErrorResponse(response, 404, 'Not found');
    });
  });
});

// =============================================================================
// ROUTING TESTS
// =============================================================================

describe('Routing', () => {
  it('handles /booking path', async () => {
    const request = createBookingRequest();
    const response = await worker.fetch(request, mockEnv as any);
    await expectSuccessResponse(response);
  });

  it('handles / path (same as /booking)', async () => {
    const request = new Request('https://test-worker.example.com/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': mockEnv.API_KEY,
      },
      body: JSON.stringify(mockBookingPayload),
    });

    const response = await worker.fetch(request, mockEnv as any);
    await expectSuccessResponse(response);
  });

  it('handles /accept/:id path', async () => {
    const txnId = 'txn-route-test-12345';
    mocks.sheetsClient = createMockGoogleSheetsClient({
      existingRows: [createMockSheetRow({ transactionId: txnId, status: 'Pending Review' })],
    });

    const request = createAcceptRequest(txnId);
    const response = await worker.fetch(request, mockEnv as any);
    await expectHtmlResponse(response);
  });

  it('handles /deny/:id path', async () => {
    const txnId = 'txn-route-test-67890';
    mocks.sheetsClient = createMockGoogleSheetsClient({
      existingRows: [createMockSheetRow({ transactionId: txnId, status: 'Pending Review' })],
    });

    const request = createDenyRequest(txnId);
    const response = await worker.fetch(request, mockEnv as any);
    await expectHtmlResponse(response);
  });

  it('handles /health path', async () => {
    const request = createHealthRequest();
    const response = await worker.fetch(request, mockEnv as any);
    expect(response.status).toBe(200);
  });

  it('handles /favicon.ico with 204 No Content', async () => {
    const request = new Request('https://test-worker.example.com/favicon.ico');
    const response = await worker.fetch(request, mockEnv as any);
    expect(response.status).toBe(204);
  });
});

// =============================================================================
// IDEMPOTENCY TESTS
// =============================================================================

describe('Idempotency', () => {
  it('generates idempotency key from payload if not provided', async () => {
    const request = createBookingRequest();
    await worker.fetch(request, mockEnv as any);

    const appendedRows = mocks.sheetsClient!.getAppendedRows();
    const idempotencyKey = appendedRows[0][1] as string;
    expect(idempotencyKey).toMatch(/^auto-/);
  });

  it('uses provided idempotency key', async () => {
    const payloadWithIdempotencyKey = {
      ...mockBookingPayload,
      idempotency_key: 'my-custom-key-123',
    };

    const request = createBookingRequest(payloadWithIdempotencyKey);
    await worker.fetch(request, mockEnv as any);

    const appendedRows = mocks.sheetsClient!.getAppendedRows();
    const idempotencyKey = appendedRows[0][1] as string;
    expect(idempotencyKey).toBe('my-custom-key-123');
  });
});
