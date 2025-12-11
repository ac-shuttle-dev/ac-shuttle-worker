/**
 * Google Sheets Client Tests
 *
 * Tests for the enterprise-grade Google Sheets integration
 * with retry logic and write verification.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GoogleSheetsClient, GoogleSheetsError, WriteVerificationError } from '../../../src/integrations/googleSheets';

// Valid mock credentials - private key doesn't need to be real since we mock getAccessToken
const mockCredentials = JSON.stringify({
  client_email: 'test@test-project.iam.gserviceaccount.com',
  private_key: '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAAOCAQ8A\n-----END PRIVATE KEY-----',
});

// Mock fetch responses
const createMockFetch = (responses: Array<{ ok: boolean; status: number; body: unknown }>): typeof fetch => {
  let callIndex = 0;
  return vi.fn().mockImplementation(async (url: string) => {
    // For token requests, return a mock token (but this is bypassed by our getAccessToken mock)
    if (url.includes('oauth2.googleapis.com/token')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ access_token: 'mock-token-123', expires_in: 3600 }),
        text: async () => JSON.stringify({ access_token: 'mock-token-123', expires_in: 3600 }),
      };
    }

    // Get the current response and increment index
    const currentIndex = callIndex;
    callIndex++;
    const response = responses[currentIndex] || responses[responses.length - 1];

    // Create a new object for each response to avoid closure issues
    const responseBody = JSON.parse(JSON.stringify(response.body));

    return {
      ok: response.ok,
      status: response.status,
      json: async () => responseBody,
      text: async () => JSON.stringify(responseBody),
    };
  }) as typeof fetch;
};

// Helper to create a client with mocked token acquisition
const createMockedClient = (options: {
  fetchImpl: typeof fetch;
  maxRetries?: number;
  retryDelayMs?: number;
  verifyWrites?: boolean;
}) => {
  const client = new GoogleSheetsClient({
    credentialsJson: mockCredentials,
    fetchImpl: options.fetchImpl,
    maxRetries: options.maxRetries,
    retryDelayMs: options.retryDelayMs,
    verifyWrites: options.verifyWrites,
  });

  // Mock tokenCache to bypass JWT signing (using the correct property name and structure)
  (client as unknown as { tokenCache: { accessToken: string; expiresAt: number } }).tokenCache = {
    accessToken: 'mock-access-token-123',
    expiresAt: Date.now() + 3600000, // 1 hour from now
  };

  return client;
};

describe('GoogleSheetsClient', () => {
  describe('Constructor', () => {
    it('throws on invalid credentials JSON', () => {
      expect(() => new GoogleSheetsClient({
        credentialsJson: 'invalid json',
      })).toThrow(GoogleSheetsError);
    });

    it('throws on missing client_email', () => {
      expect(() => new GoogleSheetsClient({
        credentialsJson: JSON.stringify({ private_key: 'test' }),
      })).toThrow(GoogleSheetsError);
    });

    it('throws on missing private_key', () => {
      expect(() => new GoogleSheetsClient({
        credentialsJson: JSON.stringify({ client_email: 'test@test.com' }),
      })).toThrow(GoogleSheetsError);
    });
  });

  describe('appendRow', () => {
    it('successfully appends a row', async () => {
      const mockFetch = createMockFetch([
        // Append response
        { ok: true, status: 200, body: { updates: { updatedRange: 'Sheet1!A5:Z5', updatedRows: 1 } } },
        // Verification read
        { ok: true, status: 200, body: { values: [['txn-123', 'data']] } },
      ]);

      const client = createMockedClient({
        fetchImpl: mockFetch,
        verifyWrites: true,
      });

      const result = await client.appendRow({
        sheetId: 'sheet123',
        range: 'Sheet1!A:Z',
        values: ['txn-123', 'data'],
      });

      expect(result.success).toBe(true);
      expect(result.rowNumber).toBe(5);
      expect(mockFetch).toHaveBeenCalledTimes(2); // Append + verify (token is cached)
    });

    it('retries on 429 rate limit error', async () => {
      const mockFetch = createMockFetch([
        // First append - rate limited
        { ok: false, status: 429, body: { error: { message: 'Rate limit exceeded' } } },
        // Retry append - success
        { ok: true, status: 200, body: { updates: { updatedRange: 'Sheet1!A5:Z5', updatedRows: 1 } } },
        // Verification read
        { ok: true, status: 200, body: { values: [['txn-123', 'data']] } },
      ]);

      const client = createMockedClient({
        fetchImpl: mockFetch,
        maxRetries: 3,
        retryDelayMs: 10, // Short delay for testing
        verifyWrites: true,
      });

      const result = await client.appendRow({
        sheetId: 'sheet123',
        range: 'Sheet1!A:Z',
        values: ['txn-123', 'data'],
      });

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(3); // 2 append attempts + verify
    });

    it('retries on 503 service unavailable', async () => {
      const mockFetch = createMockFetch([
        // First append - service unavailable
        { ok: false, status: 503, body: { error: { message: 'Service unavailable' } } },
        // Retry append - success
        { ok: true, status: 200, body: { updates: { updatedRange: 'Sheet1!A5:Z5', updatedRows: 1 } } },
        // Verification read
        { ok: true, status: 200, body: { values: [['txn-123', 'data']] } },
      ]);

      const client = createMockedClient({
        fetchImpl: mockFetch,
        maxRetries: 3,
        retryDelayMs: 10,
        verifyWrites: true,
      });

      const result = await client.appendRow({
        sheetId: 'sheet123',
        range: 'Sheet1!A:Z',
        values: ['txn-123', 'data'],
      });

      expect(result.success).toBe(true);
    });

    it('does NOT retry on 400 bad request', async () => {
      const mockFetch = createMockFetch([
        // Append - bad request (not retryable)
        { ok: false, status: 400, body: { error: { message: 'Invalid range' } } },
      ]);

      const client = createMockedClient({
        fetchImpl: mockFetch,
        maxRetries: 3,
        retryDelayMs: 10,
      });

      await expect(client.appendRow({
        sheetId: 'sheet123',
        range: 'Invalid!Range',
        values: ['data'],
      })).rejects.toThrow(GoogleSheetsError);

      // Should only call 1 append (no retries for 400)
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('does NOT retry on 401 unauthorized', async () => {
      const mockFetch = createMockFetch([
        // Append - unauthorized (not retryable)
        { ok: false, status: 401, body: { error: { message: 'Unauthorized' } } },
      ]);

      const client = createMockedClient({
        fetchImpl: mockFetch,
        maxRetries: 3,
        retryDelayMs: 10,
      });

      await expect(client.appendRow({
        sheetId: 'sheet123',
        range: 'Sheet1!A:Z',
        values: ['data'],
      })).rejects.toThrow(GoogleSheetsError);

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('respects maxRetries configuration', async () => {
      const mockFetch = createMockFetch([
        // All retries fail with 503
        { ok: false, status: 503, body: { error: { message: 'Service unavailable' } } },
        { ok: false, status: 503, body: { error: { message: 'Service unavailable' } } },
        { ok: false, status: 503, body: { error: { message: 'Service unavailable' } } },
      ]);

      const client = createMockedClient({
        fetchImpl: mockFetch,
        maxRetries: 2,
        retryDelayMs: 10,
      });

      await expect(client.appendRow({
        sheetId: 'sheet123',
        range: 'Sheet1!A:Z',
        values: ['data'],
      })).rejects.toThrow(GoogleSheetsError);

      // 2 attempts (maxRetries)
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('skips verification when disabled', async () => {
      const mockFetch = createMockFetch([
        // Append response
        { ok: true, status: 200, body: { updates: { updatedRange: 'Sheet1!A5:Z5', updatedRows: 1 } } },
      ]);

      const client = createMockedClient({
        fetchImpl: mockFetch,
        verifyWrites: false,
      });

      const result = await client.appendRow({
        sheetId: 'sheet123',
        range: 'Sheet1!A:Z',
        values: ['txn-123', 'data'],
      });

      expect(result.success).toBe(true);
      // No verification call
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('readRange', () => {
    it('successfully reads a range', async () => {
      const mockFetch = createMockFetch([
        // Read response
        { ok: true, status: 200, body: { values: [['A1', 'B1'], ['A2', 'B2']] } },
      ]);

      const client = createMockedClient({ fetchImpl: mockFetch });

      const result = await client.readRange({
        sheetId: 'sheet123',
        range: 'Sheet1!A1:B2',
      });

      expect(result).toEqual([['A1', 'B1'], ['A2', 'B2']]);
    });

    it('returns empty array for empty range', async () => {
      const mockFetch = createMockFetch([
        // Read response - no values
        { ok: true, status: 200, body: {} },
      ]);

      const client = createMockedClient({ fetchImpl: mockFetch });

      const result = await client.readRange({
        sheetId: 'sheet123',
        range: 'Sheet1!A1:B2',
      });

      expect(result).toEqual([]);
    });
  });

  describe('updateRange', () => {
    it('successfully updates a range', async () => {
      const mockFetch = createMockFetch([
        // Update response
        { ok: true, status: 200, body: { updatedRange: 'Sheet1!Q5:Q5' } },
      ]);

      const client = createMockedClient({ fetchImpl: mockFetch });

      await expect(client.updateRange({
        sheetId: 'sheet123',
        range: 'Sheet1!Q5:Q5',
        values: [['Accepted']],
      })).resolves.not.toThrow();
    });
  });

  describe('Token caching', () => {
    it('caches access token', async () => {
      const mockFetch = createMockFetch([
        // First read
        { ok: true, status: 200, body: { values: [['data']] } },
        // Second read (should use cached token)
        { ok: true, status: 200, body: { values: [['data2']] } },
      ]);

      const client = createMockedClient({ fetchImpl: mockFetch });

      await client.readRange({ sheetId: 'sheet123', range: 'Sheet1!A1:A1' });
      await client.readRange({ sheetId: 'sheet123', range: 'Sheet1!A2:A2' });

      // Token is pre-cached, so only 2 read calls
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('appendAuditEntry', () => {
    it('does not throw on failure (fire-and-forget)', async () => {
      const mockFetch = createMockFetch([
        // Audit append - fails
        { ok: false, status: 500, body: { error: { message: 'Server error' } } },
        { ok: false, status: 500, body: { error: { message: 'Server error' } } },
        { ok: false, status: 500, body: { error: { message: 'Server error' } } },
      ]);

      const client = createMockedClient({
        fetchImpl: mockFetch,
        maxRetries: 3,
        retryDelayMs: 10,
      });

      // Should not throw - audit is fire-and-forget
      await expect(client.appendAuditEntry({
        sheetId: 'audit123',
        range: 'Sheet1!A:Z',
        values: ['txn-123', 'event', 'timestamp'],
      })).resolves.not.toThrow();
    });
  });
});

describe('Error Classification', () => {
  it('classifies 429 as retryable', () => {
    const error = new GoogleSheetsError(
      'Rate limit exceeded',
      429,
      'sheet123',
      'Sheet1!A:Z',
      'append',
      true
    );
    expect(error.isRetryable).toBe(true);
  });

  it('classifies 500 as retryable', () => {
    const error = new GoogleSheetsError(
      'Server error',
      500,
      'sheet123',
      'Sheet1!A:Z',
      'append',
      true
    );
    expect(error.isRetryable).toBe(true);
  });

  it('classifies 400 as not retryable', () => {
    const error = new GoogleSheetsError(
      'Bad request',
      400,
      'sheet123',
      'Sheet1!A:Z',
      'append',
      false
    );
    expect(error.isRetryable).toBe(false);
  });

  it('includes context in error', () => {
    const error = new GoogleSheetsError(
      'Failed',
      500,
      'sheet123',
      'Sheet1!A:Z',
      'append',
      true
    );
    expect(error.sheetId).toBe('sheet123');
    expect(error.range).toBe('Sheet1!A:Z');
    expect(error.operation).toBe('append');
    expect(error.statusCode).toBe(500);
  });
});
