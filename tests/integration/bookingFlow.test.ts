/**
 * Booking Flow Integration Tests
 *
 * Tests the complete booking flow from request to Google Sheets persistence.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleSubmission, CoordinationEnv, SubmissionSummary } from '../../src/layers/coordination';
import { SecurityResult, BookingPayload } from '../../src/layers/security';

// Mock Google Sheets Client
vi.mock('../../src/integrations/googleSheets', () => ({
  GoogleSheetsClient: vi.fn().mockImplementation(() => ({
    appendRow: vi.fn().mockResolvedValue({
      success: true,
      updatedRange: 'Sheet1!A5:Z5',
      rowNumber: 5,
    }),
    appendAuditEntry: vi.fn().mockResolvedValue(undefined),
    readRange: vi.fn().mockResolvedValue([]),
    updateRange: vi.fn().mockResolvedValue(undefined),
  })),
}));

const createMockSecurityResult = (overrides: Partial<BookingPayload> = {}): SecurityResult => ({
  payload: {
    customer_name: 'Jane Smith',
    customer_email: 'jane@example.com',
    start_location: '100 Peachtree St, Atlanta, GA',
    end_location: 'Hartsfield-Jackson Airport, Atlanta, GA',
    pickup_datetime: '2025-02-20T08:00:00-05:00',
    passengers: 3,
    estimated_distance: '15.2 miles',
    estimated_duration: '25 mins',
    customer_phone: '+1-555-987-6543',
    notes: 'Early morning flight',
    ...overrides,
  },
  idempotencyKey: 'test-idempotency-key-123',
  customerEmail: overrides.customer_email ?? 'jane@example.com',
});

const createMockEnv = (overrides: Partial<CoordinationEnv> = {}): CoordinationEnv => ({
  GOOGLE_SERVICE_ACCOUNT: JSON.stringify({
    client_email: 'test@test.iam.gserviceaccount.com',
    private_key: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----',
  }),
  GOOGLE_SHEET_ID_PRIMARY: 'primary-sheet-id',
  GOOGLE_SHEET_ID_BACKUP: 'backup-sheet-id',
  GOOGLE_SHEET_ID_AUDIT: 'audit-sheet-id',
  DRIVER_CONTACT_NAME: 'John Driver',
  DRIVER_CONTACT_EMAIL: 'driver@acshuttles.com',
  DRIVER_CONTACT_PHONE: '+1-555-123-0000',
  ...overrides,
});

describe('Booking Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleSubmission', () => {
    it('creates submission with all required fields', async () => {
      const securityResult = createMockSecurityResult();
      const env = createMockEnv();
      const receivedAt = new Date().toISOString();

      const result = await handleSubmission(securityResult, env, receivedAt);

      expect(result.summary).toBeDefined();
      expect(result.summary.transactionId).toBeDefined();
      expect(result.summary.transactionId.length).toBe(36); // UUID format
      expect(result.summary.customerName).toBe('Jane Smith');
      expect(result.summary.customerEmail).toBe('jane@example.com');
      expect(result.summary.startLocation).toBe('100 Peachtree St, Atlanta, GA');
      expect(result.summary.endLocation).toBe('Hartsfield-Jackson Airport, Atlanta, GA');
      expect(result.summary.passengers).toBe(3);
    });

    it('generates Google Maps URL', async () => {
      const securityResult = createMockSecurityResult();
      const env = createMockEnv();
      const receivedAt = new Date().toISOString();

      const result = await handleSubmission(securityResult, env, receivedAt);

      expect(result.summary.mapUrl).toContain('google.com/maps');
      expect(result.summary.mapUrl).toContain('100+Peachtree');
      expect(result.summary.mapUrl).toContain('Hartsfield');
    });

    it('generates unique transaction IDs', async () => {
      const securityResult1 = createMockSecurityResult();
      const securityResult2 = createMockSecurityResult({ customer_name: 'Different Person' });
      const env = createMockEnv();
      const receivedAt = new Date().toISOString();

      const result1 = await handleSubmission(securityResult1, env, receivedAt);
      const result2 = await handleSubmission(securityResult2, env, receivedAt);

      expect(result1.summary.transactionId).not.toBe(result2.summary.transactionId);
    });

    it('returns row number from Google Sheets', async () => {
      const securityResult = createMockSecurityResult();
      const env = createMockEnv();
      const receivedAt = new Date().toISOString();

      const result = await handleSubmission(securityResult, env, receivedAt);

      expect(result.rowNumber).toBe(5);
    });

    it('includes optional fields when provided', async () => {
      const securityResult = createMockSecurityResult({
        customer_phone: '+1-555-999-8888',
        notes: 'Need wheelchair accessible vehicle',
      });
      const env = createMockEnv();
      const receivedAt = new Date().toISOString();

      const result = await handleSubmission(securityResult, env, receivedAt);

      expect(result.summary.customerPhone).toBe('+1-555-999-8888');
      expect(result.summary.notes).toBe('Need wheelchair accessible vehicle');
    });

    it('handles missing optional fields', async () => {
      const securityResult = createMockSecurityResult({
        customer_phone: undefined,
        notes: undefined,
      });
      const env = createMockEnv();
      const receivedAt = new Date().toISOString();

      const result = await handleSubmission(securityResult, env, receivedAt);

      expect(result.summary.customerPhone).toBeNull();
      expect(result.summary.notes).toBeNull();
    });

    it('throws on missing GOOGLE_SHEET_ID_PRIMARY', async () => {
      const securityResult = createMockSecurityResult();
      const env = createMockEnv({ GOOGLE_SHEET_ID_PRIMARY: undefined as unknown as string });
      const receivedAt = new Date().toISOString();

      await expect(handleSubmission(securityResult, env, receivedAt)).rejects.toBeInstanceOf(Response);
    });

    it('throws on missing GOOGLE_SERVICE_ACCOUNT', async () => {
      const securityResult = createMockSecurityResult();
      const env = createMockEnv({ GOOGLE_SERVICE_ACCOUNT: undefined as unknown as string });
      const receivedAt = new Date().toISOString();

      await expect(handleSubmission(securityResult, env, receivedAt)).rejects.toBeInstanceOf(Response);
    });
  });
});

describe('Submission Summary', () => {
  it('has all required fields', async () => {
    const securityResult = createMockSecurityResult();
    const env = createMockEnv();
    const receivedAt = '2025-02-15T10:30:00Z';

    const result = await handleSubmission(securityResult, env, receivedAt);
    const summary = result.summary;

    // Check all SubmissionSummary fields
    expect(summary.transactionId).toBeDefined();
    expect(summary.idempotencyKey).toBe('test-idempotency-key-123');
    expect(summary.customerName).toBe('Jane Smith');
    expect(summary.customerEmail).toBe('jane@example.com');
    expect(summary.startLocation).toBe('100 Peachtree St, Atlanta, GA');
    expect(summary.endLocation).toBe('Hartsfield-Jackson Airport, Atlanta, GA');
    expect(summary.pickupDatetime).toBe('2025-02-20T08:00:00-05:00');
    expect(summary.estimatedDistance).toBe('15.2 miles');
    expect(summary.estimatedDuration).toBe('25 mins');
    expect(summary.passengers).toBe(3);
    expect(summary.submittedAt).toBe(receivedAt);
    expect(summary.mapUrl).toBeDefined();
  });
});

describe('Google Maps URL Generation', () => {
  it('encodes special characters in addresses', async () => {
    const securityResult = createMockSecurityResult({
      start_location: '123 Main St, Suite #100, Atlanta, GA',
      end_location: "O'Hare Airport, Chicago, IL",
    });
    const env = createMockEnv();
    const receivedAt = new Date().toISOString();

    const result = await handleSubmission(securityResult, env, receivedAt);

    // URL should be properly encoded
    expect(result.summary.mapUrl).toContain('google.com/maps/dir');
    expect(result.summary.mapUrl).not.toContain(' '); // Spaces should be encoded
  });

  it('includes driving mode', async () => {
    const securityResult = createMockSecurityResult();
    const env = createMockEnv();
    const receivedAt = new Date().toISOString();

    const result = await handleSubmission(securityResult, env, receivedAt);

    expect(result.summary.mapUrl).toContain('travelmode=driving');
  });
});
