/**
 * Customer Confirmation Email Template
 *
 * Sent when a booking is confirmed/accepted by the owner.
 *
 * Visual Theme: Green/Teal (Ride Confirmed)
 * - Clear visual indicator at top showing "RIDE CONFIRMED"
 * - Ticket-style design with boarding pass aesthetic
 * - Location codes like airport tickets
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

export interface CustomerConfirmationData {
  // Trip details
  startLocation: string;
  endLocation: string;
  pickupTime: string;
  pickupDate: string;
  passengers: string;
  estimatedDuration: string;
  mapUrl?: string;

  // Customer details
  customerName: string;
  customerEmail: string;

  // Driver details
  driverName: string;
  driverPhone: string;
  driverEmail: string;

  // Additional info
  notes?: string;
  bookingRef: string;
}

export function generateCustomerConfirmationEmail(data: CustomerConfirmationData): { html: string; text: string } {
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
    estimatedDuration: escapeHtml(data.estimatedDuration),
    driverName: escapeHtml(data.driverName),
    driverPhone: escapeHtml(data.driverPhone),
    driverEmail: escapeHtml(data.driverEmail),
    notes: data.notes ? escapeHtml(data.notes) : '',
    bookingRef: escapeHtml(data.bookingRef),
    mapUrl: data.mapUrl || '',
    fromCode,
    toCode,
  };

  const html = `${getEmailHead('Ride Confirmed - AC Shuttles')}
${getEmailResetStyles()}
</head>
<body style="margin: 0; padding: 0; background-color: ${BRAND_COLORS.gray100};">
    ${getPreheader(`Your ride is confirmed for ${safeData.pickupDate} at ${safeData.pickupTime}. Booking: ${safeData.bookingRef}`)}

    <!-- Type Indicator -->
    ${getEmailTypeIndicator('confirmed')}

    <!-- Email Body -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" class="email-body-bg" style="background-color: ${BRAND_COLORS.gray100};">
        <tr>
            <td style="padding: 0 20px 40px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto;" class="email-container">

                    ${getEmailLogoHeader()}

                    <!-- Main Card - Ticket Style -->
                    <tr>
                        <td>
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" class="email-card" style="background-color: ${BRAND_COLORS.white}; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">

                                <!-- Header Content -->
                                <tr>
                                    <td class="padding-mobile" style="padding: 32px 32px 24px;">
                                        <h1 class="text-dark" style="margin: 0 0 8px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 24px; font-weight: 700; color: ${BRAND_COLORS.gray900}; line-height: 1.3;">
                                            Your ride is confirmed
                                        </h1>
                                        <p class="text-muted" style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; color: ${BRAND_COLORS.gray600}; line-height: 1.5;">
                                            Hi ${safeData.customerName}, we look forward to seeing you. Save this confirmation for your trip.
                                        </p>
                                    </td>
                                </tr>

                                <!-- Ticket Section -->
                                <tr>
                                    <td class="padding-mobile" style="padding: 0 32px 24px;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: ${BRAND_COLORS.gray900}; border-radius: 12px; overflow: hidden;">

                                            <!-- Ticket Header -->
                                            <tr>
                                                <td style="padding: 20px 24px; border-bottom: 2px dashed ${BRAND_COLORS.gray700};">
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                        <tr>
                                                            <td width="50%">
                                                                <p style="margin: 0 0 4px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 10px; font-weight: 600; color: ${BRAND_COLORS.gray400}; text-transform: uppercase; letter-spacing: 1px;">
                                                                    Passenger
                                                                </p>
                                                                <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; font-weight: 600; color: ${BRAND_COLORS.white};">
                                                                    ${safeData.customerName}
                                                                </p>
                                                            </td>
                                                            <td width="50%" style="text-align: right;">
                                                                <p style="margin: 0 0 4px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 10px; font-weight: 600; color: ${BRAND_COLORS.gray400}; text-transform: uppercase; letter-spacing: 1px;">
                                                                    Reference
                                                                </p>
                                                                <p style="margin: 0; font-family: 'SF Mono', 'Monaco', monospace; font-size: 14px; font-weight: 700; color: ${BRAND_COLORS.primary}; letter-spacing: 1px;">
                                                                    ${safeData.bookingRef}
                                                                </p>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>

                                            <!-- Route Display -->
                                            <tr>
                                                <td style="padding: 24px;">
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                        <tr>
                                                            <td width="40%" valign="top">
                                                                <p style="margin: 0 0 4px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 10px; font-weight: 600; color: ${BRAND_COLORS.gray400}; text-transform: uppercase; letter-spacing: 1px;">
                                                                    From
                                                                </p>
                                                                <p style="margin: 0 0 6px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 32px; font-weight: 800; color: ${BRAND_COLORS.white}; letter-spacing: 2px;">
                                                                    ${safeData.fromCode}
                                                                </p>
                                                                <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; color: ${BRAND_COLORS.gray400}; line-height: 1.4;">
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
                                                                <p style="margin: 0 0 6px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 32px; font-weight: 800; color: ${BRAND_COLORS.white}; letter-spacing: 2px;">
                                                                    ${safeData.toCode}
                                                                </p>
                                                                <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; color: ${BRAND_COLORS.gray400}; line-height: 1.4;">
                                                                    ${safeData.endLocation}
                                                                </p>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>

                                            <!-- Ticket Details -->
                                            <tr>
                                                <td style="padding: 0 24px 24px;">
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                        <tr>
                                                            <td class="stack-column" width="33%" style="padding-right: 8px;" valign="top">
                                                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: ${BRAND_COLORS.gray800}; border-radius: 8px;">
                                                                    <tr>
                                                                        <td style="padding: 12px; text-align: center;">
                                                                            <p style="margin: 0 0 4px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 10px; font-weight: 600; color: ${BRAND_COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.5px;">Date</p>
                                                                            <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; font-weight: 700; color: ${BRAND_COLORS.white};">${safeData.pickupDate}</p>
                                                                        </td>
                                                                    </tr>
                                                                </table>
                                                            </td>
                                                            <td class="stack-column" width="33%" style="padding-left: 8px; padding-right: 8px;" valign="top">
                                                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: ${BRAND_COLORS.gray800}; border-radius: 8px;">
                                                                    <tr>
                                                                        <td style="padding: 12px; text-align: center;">
                                                                            <p style="margin: 0 0 4px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 10px; font-weight: 600; color: ${BRAND_COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.5px;">Time</p>
                                                                            <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; font-weight: 700; color: ${BRAND_COLORS.white};">${safeData.pickupTime}</p>
                                                                        </td>
                                                                    </tr>
                                                                </table>
                                                            </td>
                                                            <td class="stack-column" width="33%" style="padding-left: 8px;" valign="top">
                                                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: ${BRAND_COLORS.gray800}; border-radius: 8px;">
                                                                    <tr>
                                                                        <td style="padding: 12px; text-align: center;">
                                                                            <p style="margin: 0 0 4px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 10px; font-weight: 600; color: ${BRAND_COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.5px;">Passengers</p>
                                                                            <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; font-weight: 700; color: ${BRAND_COLORS.white};">${safeData.passengers}</p>
                                                                        </td>
                                                                    </tr>
                                                                </table>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>

                                        </table>
                                    </td>
                                </tr>

                                <!-- Driver Section -->
                                <tr>
                                    <td class="padding-mobile" style="padding: 0 32px 24px;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" class="email-card-secondary border-light" style="background-color: ${BRAND_COLORS.gray50}; border-radius: 10px; border: 1px solid ${BRAND_COLORS.gray200}; border-left: 4px solid ${BRAND_COLORS.primary};">
                                            <tr>
                                                <td style="padding: 18px 20px;">
                                                    <p class="text-muted" style="margin: 0 0 12px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: ${BRAND_COLORS.gray500};">
                                                        Your Driver
                                                    </p>
                                                    <p class="text-dark" style="margin: 0 0 8px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 16px; font-weight: 600; color: ${BRAND_COLORS.gray900};">
                                                        ${safeData.driverName}
                                                    </p>
                                                    <p style="margin: 0 0 4px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px;">
                                                        <a href="tel:${safeData.driverPhone}" style="color: ${BRAND_COLORS.primary}; text-decoration: none; font-weight: 500;">${safeData.driverPhone}</a>
                                                    </p>
                                                    <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px;">
                                                        <a href="mailto:${safeData.driverEmail}" style="color: ${BRAND_COLORS.primary}; text-decoration: none;">${safeData.driverEmail}</a>
                                                    </p>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>

                                <!-- Pickup Tips -->
                                <tr>
                                    <td class="padding-mobile" style="padding: 0 32px 24px;">
                                        <p class="text-dark" style="margin: 0 0 12px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; font-weight: 600; color: ${BRAND_COLORS.gray900};">
                                            Pickup Tips
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

                                ${safeData.notes ? `
                                <!-- Notes -->
                                <tr>
                                    <td class="padding-mobile" style="padding: 0 32px 24px;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: ${BRAND_COLORS.warningLight}; border-radius: 10px; border: 1px solid ${BRAND_COLORS.warning};">
                                            <tr>
                                                <td style="padding: 16px 20px;">
                                                    <p style="margin: 0 0 8px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 700; color: ${BRAND_COLORS.warningDark}; text-transform: uppercase; letter-spacing: 0.5px;">
                                                        Trip Notes
                                                    </p>
                                                    <p class="text-dark" style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: ${BRAND_COLORS.gray700}; line-height: 1.5;">
                                                        ${safeData.notes}
                                                    </p>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                                ` : ''}

                                ${safeData.mapUrl ? `
                                <!-- Map Button -->
                                <tr>
                                    <td class="padding-mobile" style="padding: 0 32px 24px;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                            <tr>
                                                <td style="text-align: center;">
                                                    <a href="${safeData.mapUrl}" target="_blank" rel="noopener noreferrer" class="button-link button-mobile" style="display: inline-block; padding: 14px 28px; background-color: ${BRAND_COLORS.primary}; color: ${BRAND_COLORS.white}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 10px;">
                                                        View Route on Maps
                                                    </a>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                                ` : ''}

                                <!-- Footer Message -->
                                <tr>
                                    <td class="padding-mobile email-card-secondary border-light" style="padding: 20px 32px; background-color: ${BRAND_COLORS.successLight}; border-top: 1px solid ${BRAND_COLORS.gray200};">
                                        <p class="text-muted" style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: ${BRAND_COLORS.successDark}; text-align: center; line-height: 1.5;">
                                            We look forward to providing you with a comfortable ride!
                                        </p>
                                    </td>
                                </tr>

                            </table>
                        </td>
                    </tr>

                    <!-- Help Text -->
                    <tr>
                        <td style="padding: 24px 20px 0; text-align: center;">
                            <p class="text-muted" style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: ${BRAND_COLORS.gray500};">
                                Questions? Call <a href="tel:${safeData.driverPhone}" style="color: ${BRAND_COLORS.primary}; text-decoration: none; font-weight: 500;">${safeData.driverPhone}</a> or reply to this email
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

  const text = `AC SHUTTLES - RIDE CONFIRMED

Your ride is confirmed!

Hi ${data.customerName}, we look forward to seeing you. Save this confirmation for your trip.

BOOKING REFERENCE: ${data.bookingRef}

ROUTE
=====
${fromCode} --> ${toCode}
From: ${data.startLocation}
To: ${data.endLocation}

TRIP DETAILS
============
Date: ${data.pickupDate}
Time: ${data.pickupTime}
Passengers: ${data.passengers}
Est. Duration: ${data.estimatedDuration}

YOUR DRIVER
===========
${data.driverName}
Phone: ${data.driverPhone}
Email: ${data.driverEmail}

PICKUP TIPS
===========
- Be ready 5-10 minutes before pickup
- Driver will call when approaching
- Wait at the building entrance

${data.notes ? `TRIP NOTES
==========
${data.notes}

` : ''}${data.mapUrl ? `VIEW ROUTE: ${data.mapUrl}

` : ''}We look forward to providing you with a comfortable ride!

Questions? Call ${data.driverPhone} or reply to this email.

---
AC Shuttles - Private Shuttle Service
Serving NJ, Philadelphia & NYC Area`;

  return { html, text };
}
