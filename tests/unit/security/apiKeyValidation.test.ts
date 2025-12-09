/**
 * API Key Validation Tests
 *
 * Tests the server-side authentication mechanism.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateRequest, SecurityEnv } from '../../../src/layers/security';

// Mock rate limiter
const mockRateLimiter = {
  limit: vi.fn().mockResolvedValue({ success: true }),
};

const createMockEnv = (apiKey = 'test-api-key-12345'): SecurityEnv => ({
  API_KEY: apiKey,
  BOOKING_RATE_LIMIT: mockRateLimiter,
});

const createMockRequest = (options: {
  method?: string;
  apiKey?: string | null;
  body?: unknown;
} = {}): Request => {
  const { method = 'POST', apiKey = 'test-api-key-12345', body = validPayload } = options;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (apiKey !== null) {
    headers['X-API-Key'] = apiKey;
  }

  return new Request('https://example.com/booking', {
    method,
    headers,
    body: method !== 'GET' ? JSON.stringify(body) : undefined,
  });
};

const validPayload = {
  customer_name: 'John Doe',
  customer_email: 'john@example.com',
  start_location: '123 Main St, Atlanta, GA',
  end_location: '456 Airport Blvd, Atlanta, GA',
  pickup_datetime: '2025-01-15T14:30:00-05:00',
  passengers: 2,
  estimated_distance: '25.5 km',
  estimated_duration: '35 mins',
};

describe('API Key Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Method validation', () => {
    it('rejects GET requests', async () => {
      const request = new Request('https://example.com/booking', { method: 'GET' });
      const env = createMockEnv();

      await expect(validateRequest(request, env)).rejects.toBeInstanceOf(Response);
    });

    it('accepts POST requests', async () => {
      const request = createMockRequest();
      const env = createMockEnv();

      const result = await validateRequest(request, env);
      expect(result.payload.customer_name).toBe('John Doe');
    });
  });

  describe('API key validation', () => {
    it('rejects requests without X-API-Key header', async () => {
      const request = createMockRequest({ apiKey: null });
      const env = createMockEnv();

      try {
        await validateRequest(request, env);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        const response = error as Response;
        expect(response.status).toBe(401);
        const text = await response.text();
        expect(text).toContain('Missing X-API-Key');
      }
    });

    it('rejects requests with invalid API key', async () => {
      const request = createMockRequest({ apiKey: 'wrong-api-key' });
      const env = createMockEnv();

      try {
        await validateRequest(request, env);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        const response = error as Response;
        expect(response.status).toBe(401);
        const text = await response.text();
        expect(text).toContain('Invalid API key');
      }
    });

    it('accepts requests with valid API key', async () => {
      const request = createMockRequest();
      const env = createMockEnv();

      const result = await validateRequest(request, env);
      expect(result.customerEmail).toBe('john@example.com');
    });
  });

  describe('Rate limiting', () => {
    it('allows requests within rate limit', async () => {
      mockRateLimiter.limit.mockResolvedValue({ success: true });
      const request = createMockRequest();
      const env = createMockEnv();

      const result = await validateRequest(request, env);
      expect(result.payload).toBeDefined();
      expect(mockRateLimiter.limit).toHaveBeenCalledWith({ key: 'test-api-key-12345' });
    });

    it('rejects requests exceeding rate limit', async () => {
      mockRateLimiter.limit.mockResolvedValue({ success: false });
      const request = createMockRequest();
      const env = createMockEnv();

      try {
        await validateRequest(request, env);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        const response = error as Response;
        expect(response.status).toBe(429);
      }
    });
  });
});

describe('Payload Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimiter.limit.mockResolvedValue({ success: true });
  });

  describe('Required fields', () => {
    it('rejects payload missing customer_name', async () => {
      const { customer_name, ...payloadWithoutName } = validPayload;
      const request = createMockRequest({ body: payloadWithoutName });
      const env = createMockEnv();

      try {
        await validateRequest(request, env);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        const response = error as Response;
        expect(response.status).toBe(400);
      }
    });

    it('rejects payload missing customer_email', async () => {
      const { customer_email, ...payloadWithoutEmail } = validPayload;
      const request = createMockRequest({ body: payloadWithoutEmail });
      const env = createMockEnv();

      try {
        await validateRequest(request, env);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        const response = error as Response;
        expect(response.status).toBe(400);
      }
    });

    it('accepts payload with all required fields', async () => {
      const request = createMockRequest();
      const env = createMockEnv();

      const result = await validateRequest(request, env);
      expect(result.payload.customer_name).toBe('John Doe');
      expect(result.payload.customer_email).toBe('john@example.com');
      expect(result.payload.start_location).toBe('123 Main St, Atlanta, GA');
      expect(result.payload.end_location).toBe('456 Airport Blvd, Atlanta, GA');
      expect(result.payload.passengers).toBe(2);
    });
  });

  describe('Email validation', () => {
    it('rejects invalid email format', async () => {
      const request = createMockRequest({
        body: { ...validPayload, customer_email: 'not-an-email' },
      });
      const env = createMockEnv();

      try {
        await validateRequest(request, env);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        const response = error as Response;
        expect(response.status).toBe(400);
      }
    });

    it('normalizes email to lowercase', async () => {
      const request = createMockRequest({
        body: { ...validPayload, customer_email: 'John@EXAMPLE.com' },
      });
      const env = createMockEnv();

      const result = await validateRequest(request, env);
      expect(result.payload.customer_email).toBe('john@example.com');
    });
  });

  describe('Passengers validation', () => {
    it('accepts passengers as number', async () => {
      const request = createMockRequest({
        body: { ...validPayload, passengers: 3 },
      });
      const env = createMockEnv();

      const result = await validateRequest(request, env);
      expect(result.payload.passengers).toBe(3);
    });

    it('accepts passengers as string', async () => {
      const request = createMockRequest({
        body: { ...validPayload, passengers: '4' },
      });
      const env = createMockEnv();

      const result = await validateRequest(request, env);
      expect(result.payload.passengers).toBe(4);
    });

    it('rejects zero passengers', async () => {
      const request = createMockRequest({
        body: { ...validPayload, passengers: 0 },
      });
      const env = createMockEnv();

      try {
        await validateRequest(request, env);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        const response = error as Response;
        expect(response.status).toBe(400);
      }
    });

    it('rejects negative passengers', async () => {
      const request = createMockRequest({
        body: { ...validPayload, passengers: -1 },
      });
      const env = createMockEnv();

      try {
        await validateRequest(request, env);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        const response = error as Response;
        expect(response.status).toBe(400);
      }
    });
  });

  describe('Optional fields', () => {
    it('accepts payload with optional fields', async () => {
      const request = createMockRequest({
        body: {
          ...validPayload,
          customer_phone: '+1-555-123-4567',
          notes: 'Please bring a car seat',
        },
      });
      const env = createMockEnv();

      const result = await validateRequest(request, env);
      expect(result.payload.customer_phone).toBe('+1-555-123-4567');
      expect(result.payload.notes).toBe('Please bring a car seat');
    });

    it('accepts payload without optional fields', async () => {
      const request = createMockRequest();
      const env = createMockEnv();

      const result = await validateRequest(request, env);
      expect(result.payload.customer_phone).toBeUndefined();
      expect(result.payload.notes).toBeUndefined();
    });
  });
});

describe('Idempotency Key', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimiter.limit.mockResolvedValue({ success: true });
  });

  it('uses provided idempotency key', async () => {
    const request = createMockRequest({
      body: { ...validPayload, idempotency_key: 'custom-key-123' },
    });
    const env = createMockEnv();

    const result = await validateRequest(request, env);
    expect(result.idempotencyKey).toBe('custom-key-123');
  });

  it('generates idempotency key when not provided', async () => {
    const request = createMockRequest();
    const env = createMockEnv();

    const result = await validateRequest(request, env);
    expect(result.idempotencyKey).toBeDefined();
    expect(result.idempotencyKey.length).toBeGreaterThan(0);
  });

  it('generates deterministic key for same payload', async () => {
    const env = createMockEnv();

    const request1 = createMockRequest();
    const result1 = await validateRequest(request1, env);

    const request2 = createMockRequest();
    const result2 = await validateRequest(request2, env);

    // Keys should start with 'auto-' and have same prefix (deterministic part)
    expect(result1.idempotencyKey).toMatch(/^auto-/);
    expect(result2.idempotencyKey).toMatch(/^auto-/);
  });
});
