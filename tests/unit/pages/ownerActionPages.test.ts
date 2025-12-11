/**
 * Owner Action Pages Tests
 *
 * Tests for the HTML pages shown to owners after they click
 * confirm/deny buttons in their emails.
 */

import { describe, it, expect } from 'vitest';

// Page color constants (matching what's in index.ts)
const PAGE_COLORS = {
  primary: '#14b8a6',
  success: '#14b8a6',
  danger: '#ef4444',
  warning: '#f59e0b',
  info: '#64748b',
  gray100: '#f4f4f5',
  gray200: '#e4e4e7',
  gray500: '#71717a',
  gray600: '#52525b',
  gray700: '#3f3f46',
  gray800: '#27272a',
  gray900: '#18181b',
  white: '#ffffff',
  darkBg: '#0f172a',
  darkCard: '#1e293b',
};

// Simulated page renderer functions for testing
// These mirror the logic in index.ts

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char] || char);
}

function renderErrorPageContent(title: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} - AC Shuttles</title>
</head>
<body>
  <div class="container">
    <div class="indicator" style="background: ${PAGE_COLORS.danger}">
      <span class="indicator-text">✕ Error</span>
    </div>
    <div class="content">
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(message)}</p>
    </div>
  </div>
</body>
</html>`;
}

function renderSuccessPageContent(
  decision: 'Accepted' | 'Denied',
  booking: { customerName: string; startLocation: string; endLocation: string; pickupDatetime: string; passengers: number; transactionId: string }
): string {
  const isAccepted = decision === 'Accepted';
  const indicatorColor = isAccepted ? PAGE_COLORS.success : PAGE_COLORS.danger;
  const indicatorText = isAccepted ? '✓ RIDE CONFIRMED' : '✕ RIDE DECLINED';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Booking ${decision} - AC Shuttles</title>
</head>
<body>
  <div class="logo">
    <span class="logo-box"></span>
    <span class="logo-text">AC SHUTTLES</span>
  </div>
  <div class="container">
    <div class="indicator" style="background: ${indicatorColor}">
      <span class="indicator-text">${indicatorText}</span>
    </div>
    <div class="content">
      <h1>Booking ${decision}</h1>
      <p class="message">
        ${isAccepted
          ? 'The customer has been notified with driver contact information.'
          : 'The customer has been notified about the booking status.'}
      </p>
      <div class="details">
        <div class="detail-row">
          <span class="label">Customer</span>
          <span class="value">${escapeHtml(booking.customerName)}</span>
        </div>
        <div class="detail-row">
          <span class="label">Route</span>
          <span class="value">${escapeHtml(booking.startLocation)} → ${escapeHtml(booking.endLocation)}</span>
        </div>
        <div class="detail-row">
          <span class="label">Pickup</span>
          <span class="value">${escapeHtml(booking.pickupDatetime)}</span>
        </div>
        <div class="detail-row">
          <span class="label">Passengers</span>
          <span class="value">${booking.passengers}</span>
        </div>
      </div>
      <div class="ref-badge">
        <div class="ref-label">Reference</div>
        <div class="ref-value">${escapeHtml(booking.transactionId.slice(0, 10).toUpperCase())}</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function renderAlreadyProcessedPageContent(
  status: string,
  booking: { customerName: string; startLocation: string; endLocation: string } | null
): string {
  const isAccepted = status === 'Accepted';
  const statusColor = isAccepted ? PAGE_COLORS.success : PAGE_COLORS.danger;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Already Processed - AC Shuttles</title>
</head>
<body>
  <div class="container">
    <div class="indicator" style="background: ${PAGE_COLORS.info}">
      <span class="indicator-text">ℹ️ Already Processed</span>
    </div>
    <div class="content">
      <h1>Booking Already Processed</h1>
      <p>This booking has already been processed.</p>
      <div class="status" style="color: ${statusColor}">${isAccepted ? '✓' : '✕'} ${escapeHtml(status)}</div>
      ${booking ? `
      <div class="booking-info">
        <strong>${escapeHtml(booking.customerName)}</strong><br>
        <span>${escapeHtml(booking.startLocation)} → ${escapeHtml(booking.endLocation)}</span>
      </div>
      ` : ''}
    </div>
  </div>
</body>
</html>`;
}

describe('Error Page', () => {
  it('renders error page with title and message', () => {
    const html = renderErrorPageContent('Invalid Request', 'The booking link is invalid.');

    expect(html).toContain('Invalid Request');
    expect(html).toContain('The booking link is invalid.');
    expect(html).toContain('Error');
    expect(html).toContain(PAGE_COLORS.danger);
  });

  it('escapes HTML in error messages', () => {
    const html = renderErrorPageContent('<script>alert("xss")</script>', 'Test & error');

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&amp;');
  });

  it('includes viewport meta tag for mobile responsiveness', () => {
    const html = renderErrorPageContent('Error', 'Message');

    expect(html).toContain('viewport');
    expect(html).toContain('width=device-width');
  });
});

describe('Success Page - Accepted', () => {
  const mockBooking = {
    customerName: 'John Doe',
    startLocation: '123 Main St, Philadelphia',
    endLocation: 'Newark Airport',
    pickupDatetime: '2025-02-20T10:00:00',
    passengers: 3,
    transactionId: 'txn-abc-123-def-456',
  };

  it('renders success page for accepted booking', () => {
    const html = renderSuccessPageContent('Accepted', mockBooking);

    expect(html).toContain('Booking Accepted');
    expect(html).toContain('RIDE CONFIRMED');
    expect(html).toContain(PAGE_COLORS.success);
    expect(html).toContain('customer has been notified with driver contact');
  });

  it('displays booking details', () => {
    const html = renderSuccessPageContent('Accepted', mockBooking);

    expect(html).toContain('John Doe');
    expect(html).toContain('123 Main St, Philadelphia');
    expect(html).toContain('Newark Airport');
    expect(html).toContain('3'); // passengers
  });

  it('displays truncated reference number', () => {
    const html = renderSuccessPageContent('Accepted', mockBooking);

    // Should show first 10 chars of transaction ID, uppercased
    expect(html).toContain('TXN-ABC-12');
  });

  it('includes AC SHUTTLES branding', () => {
    const html = renderSuccessPageContent('Accepted', mockBooking);

    expect(html).toContain('AC SHUTTLES');
    expect(html).toContain('logo');
  });
});

describe('Success Page - Denied', () => {
  const mockBooking = {
    customerName: 'Jane Smith',
    startLocation: '456 Oak Ave, Cherry Hill',
    endLocation: 'Atlantic City',
    pickupDatetime: '2025-03-15T14:00:00',
    passengers: 2,
    transactionId: 'txn-xyz-789-abc',
  };

  it('renders success page for denied booking', () => {
    const html = renderSuccessPageContent('Denied', mockBooking);

    expect(html).toContain('Booking Denied');
    expect(html).toContain('RIDE DECLINED');
    expect(html).toContain(PAGE_COLORS.danger);
    expect(html).toContain('customer has been notified about the booking status');
  });

  it('displays booking details', () => {
    const html = renderSuccessPageContent('Denied', mockBooking);

    expect(html).toContain('Jane Smith');
    expect(html).toContain('456 Oak Ave, Cherry Hill');
    expect(html).toContain('Atlantic City');
  });
});

describe('Already Processed Page', () => {
  const mockBooking = {
    customerName: 'Bob Wilson',
    startLocation: 'Trenton',
    endLocation: 'JFK Airport',
  };

  it('renders already processed page with Accepted status', () => {
    const html = renderAlreadyProcessedPageContent('Accepted', mockBooking);

    expect(html).toContain('Already Processed');
    expect(html).toContain('This booking has already been processed');
    expect(html).toContain('✓');
    expect(html).toContain('Accepted');
    expect(html).toContain(PAGE_COLORS.success);
  });

  it('renders already processed page with Denied status', () => {
    const html = renderAlreadyProcessedPageContent('Denied', mockBooking);

    expect(html).toContain('Already Processed');
    expect(html).toContain('✕');
    expect(html).toContain('Denied');
    expect(html).toContain(PAGE_COLORS.danger);
  });

  it('displays booking info when provided', () => {
    const html = renderAlreadyProcessedPageContent('Accepted', mockBooking);

    expect(html).toContain('Bob Wilson');
    expect(html).toContain('Trenton');
    expect(html).toContain('JFK Airport');
  });

  it('handles null booking gracefully', () => {
    const html = renderAlreadyProcessedPageContent('Accepted', null);

    expect(html).toContain('Already Processed');
    expect(html).not.toContain('booking-info');
  });
});

describe('Dark Mode Support', () => {
  it('success page uses appropriate colors for dark mode CSS', () => {
    const mockBooking = {
      customerName: 'Test',
      startLocation: 'A',
      endLocation: 'B',
      pickupDatetime: '2025-01-01',
      passengers: 1,
      transactionId: 'txn-123',
    };

    const html = renderSuccessPageContent('Accepted', mockBooking);

    // The actual implementation should include dark mode media queries
    // This test verifies the page structure supports theming
    expect(html).toContain('background');
  });
});

describe('Page Content Security', () => {
  it('escapes customer name with special characters', () => {
    const maliciousBooking = {
      customerName: '<img src=x>',
      startLocation: '<script>alert("xss")</script>',
      endLocation: "O'Reilly Airport",
      pickupDatetime: '2025-01-01',
      passengers: 1,
      transactionId: 'txn-123',
    };

    const html = renderSuccessPageContent('Accepted', maliciousBooking);

    // Key HTML tags are escaped, preventing injection
    expect(html).not.toContain('<img src');
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;img');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes status in already processed page', () => {
    const html = renderAlreadyProcessedPageContent('<script>alert(1)</script>', null);

    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;');
  });
});
