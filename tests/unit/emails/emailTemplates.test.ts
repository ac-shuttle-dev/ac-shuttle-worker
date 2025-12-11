/**
 * Email Template Unit Tests
 *
 * Tests for all email templates to ensure:
 * - Correct HTML and plain text generation
 * - Proper escaping of user input (XSS prevention)
 * - Required fields are present
 * - Visual type indicators are correct
 */

import { describe, it, expect } from 'vitest';
import {
  generateCustomerSubmissionAckEmail,
  generateOwnerNotificationEmail,
  generateCustomerConfirmationEmail,
  generateCustomerDenialEmail,
  generateCustomerReminderEmail,
  generateOwnerDeliveryNotificationEmail,
} from '../../../src/templates/emails';

describe('Customer Submission Acknowledgment Email', () => {
  const baseData = {
    customerName: 'John Doe',
    customerEmail: 'john@example.com',
    startLocation: '123 Main St, Philadelphia, PA',
    endLocation: 'Newark Airport, NJ',
    pickupTime: '10:30 AM',
    pickupDate: 'February 20, 2025',
    passengers: '2',
    bookingRef: 'ABC123XYZ',
    contactPhone: '(609) 555-0123',
    contactEmail: 'contact@acshuttles.com',
  };

  it('generates HTML with required elements', () => {
    const { html } = generateCustomerSubmissionAckEmail(baseData);

    // Check visual type indicator
    expect(html).toContain('REQUEST RECEIVED');
    expect(html).toContain('#3b82f6'); // Blue indicator color

    // Check customer name
    expect(html).toContain('John Doe');

    // Check trip details
    expect(html).toContain('123 Main St, Philadelphia, PA');
    expect(html).toContain('Newark Airport, NJ');
    expect(html).toContain('10:30 AM');
    expect(html).toContain('February 20, 2025');

    // Check booking reference
    expect(html).toContain('ABC123XYZ');

    // Check contact info
    expect(html).toContain('(609) 555-0123');
    expect(html).toContain('contact@acshuttles.com');
  });

  it('generates plain text with required elements', () => {
    const { text } = generateCustomerSubmissionAckEmail(baseData);

    expect(text).toContain('REQUEST RECEIVED');
    expect(text).toContain('John Doe');
    expect(text).toContain('123 Main St, Philadelphia, PA');
    expect(text).toContain('Newark Airport, NJ');
    expect(text).toContain('ABC123XYZ');
  });

  it('escapes HTML in user input (XSS prevention)', () => {
    const xssData = {
      ...baseData,
      customerName: '<script>alert("xss")</script>',
      startLocation: '<img src=x>',
    };

    const { html } = generateCustomerSubmissionAckEmail(xssData);

    // Should not contain unescaped HTML tags that could execute
    expect(html).not.toContain('<script>alert');
    expect(html).not.toContain('<img src');

    // Should contain escaped versions (< and > are escaped)
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;img');
  });

  it('handles optional passengers field', () => {
    const dataWithoutPassengers = { ...baseData, passengers: undefined };
    const { html } = generateCustomerSubmissionAckEmail(dataWithoutPassengers);

    // Should default to 1 passenger
    expect(html).toContain('>1</p>'); // Looking for the passengers display
  });
});

describe('Owner Notification Email', () => {
  const baseData = {
    customerName: 'Jane Smith',
    customerEmail: 'jane@example.com',
    customerPhone: '(215) 555-9876',
    startLocation: '456 Oak Ave, Cherry Hill, NJ',
    endLocation: 'Atlantic City Airport',
    pickupTime: '2:00 PM',
    pickupDate: 'March 15, 2025',
    passengers: '4',
    estimatedDuration: '45 mins',
    estimatedDistance: '35 miles',
    notes: 'Need extra luggage space',
    bookingRef: 'XYZ789ABC',
    acceptUrl: 'https://worker.dev/accept/txn123',
    denyUrl: 'https://worker.dev/deny/txn123',
    mapUrl: 'https://maps.google.com/...',
  };

  it('generates HTML with required elements', () => {
    const { html } = generateOwnerNotificationEmail(baseData);

    // Check visual type indicator
    expect(html).toContain('ACTION REQUIRED');
    expect(html).toContain('#f59e0b'); // Amber indicator color

    // Check customer details
    expect(html).toContain('Jane Smith');
    expect(html).toContain('jane@example.com');
    expect(html).toContain('(215) 555-9876');

    // Check trip details
    expect(html).toContain('456 Oak Ave, Cherry Hill, NJ');
    expect(html).toContain('Atlantic City Airport');
    expect(html).toContain('2:00 PM');
    expect(html).toContain('March 15, 2025');
    expect(html).toContain('4'); // passengers
    expect(html).toContain('45 mins');
    expect(html).toContain('35 miles');

    // Check action buttons
    expect(html).toContain('Confirm Ride');
    expect(html).toContain('Decline Ride');
    expect(html).toContain('https://worker.dev/accept/txn123');
    expect(html).toContain('https://worker.dev/deny/txn123');

    // Check notes
    expect(html).toContain('Need extra luggage space');
  });

  it('generates HTML without notes when not provided', () => {
    const dataWithoutNotes = { ...baseData, notes: undefined };
    const { html } = generateOwnerNotificationEmail(dataWithoutNotes);

    expect(html).not.toContain('Special Instructions');
    expect(html).not.toContain('Need extra luggage space');
  });

  it('handles null customer phone gracefully', () => {
    const dataWithoutPhone = { ...baseData, customerPhone: null };
    const { html } = generateOwnerNotificationEmail(dataWithoutPhone);

    expect(html).toContain('No phone provided');
  });

  it('escapes HTML in user input', () => {
    const xssData = {
      ...baseData,
      customerName: '<script>alert("xss")</script>',
      notes: '<img src=x>',
    };

    const { html } = generateOwnerNotificationEmail(xssData);

    // The < and > are escaped, preventing HTML injection
    expect(html).not.toContain('<script>alert');
    expect(html).not.toContain('<img src');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('Customer Confirmation Email', () => {
  const baseData = {
    customerName: 'Bob Wilson',
    customerEmail: 'bob@example.com',
    startLocation: '789 Pine St, Trenton, NJ',
    endLocation: 'Philadelphia International Airport',
    pickupTime: '6:00 AM',
    pickupDate: 'April 1, 2025',
    passengers: '3',
    estimatedDuration: '30 mins',
    driverName: 'Mike Driver',
    driverPhone: '(609) 555-0000',
    driverEmail: 'driver@acshuttles.com',
    notes: 'Early morning flight - Delta 123',
    bookingRef: 'CONF456',
    mapUrl: 'https://maps.google.com/...',
  };

  it('generates HTML with ticket-style design', () => {
    const { html } = generateCustomerConfirmationEmail(baseData);

    // Check visual type indicator
    expect(html).toContain('RIDE CONFIRMED');
    expect(html).toContain('#14b8a6'); // Teal/success indicator color

    // Check ticket-style elements
    expect(html).toContain('From');
    expect(html).toContain('To');

    // Check location codes (3-letter codes like airport codes)
    expect(html).toMatch(/[A-Z]{3}/); // Should have location codes

    // Check customer name
    expect(html).toContain('Bob Wilson');

    // Check driver info
    expect(html).toContain('Mike Driver');
    expect(html).toContain('(609) 555-0000');
    expect(html).toContain('driver@acshuttles.com');

    // Check booking reference
    expect(html).toContain('CONF456');
  });

  it('generates plain text with all details', () => {
    const { text } = generateCustomerConfirmationEmail(baseData);

    expect(text).toContain('RIDE CONFIRMED');
    expect(text).toContain('Bob Wilson');
    expect(text).toContain('Mike Driver');
    expect(text).toContain('789 Pine St, Trenton, NJ');
    expect(text).toContain('Philadelphia International Airport');
    expect(text).toContain('CONF456');
  });

  it('includes pickup tips', () => {
    const { html } = generateCustomerConfirmationEmail(baseData);

    expect(html).toContain('Pickup Tips');
    expect(html).toContain('5-10 minutes before pickup');
    expect(html).toContain('Driver will call');
  });

  it('handles missing notes', () => {
    const dataWithoutNotes = { ...baseData, notes: undefined };
    const { html } = generateCustomerConfirmationEmail(dataWithoutNotes);

    expect(html).not.toContain('Trip Notes');
  });

  it('handles missing map URL', () => {
    const dataWithoutMap = { ...baseData, mapUrl: undefined };
    const { html } = generateCustomerConfirmationEmail(dataWithoutMap);

    expect(html).not.toContain('View Route on Maps');
  });
});

describe('Customer Denial Email', () => {
  const baseData = {
    customerName: 'Alice Brown',
    customerEmail: 'alice@example.com',
    startLocation: '321 Elm St, Camden, NJ',
    endLocation: 'JFK Airport, NY',
    pickupTime: '3:00 PM',
    pickupDate: 'May 10, 2025',
    passengers: '2',
    contactPhone: '(609) 555-0123',
    contactEmail: 'support@acshuttles.com',
    reason: 'scheduling conflicts',
    bookingRef: 'DEN789',
  };

  it('generates HTML with denial indicator', () => {
    const { html } = generateCustomerDenialEmail(baseData);

    // Check visual type indicator
    expect(html).toContain('UNABLE TO ACCOMMODATE');
    expect(html).toContain('#ef4444'); // Red indicator color

    // Check empathetic message
    expect(html).toContain("We're sorry");
    expect(html).toContain('Alice Brown');

    // Check reason
    expect(html).toContain('scheduling conflicts');

    // Check original request is shown with strikethrough styling
    expect(html).toContain('Your Original Request');
    expect(html).toContain('line-through');

    // Check alternative options
    expect(html).toContain('We may still be able to help');
    expect(html).toContain('Alternative pickup times');

    // Check contact info
    expect(html).toContain('(609) 555-0123');
    expect(html).toContain('support@acshuttles.com');
  });

  it('uses default reason when not provided', () => {
    const dataWithoutReason = { ...baseData, reason: undefined };
    const { html } = generateCustomerDenialEmail(dataWithoutReason);

    expect(html).toContain('scheduling conflicts'); // Default reason
  });

  it('generates plain text with all details', () => {
    const { text } = generateCustomerDenialEmail(baseData);

    expect(text).toContain('UNABLE TO ACCOMMODATE');
    expect(text).toContain('Alice Brown');
    expect(text).toContain('scheduling conflicts');
    expect(text).toContain('DEN789');
  });
});

describe('Customer Reminder Email', () => {
  const baseData = {
    customerName: 'Charlie Davis',
    customerEmail: 'charlie@example.com',
    startLocation: '555 Maple Dr, Princeton, NJ',
    endLocation: 'LaGuardia Airport, NY',
    pickupTime: '8:00 AM',
    pickupDate: 'June 5, 2025',
    passengers: '1',
    driverName: 'Steve Driver',
    driverPhone: '(609) 555-1111',
    driverEmail: 'steve@acshuttles.com',
    bookingRef: 'REM123',
  };

  it('generates HTML with reminder indicator', () => {
    const { html } = generateCustomerReminderEmail(baseData);

    // Check visual type indicator
    expect(html).toContain('TRIP REMINDER');
    expect(html).toContain('#14b8a6'); // Teal indicator color

    // Check reminder message
    expect(html).toContain('Your ride is coming up');
    expect(html).toContain('Charlie Davis');

    // Check pickup time highlighted
    expect(html).toContain('Pickup Time');
    expect(html).toContain('8:00 AM');
    expect(html).toContain('June 5, 2025');

    // Check driver info is prominent
    expect(html).toContain('Your Driver');
    expect(html).toContain('Steve Driver');
    expect(html).toContain('(609) 555-1111');

    // Check quick reminders
    expect(html).toContain('Quick Reminders');
    expect(html).toContain('5-10 minutes before pickup');
  });

  it('generates plain text reminder', () => {
    const { text } = generateCustomerReminderEmail(baseData);

    expect(text).toContain('TRIP REMINDER');
    expect(text).toContain('Charlie Davis');
    expect(text).toContain('Steve Driver');
    expect(text).toContain('REM123');
  });
});

describe('Owner Delivery Notification Email', () => {
  const baseData = {
    customerName: 'Diana Evans',
    customerEmail: 'diana@example.com',
    startLocation: '777 Cedar Ln, Newark, NJ',
    endLocation: 'Atlantic City, NJ',
    pickupTime: '11:00 AM',
    pickupDate: 'July 20, 2025',
    notificationType: 'accepted' as const,
    deliveredAt: '2025-07-15T10:30:00Z',
    bookingRef: 'DEL456',
    transactionId: 'txn-abc-123-xyz',
  };

  it('generates HTML for accepted notification', () => {
    const { html } = generateOwnerDeliveryNotificationEmail(baseData);

    // Check visual type indicator
    expect(html).toContain('DELIVERY CONFIRMED');
    expect(html).toContain('#64748b'); // Slate indicator color

    // Check status badge
    expect(html).toContain('Booking Accepted');
    expect(html).toContain('#14b8a6'); // Green for accepted

    // Check customer info
    expect(html).toContain('Diana Evans');
    expect(html).toContain('diana@example.com');

    // Check delivery details
    expect(html).toContain('DEL456');
    expect(html).toContain('txn-abc-123-xyz');
  });

  it('generates HTML for denied notification', () => {
    const deniedData = { ...baseData, notificationType: 'denied' as const };
    const { html } = generateOwnerDeliveryNotificationEmail(deniedData);

    expect(html).toContain('Booking Declined');
    expect(html).toContain('#ef4444'); // Red for declined
  });

  it('generates plain text with delivery details', () => {
    const { text } = generateOwnerDeliveryNotificationEmail(baseData);

    expect(text).toContain('DELIVERY CONFIRMED');
    expect(text).toContain('Booking Accepted');
    expect(text).toContain('Diana Evans');
    expect(text).toContain('DEL456');
  });
});

describe('Email Template Dark Mode Support', () => {
  it('includes dark mode CSS media query', () => {
    const { html } = generateCustomerSubmissionAckEmail({
      customerName: 'Test',
      customerEmail: 'test@test.com',
      startLocation: 'A',
      endLocation: 'B',
      pickupTime: '10:00 AM',
      pickupDate: 'Jan 1',
      bookingRef: 'REF',
      contactPhone: '555-0000',
      contactEmail: 'test@test.com',
    });

    expect(html).toContain('prefers-color-scheme: dark');
    expect(html).toContain('.email-card');
    expect(html).toContain('.text-dark');
    expect(html).toContain('.text-muted');
  });
});

describe('Email Template Responsive Design', () => {
  it('includes responsive CSS media query', () => {
    const { html } = generateCustomerSubmissionAckEmail({
      customerName: 'Test',
      customerEmail: 'test@test.com',
      startLocation: 'A',
      endLocation: 'B',
      pickupTime: '10:00 AM',
      pickupDate: 'Jan 1',
      bookingRef: 'REF',
      contactPhone: '555-0000',
      contactEmail: 'test@test.com',
    });

    expect(html).toContain('max-width: 620px');
    expect(html).toContain('.stack-column');
    expect(html).toContain('.padding-mobile');
  });
});

describe('Email Template Anti-Spam Compliance', () => {
  it('includes preheader text (hidden preview text)', () => {
    const { html } = generateCustomerSubmissionAckEmail({
      customerName: 'Test',
      customerEmail: 'test@test.com',
      startLocation: 'A',
      endLocation: 'B',
      pickupTime: '10:00 AM',
      pickupDate: 'Jan 1',
      bookingRef: 'REF',
      contactPhone: '555-0000',
      contactEmail: 'test@test.com',
    });

    // Preheader is hidden div with preview text
    expect(html).toContain('display: none');
    expect(html).toContain('max-height: 0px');
    expect(html).toContain('overflow: hidden');
  });

  it('includes proper DOCTYPE', () => {
    const { html } = generateCustomerSubmissionAckEmail({
      customerName: 'Test',
      customerEmail: 'test@test.com',
      startLocation: 'A',
      endLocation: 'B',
      pickupTime: '10:00 AM',
      pickupDate: 'Jan 1',
      bookingRef: 'REF',
      contactPhone: '555-0000',
      contactEmail: 'test@test.com',
    });

    expect(html).toContain('<!DOCTYPE html');
  });

  it('includes footer with contact info', () => {
    const { html } = generateCustomerSubmissionAckEmail({
      customerName: 'Test',
      customerEmail: 'test@test.com',
      startLocation: 'A',
      endLocation: 'B',
      pickupTime: '10:00 AM',
      pickupDate: 'Jan 1',
      bookingRef: 'REF',
      contactPhone: '555-0000',
      contactEmail: 'test@test.com',
    });

    expect(html).toContain('AC Shuttles - Private Shuttle Service');
    expect(html).toContain('Serving NJ, Philadelphia');
  });
});
