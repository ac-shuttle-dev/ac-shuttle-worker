/**
 * Customer Trip Reminder Email Template
 *
 * Sent within 24 hours of the reservation date.
 * If reservation date <= confirmation date, sent together with confirmation.
 *
 * Visual Theme: Teal (Trip Reminder)
 * - Clear visual indicator at top showing "TRIP REMINDER"
 * - Ticket-style design with essential trip info
 * - Driver contact prominently displayed
 * - Dark mode support via CSS media queries
 * - Anti-spam compliant structure
 */

import {
  BRAND_COLORS,
  getEmailHead,
  getEmailResetStyles,
  getEmailFooter,
  getPreheader,
  getEmailTypeIndicator,
  getEmailLogoHeader,
  generateLocationCode,
  escapeHtml
} from './utils';

export interface CustomerReminderData {
  // Trip details
  startLocation: string;
  endLocation: string;
  pickupTime: string;
  pickupDate: string;
  passengers: string;
  mapUrl?: string;

  // Customer details
  customerName: string;
  customerEmail: string;

  // Driver details
  driverName: string;
  driverPhone: string;
  driverEmail: string;

  // Additional info
  bookingRef: string;
}

export function generateCustomerReminderEmail(data: CustomerReminderData): { html: string; text: string } {
  // Generate location codes for ticket-style display
  const fromCode = generateLocationCode(data.startLocation);
  const toCode = generateLocationCode(data.endLocation);

  const safeData = {
    customerName: escapeHtml(data.customerName),
    startLocation: escapeHtml(data.startLocation),
    endLocation: escapeHtml(data.endLocation),
    pickupTime: escapeHtml(data.pickupTime),
    pickupDate: escapeHtml(data.pickupDate),
    passengers: escapeHtml(data.passengers),
    driverName: escapeHtml(data.driverName),
    driverPhone: escapeHtml(data.driverPhone),
    driverEmail: escapeHtml(data.driverEmail),
    bookingRef: escapeHtml(data.bookingRef),
    mapUrl: data.mapUrl || '',
    fromCode,
    toCode,
  };

  const html = `${getEmailHead('Trip Reminder - AC Shuttles')}
${getEmailResetStyles()}
</head>
<body style="margin: 0; padding: 0; background-color: ${BRAND_COLORS.gray100};">
    ${getPreheader(`Reminder: Your ride is coming up on ${safeData.pickupDate} at ${safeData.pickupTime}. Ref: ${safeData.bookingRef}`)}

    <!-- Type Indicator -->
    ${getEmailTypeIndicator('reminder')}

    <!-- Email Body -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" class="email-body-bg" style="background-color: ${BRAND_COLORS.gray100};">
        <tr>
            <td style="padding: 0 20px 40px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto;" class="email-container">

                    ${getEmailLogoHeader()}

                    <!-- Main Card -->
                    <tr>
                        <td>
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" class="email-card" style="background-color: ${BRAND_COLORS.white}; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">

                                <!-- Header Content -->
                                <tr>
                                    <td class="padding-mobile" style="padding: 32px 32px 24px;">
                                        <h1 class="text-dark" style="margin: 0 0 8px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 24px; font-weight: 700; color: ${BRAND_COLORS.gray900}; line-height: 1.3;">
                                            Your ride is coming up!
                                        </h1>
                                        <p class="text-muted" style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; color: ${BRAND_COLORS.gray600}; line-height: 1.5;">
                                            Hi ${safeData.customerName}, just a friendly reminder about your upcoming trip.
                                        </p>
                                    </td>
                                </tr>

                                <!-- Compact Ticket Section -->
                                <tr>
                                    <td class="padding-mobile" style="padding: 0 32px 24px;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: ${BRAND_COLORS.gray900}; border-radius: 12px; overflow: hidden;">

                                            <!-- Route Display -->
                                            <tr>
                                                <td style="padding: 24px;">
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                        <tr>
                                                            <td width="40%" valign="top">
                                                                <p style="margin: 0 0 4px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 10px; font-weight: 600; color: ${BRAND_COLORS.gray400}; text-transform: uppercase; letter-spacing: 1px;">
                                                                    From
                                                                </p>
                                                                <p style="margin: 0 0 6px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 28px; font-weight: 800; color: ${BRAND_COLORS.white}; letter-spacing: 2px;">
                                                                    ${safeData.fromCode}
                                                                </p>
                                                                <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; color: ${BRAND_COLORS.gray400}; line-height: 1.4;">
                                                                    ${safeData.startLocation}
                                                                </p>
                                                            </td>
                                                            <td width="20%" valign="middle" style="text-align: center;">
                                                                <div style="color: ${BRAND_COLORS.primary}; font-size: 24px;">&#10132;</div>
                                                            </td>
                                                            <td width="40%" valign="top" style="text-align: right;">
                                                                <p style="margin: 0 0 4px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 10px; font-weight: 600; color: ${BRAND_COLORS.gray400}; text-transform: uppercase; letter-spacing: 1px;">
                                                                    To
                                                                </p>
                                                                <p style="margin: 0 0 6px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 28px; font-weight: 800; color: ${BRAND_COLORS.white}; letter-spacing: 2px;">
                                                                    ${safeData.toCode}
                                                                </p>
                                                                <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; color: ${BRAND_COLORS.gray400}; line-height: 1.4;">
                                                                    ${safeData.endLocation}
                                                                </p>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>

                                            <!-- Pickup Time Highlight -->
                                            <tr>
                                                <td style="padding: 0 24px 24px;">
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: ${BRAND_COLORS.primary}; border-radius: 8px;">
                                                        <tr>
                                                            <td style="padding: 16px; text-align: center;">
                                                                <p style="margin: 0 0 4px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 10px; font-weight: 600; color: ${BRAND_COLORS.successLight}; text-transform: uppercase; letter-spacing: 1px;">
                                                                    Pickup Time
                                                                </p>
                                                                <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 24px; font-weight: 800; color: ${BRAND_COLORS.white};">
                                                                    ${safeData.pickupTime} &middot; ${safeData.pickupDate}
                                                                </p>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>

                                        </table>
                                    </td>
                                </tr>

                                <!-- Driver Contact - Prominent -->
                                <tr>
                                    <td class="padding-mobile" style="padding: 0 32px 24px;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" class="email-card-secondary border-light" style="background-color: ${BRAND_COLORS.successLight}; border-radius: 10px; border: 1px solid ${BRAND_COLORS.primary}; border-left: 4px solid ${BRAND_COLORS.primary};">
                                            <tr>
                                                <td style="padding: 18px 20px;">
                                                    <p style="margin: 0 0 12px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: ${BRAND_COLORS.successDark};">
                                                        Your Driver
                                                    </p>
                                                    <p class="text-dark" style="margin: 0 0 8px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 16px; font-weight: 600; color: ${BRAND_COLORS.gray900};">
                                                        ${safeData.driverName}
                                                    </p>
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                        <tr>
                                                            <td style="padding-top: 8px;">
                                                                <a href="tel:${safeData.driverPhone}" class="button-link" style="display: inline-block; padding: 12px 24px; background-color: ${BRAND_COLORS.primary}; color: ${BRAND_COLORS.white}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 8px;">
                                                                    Call: ${safeData.driverPhone}
                                                                </a>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>

                                <!-- Quick Tips -->
                                <tr>
                                    <td class="padding-mobile" style="padding: 0 32px 24px;">
                                        <p class="text-dark" style="margin: 0 0 12px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; font-weight: 600; color: ${BRAND_COLORS.gray900};">
                                            Quick Reminders
                                        </p>
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                            <tr>
                                                <td class="text-muted" style="padding: 5px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: ${BRAND_COLORS.gray600};">
                                                    <span style="color: ${BRAND_COLORS.primary}; margin-right: 8px;">&#10003;</span>Be ready 5-10 minutes before pickup
                                                </td>
                                            </tr>
                                            <tr>
                                                <td class="text-muted" style="padding: 5px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: ${BRAND_COLORS.gray600};">
                                                    <span style="color: ${BRAND_COLORS.primary}; margin-right: 8px;">&#10003;</span>Driver will call when approaching
                                                </td>
                                            </tr>
                                            <tr>
                                                <td class="text-muted" style="padding: 5px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: ${BRAND_COLORS.gray600};">
                                                    <span style="color: ${BRAND_COLORS.primary}; margin-right: 8px;">&#10003;</span>Wait at the building entrance
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>

                                ${safeData.mapUrl ? `
                                <!-- Map Button -->
                                <tr>
                                    <td class="padding-mobile" style="padding: 0 32px 24px;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                            <tr>
                                                <td style="text-align: center;">
                                                    <a href="${safeData.mapUrl}" target="_blank" rel="noopener noreferrer" class="button-link button-mobile" style="display: inline-block; padding: 14px 28px; background-color: ${BRAND_COLORS.white}; color: ${BRAND_COLORS.primary}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 10px; border: 2px solid ${BRAND_COLORS.primary};">
                                                        View Route on Maps
                                                    </a>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                                ` : ''}

                                <!-- Reference Footer -->
                                <tr>
                                    <td class="padding-mobile" style="padding: 24px 32px 32px;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" class="email-ref-badge" style="background-color: ${BRAND_COLORS.gray900}; border-radius: 10px;">
                                            <tr>
                                                <td style="padding: 18px 24px; text-align: center;">
                                                    <p class="text-muted" style="margin: 0 0 6px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 10px; font-weight: 600; color: ${BRAND_COLORS.gray400}; text-transform: uppercase; letter-spacing: 1.5px;">
                                                        Booking Reference
                                                    </p>
                                                    <p class="text-ref" style="margin: 0; font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace; font-size: 18px; font-weight: 700; color: ${BRAND_COLORS.primary}; letter-spacing: 3px;">
                                                        ${safeData.bookingRef}
                                                    </p>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>

                            </table>
                        </td>
                    </tr>

                    <!-- Help Text -->
                    <tr>
                        <td style="padding: 24px 20px 0; text-align: center;">
                            <p class="text-muted" style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: ${BRAND_COLORS.gray500};">
                                We look forward to seeing you!
                            </p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>

    ${getEmailFooter(safeData.driverPhone, safeData.driverEmail)}

</body>
</html>`;

  const text = `AC SHUTTLES - TRIP REMINDER

Your ride is coming up!

Hi ${data.customerName}, just a friendly reminder about your upcoming trip.

PICKUP TIME
===========
${data.pickupTime} on ${data.pickupDate}

ROUTE
=====
${fromCode} --> ${toCode}
From: ${data.startLocation}
To: ${data.endLocation}

Passengers: ${data.passengers}

YOUR DRIVER
===========
${data.driverName}
Phone: ${data.driverPhone}
Email: ${data.driverEmail}

QUICK REMINDERS
===============
- Be ready 5-10 minutes before pickup
- Driver will call when approaching
- Wait at the building entrance

${data.mapUrl ? `VIEW ROUTE: ${data.mapUrl}

` : ''}BOOKING REFERENCE: ${data.bookingRef}

We look forward to seeing you!

---
AC Shuttles - Private Shuttle Service
Serving NJ, Philadelphia & NYC Area`;

  return { html, text };
}
