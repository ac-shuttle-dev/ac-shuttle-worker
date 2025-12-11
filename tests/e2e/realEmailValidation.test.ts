/**
 * End-to-End Tests with Real Email Validation
 *
 * These tests can be run against real services to validate email delivery.
 * They require environment variables to be set:
 *
 * Required:
 *   - E2E_WORKER_URL: The deployed worker URL (e.g., https://ac-shuttle-worker.example.workers.dev)
 *   - E2E_API_KEY: The real API key for the worker
 *
 * Optional (for email validation):
 *   - E2E_TEST_EMAIL: A temp email address to receive emails (e.g., from Mailinator)
 *   - MAILINATOR_API_KEY: API key for Mailinator to fetch emails programmatically
 *
 * Usage:
 *   E2E_WORKER_URL=https://... E2E_API_KEY=... npm run test:e2e
 *
 * Or create a .env.test file with these values.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// =============================================================================
// CONFIGURATION
// =============================================================================

const config = {
  workerUrl: process.env.E2E_WORKER_URL || '',
  apiKey: process.env.E2E_API_KEY || '',
  testEmail: process.env.E2E_TEST_EMAIL || 'acshuttles-test@mailinator.com',
  mailinatorApiKey: process.env.MAILINATOR_API_KEY || '',
  // Whether to actually run E2E tests (skip if not configured)
  enabled: !!(process.env.E2E_WORKER_URL && process.env.E2E_API_KEY),
};

// Skip all tests if not configured
const describeE2E = config.enabled ? describe : describe.skip;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

interface BookingPayload {
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  start_location: string;
  end_location: string;
  pickup_datetime: string;
  passengers: number;
  estimated_distance: string;
  estimated_duration: string;
  notes?: string;
  idempotency_key?: string;
}

async function createBooking(payload: BookingPayload): Promise<{
  ok: boolean;
  transactionId?: string;
  error?: string;
  receivedAt?: string;
}> {
  const response = await fetch(`${config.workerUrl}/booking`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': config.apiKey,
    },
    body: JSON.stringify(payload),
  });

  return response.json();
}

async function acceptBooking(transactionId: string): Promise<Response> {
  return fetch(`${config.workerUrl}/accept/${transactionId}`, {
    method: 'GET',
  });
}

async function denyBooking(transactionId: string): Promise<Response> {
  return fetch(`${config.workerUrl}/deny/${transactionId}`, {
    method: 'GET',
  });
}

async function checkHealth(): Promise<{ ok: boolean; timestamp: string }> {
  const response = await fetch(`${config.workerUrl}/health`);
  return response.json();
}

// =============================================================================
// MAILINATOR EMAIL CHECKING
// =============================================================================

interface MailinatorMessage {
  id: string;
  from: string;
  subject: string;
  time: number;
}

interface MailinatorMessageDetail {
  id: string;
  from: string;
  subject: string;
  parts: Array<{
    headers: Record<string, string>;
    body: string;
  }>;
}

async function fetchMailinatorInbox(inbox: string): Promise<MailinatorMessage[]> {
  if (!config.mailinatorApiKey) {
    console.warn('MAILINATOR_API_KEY not set - skipping email fetch');
    return [];
  }

  const domain = 'mailinator.com';
  const response = await fetch(
    `https://mailinator.com/api/v2/domains/${domain}/inboxes/${inbox}`,
    {
      headers: {
        Authorization: config.mailinatorApiKey,
      },
    }
  );

  if (!response.ok) {
    console.error('Failed to fetch Mailinator inbox:', await response.text());
    return [];
  }

  const data = await response.json() as { msgs: MailinatorMessage[] };
  return data.msgs || [];
}

async function fetchMailinatorMessage(inbox: string, messageId: string): Promise<MailinatorMessageDetail | null> {
  if (!config.mailinatorApiKey) {
    return null;
  }

  const domain = 'mailinator.com';
  const response = await fetch(
    `https://mailinator.com/api/v2/domains/${domain}/inboxes/${inbox}/messages/${messageId}`,
    {
      headers: {
        Authorization: config.mailinatorApiKey,
      },
    }
  );

  if (!response.ok) {
    return null;
  }

  return response.json();
}

async function waitForEmail(
  inbox: string,
  subjectContains: string,
  timeoutMs: number = 30000
): Promise<MailinatorMessage | null> {
  const startTime = Date.now();
  const pollInterval = 2000;

  while (Date.now() - startTime < timeoutMs) {
    const messages = await fetchMailinatorInbox(inbox);
    const matchingMessage = messages.find(m =>
      m.subject.toLowerCase().includes(subjectContains.toLowerCase())
    );

    if (matchingMessage) {
      return matchingMessage;
    }

    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  return null;
}

// =============================================================================
// E2E TESTS
// =============================================================================

describeE2E('E2E: Worker Health', () => {
  it('worker is reachable and healthy', async () => {
    const health = await checkHealth();
    expect(health.ok).toBe(true);
    expect(health.timestamp).toBeDefined();
  });
});

describeE2E('E2E: Complete Booking Flow', () => {
  let testTransactionId: string;
  const testRunId = Date.now().toString(36);

  // Extract inbox name from test email (e.g., "acshuttles-test" from "acshuttles-test@mailinator.com")
  const inbox = config.testEmail.split('@')[0];

  const testPayload: BookingPayload = {
    customer_name: `Test Customer ${testRunId}`,
    customer_email: config.testEmail,
    customer_phone: '555-123-4567',
    start_location: '100 Test Street, Philadelphia, PA 19103',
    end_location: 'Newark Liberty International Airport, Newark, NJ',
    pickup_datetime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
    passengers: 2,
    estimated_distance: '95 miles',
    estimated_duration: '1 hour 45 minutes',
    notes: `E2E Test Run ${testRunId}`,
    idempotency_key: `e2e-test-${testRunId}`,
  };

  it('creates a new booking successfully', async () => {
    const result = await createBooking(testPayload);

    expect(result.ok).toBe(true);
    expect(result.transactionId).toBeDefined();
    expect(result.transactionId!.length).toBe(36);

    testTransactionId = result.transactionId!;
    console.log(`Created booking: ${testTransactionId}`);
  });

  it('sends customer acknowledgment email', async () => {
    if (!config.mailinatorApiKey) {
      console.log('Skipping email check - MAILINATOR_API_KEY not set');
      return;
    }

    // Wait for the acknowledgment email
    const email = await waitForEmail(inbox, 'received', 30000);

    expect(email).not.toBeNull();
    expect(email!.subject.toLowerCase()).toContain('received');
    console.log(`Found acknowledgment email: ${email!.subject}`);
  });

  it('accepts the booking successfully', async () => {
    expect(testTransactionId).toBeDefined();

    const response = await acceptBooking(testTransactionId);
    expect(response.ok).toBe(true);

    const html = await response.text();
    expect(html).toContain('Accepted');
    expect(html).toContain('RIDE CONFIRMED');
    console.log('Booking accepted successfully');
  });

  it('sends customer confirmation email after acceptance', async () => {
    if (!config.mailinatorApiKey) {
      console.log('Skipping email check - MAILINATOR_API_KEY not set');
      return;
    }

    // Wait for the confirmation email
    const email = await waitForEmail(inbox, 'Confirmed', 30000);

    expect(email).not.toBeNull();
    expect(email!.subject).toContain('Confirmed');
    console.log(`Found confirmation email: ${email!.subject}`);
  });

  it('shows already processed when trying to accept again', async () => {
    const response = await acceptBooking(testTransactionId);
    expect(response.ok).toBe(true);

    const html = await response.text();
    expect(html).toContain('Already Processed');
    expect(html).toContain('Accepted');
  });
});

describeE2E('E2E: Denial Flow', () => {
  let testTransactionId: string;
  const testRunId = `deny-${Date.now().toString(36)}`;
  const inbox = config.testEmail.split('@')[0];

  const testPayload: BookingPayload = {
    customer_name: `Deny Test ${testRunId}`,
    customer_email: config.testEmail,
    start_location: '200 Denial Ave, Philadelphia, PA 19103',
    end_location: 'JFK International Airport, New York, NY',
    pickup_datetime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    passengers: 1,
    estimated_distance: '120 miles',
    estimated_duration: '2 hours 30 minutes',
    idempotency_key: `e2e-deny-${testRunId}`,
  };

  it('creates booking for denial test', async () => {
    const result = await createBooking(testPayload);
    expect(result.ok).toBe(true);
    testTransactionId = result.transactionId!;
    console.log(`Created booking for denial: ${testTransactionId}`);
  });

  it('denies the booking successfully', async () => {
    const response = await denyBooking(testTransactionId);
    expect(response.ok).toBe(true);

    const html = await response.text();
    expect(html).toContain('Denied');
    expect(html).toContain('RIDE DECLINED');
  });

  it('sends customer denial email', async () => {
    if (!config.mailinatorApiKey) {
      console.log('Skipping email check - MAILINATOR_API_KEY not set');
      return;
    }

    const email = await waitForEmail(inbox, 'Update', 30000);
    expect(email).not.toBeNull();
    console.log(`Found denial email: ${email!.subject}`);
  });
});

describeE2E('E2E: Security Validation', () => {
  it('rejects requests without API key', async () => {
    const response = await fetch(`${config.workerUrl}/booking`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_name: 'Test' }),
    });

    expect(response.status).toBe(401);
  });

  it('rejects requests with invalid API key', async () => {
    const response = await fetch(`${config.workerUrl}/booking`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'invalid-key',
      },
      body: JSON.stringify({ customer_name: 'Test' }),
    });

    expect(response.status).toBe(401);
  });

  it('rejects invalid payloads', async () => {
    const response = await fetch(`${config.workerUrl}/booking`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.apiKey,
      },
      body: JSON.stringify({ customer_name: 'Only Name' }),
    });

    expect(response.status).toBe(400);
    const body = await response.json() as { ok: boolean; error: string };
    expect(body.ok).toBe(false);
    expect(body.error).toContain('Validation failed');
  });
});

// =============================================================================
// MANUAL EMAIL VALIDATION HELPER
// =============================================================================

/**
 * This test is meant to be run manually to create a booking
 * that you can then check in a real email inbox.
 *
 * Usage:
 *   1. Set E2E_TEST_EMAIL to your own email address
 *   2. Run: E2E_WORKER_URL=... E2E_API_KEY=... E2E_TEST_EMAIL=you@email.com npm run test -- --grep "Manual"
 *   3. Check your email inbox for the acknowledgment email
 *   4. Click Accept/Deny links to test the full flow
 */
describeE2E.skip('Manual: Create Booking for Email Validation', () => {
  it('creates a booking and waits for manual email verification', async () => {
    const payload: BookingPayload = {
      customer_name: 'Manual Test User',
      customer_email: config.testEmail,
      customer_phone: '555-MANUAL',
      start_location: '123 Manual Test Street, Philadelphia, PA 19103',
      end_location: 'Newark Liberty International Airport, Newark, NJ',
      pickup_datetime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      passengers: 2,
      estimated_distance: '95 miles',
      estimated_duration: '1 hour 45 minutes',
      notes: 'Manual E2E test - please check email inbox',
    };

    const result = await createBooking(payload);

    console.log('\n==============================================');
    console.log('MANUAL EMAIL VALIDATION');
    console.log('==============================================');
    console.log(`Transaction ID: ${result.transactionId}`);
    console.log(`Test Email: ${config.testEmail}`);
    console.log('\nPlease check your email inbox for:');
    console.log('1. Customer acknowledgment email');
    console.log('\nThen test accept/deny:');
    console.log(`Accept URL: ${config.workerUrl}/accept/${result.transactionId}`);
    console.log(`Deny URL: ${config.workerUrl}/deny/${result.transactionId}`);
    console.log('==============================================\n');

    expect(result.ok).toBe(true);
  });
});
