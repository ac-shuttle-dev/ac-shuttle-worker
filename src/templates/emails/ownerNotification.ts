/**
 * Owner Notification Email Template
 *
 * Sent to the owner when a new booking request is received.
 *
 * Visual Theme: Amber (Action Required)
 * - Clear visual indicator at top showing "ACTION REQUIRED"
 * - Confirm/Deny action buttons
 * - Complete trip and customer details
 * - Dark mode support via CSS media queries
 * - Anti-spam compliant structure
 */

import {
  BRAND_COLORS,
  getEmailHead,
  getEmailResetStyles,
  getPreheader,
  getEmailTypeIndicator,
  getEmailLogoHeader,
  escapeHtml
} from './utils';

export interface OwnerNotificationData {
  // Trip details
  startLocation: string;
  endLocation: string;
  pickupTime: string;
  pickupDate: string;
  passengers: string;
  estimatedDuration: string;
  estimatedDistance: string;
  mapUrl?: string;

  // Customer details
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;

  // Additional info
  notes?: string;
  bookingRef: string;

  // Action URLs
  acceptUrl: string;
  denyUrl: string;
}

export function generateOwnerNotificationEmail(data: OwnerNotificationData): { html: string; text: string } {
  const safeData = {
    startLocation: escapeHtml(data.startLocation),
    endLocation: escapeHtml(data.endLocation),
    pickupTime: escapeHtml(data.pickupTime),
    pickupDate: escapeHtml(data.pickupDate),
    passengers: escapeHtml(data.passengers),
    estimatedDuration: escapeHtml(data.estimatedDuration),
    estimatedDistance: escapeHtml(data.estimatedDistance),
    customerName: escapeHtml(data.customerName),
    customerEmail: escapeHtml(data.customerEmail),
    customerPhone: data.customerPhone ? escapeHtml(data.customerPhone) : null,
    notes: data.notes ? escapeHtml(data.notes) : '',
    bookingRef: escapeHtml(data.bookingRef),
    acceptUrl: data.acceptUrl,
    denyUrl: data.denyUrl,
    mapUrl: data.mapUrl || '',
  };

  const html = `${getEmailHead('New Booking Request - AC Shuttles')}
${getEmailResetStyles()}
</head>
<body style="margin: 0; padding: 0; background-color: ${BRAND_COLORS.gray100};">
    ${getPreheader(`New ride request from ${safeData.customerName} for ${safeData.pickupDate}. Action required.`)}

    <!-- Type Indicator -->
    ${getEmailTypeIndicator('action_required')}

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
                                            New Booking Request
                                        </h1>
                                        <p class="text-muted" style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; color: ${BRAND_COLORS.gray600}; line-height: 1.5;">
                                            A customer is requesting a ride. Review the details and respond below.
                                        </p>
                                    </td>
                                </tr>

                                <!-- Quick Summary Bar -->
                                <tr>
                                    <td class="padding-mobile" style="padding: 0 32px 24px;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" class="email-card-secondary border-light" style="background-color: ${BRAND_COLORS.warningLight}; border-radius: 10px; border: 1px solid ${BRAND_COLORS.warning};">
                                            <tr>
                                                <td class="stack-column" width="50%" style="padding: 16px; text-align: center; border-right: 1px solid ${BRAND_COLORS.warning}40;">
                                                    <p class="text-muted" style="margin: 0 0 4px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: ${BRAND_COLORS.warningDark};">Date</p>
                                                    <p class="text-dark" style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 16px; font-weight: 700; color: ${BRAND_COLORS.gray900};">${safeData.pickupDate}</p>
                                                </td>
                                                <td class="stack-column" width="50%" style="padding: 16px; text-align: center;">
                                                    <p class="text-muted" style="margin: 0 0 4px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: ${BRAND_COLORS.warningDark};">Time</p>
                                                    <p class="text-dark" style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 16px; font-weight: 700; color: ${BRAND_COLORS.gray900};">${safeData.pickupTime}</p>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>

                                <!-- Route Details -->
                                <tr>
                                    <td class="padding-mobile" style="padding: 0 32px 24px;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" class="email-card-secondary border-light" style="background-color: ${BRAND_COLORS.gray50}; border-radius: 10px; border: 1px solid ${BRAND_COLORS.gray200};">
                                            <tr>
                                                <td style="padding: 20px;">
                                                    <p class="text-muted" style="margin: 0 0 16px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 700; color: ${BRAND_COLORS.gray500}; text-transform: uppercase; letter-spacing: 1px;">
                                                        Route Details
                                                    </p>

                                                    <!-- From Location -->
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                        <tr>
                                                            <td width="32" valign="top">
                                                                <div style="width: 24px; height: 24px; background-color: ${BRAND_COLORS.warning}; border-radius: 50%; text-align: center; line-height: 24px;">
                                                                    <span style="color: ${BRAND_COLORS.white}; font-size: 11px; font-weight: 700;">A</span>
                                                                </div>
                                                            </td>
                                                            <td style="padding-left: 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                                                                <p class="text-muted" style="margin: 0 0 2px 0; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: ${BRAND_COLORS.gray500};">Pickup</p>
                                                                <p class="text-dark" style="margin: 0; font-size: 14px; font-weight: 500; color: ${BRAND_COLORS.gray900}; line-height: 1.4;">${safeData.startLocation}</p>
                                                            </td>
                                                        </tr>
                                                    </table>

                                                    <!-- Connector -->
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                        <tr>
                                                            <td width="32" style="text-align: center; padding: 4px 0;">
                                                                <div style="width: 2px; height: 16px; background-color: ${BRAND_COLORS.gray300}; margin: 0 auto;"></div>
                                                            </td>
                                                            <td></td>
                                                        </tr>
                                                    </table>

                                                    <!-- To Location -->
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                        <tr>
                                                            <td width="32" valign="top">
                                                                <div style="width: 24px; height: 24px; background-color: ${BRAND_COLORS.primary}; border-radius: 50%; text-align: center; line-height: 24px;">
                                                                    <span style="color: ${BRAND_COLORS.white}; font-size: 11px; font-weight: 700;">B</span>
                                                                </div>
                                                            </td>
                                                            <td style="padding-left: 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                                                                <p class="text-muted" style="margin: 0 0 2px 0; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: ${BRAND_COLORS.gray500};">Drop-off</p>
                                                                <p class="text-dark" style="margin: 0; font-size: 14px; font-weight: 500; color: ${BRAND_COLORS.gray900}; line-height: 1.4;">${safeData.endLocation}</p>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>

                                <!-- Trip Stats -->
                                <tr>
                                    <td class="padding-mobile" style="padding: 0 32px 24px;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                            <tr>
                                                <td class="stack-column" width="33%" style="padding-right: 8px;" valign="top">
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" class="email-card-secondary border-light" style="background-color: ${BRAND_COLORS.gray50}; border-radius: 8px; border: 1px solid ${BRAND_COLORS.gray200};">
                                                        <tr>
                                                            <td style="padding: 14px; text-align: center;">
                                                                <p class="text-muted" style="margin: 0 0 4px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 500; color: ${BRAND_COLORS.gray500};">Passengers</p>
                                                                <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 18px; font-weight: 700; color: ${BRAND_COLORS.primary};">${safeData.passengers}</p>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </td>
                                                <td class="stack-column" width="33%" style="padding-right: 8px; padding-left: 8px;" valign="top">
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" class="email-card-secondary border-light" style="background-color: ${BRAND_COLORS.gray50}; border-radius: 8px; border: 1px solid ${BRAND_COLORS.gray200};">
                                                        <tr>
                                                            <td style="padding: 14px; text-align: center;">
                                                                <p class="text-muted" style="margin: 0 0 4px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 500; color: ${BRAND_COLORS.gray500};">Duration</p>
                                                                <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 18px; font-weight: 700; color: ${BRAND_COLORS.primary};">${safeData.estimatedDuration}</p>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </td>
                                                <td class="stack-column" width="33%" style="padding-left: 8px;" valign="top">
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" class="email-card-secondary border-light" style="background-color: ${BRAND_COLORS.gray50}; border-radius: 8px; border: 1px solid ${BRAND_COLORS.gray200};">
                                                        <tr>
                                                            <td style="padding: 14px; text-align: center;">
                                                                <p class="text-muted" style="margin: 0 0 4px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 500; color: ${BRAND_COLORS.gray500};">Distance</p>
                                                                <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 18px; font-weight: 700; color: ${BRAND_COLORS.primary};">${safeData.estimatedDistance}</p>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>

                                <!-- Customer Info -->
                                <tr>
                                    <td class="padding-mobile" style="padding: 0 32px 24px;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" class="email-card-secondary border-light" style="background-color: ${BRAND_COLORS.gray50}; border-radius: 10px; border: 1px solid ${BRAND_COLORS.gray200}; border-left: 4px solid ${BRAND_COLORS.primary};">
                                            <tr>
                                                <td style="padding: 18px 20px;">
                                                    <p class="text-muted" style="margin: 0 0 12px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: ${BRAND_COLORS.gray500};">
                                                        Customer
                                                    </p>
                                                    <p class="text-dark" style="margin: 0 0 6px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; font-weight: 600; color: ${BRAND_COLORS.gray900};">
                                                        ${safeData.customerName}
                                                    </p>
                                                    <p style="margin: 0 0 4px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px;">
                                                        <a href="mailto:${safeData.customerEmail}" style="color: ${BRAND_COLORS.primary}; text-decoration: none;">${safeData.customerEmail}</a>
                                                    </p>
                                                    ${safeData.customerPhone ? `
                                                    <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px;">
                                                        <a href="tel:${safeData.customerPhone}" style="color: ${BRAND_COLORS.primary}; text-decoration: none; font-weight: 500;">${safeData.customerPhone}</a>
                                                    </p>
                                                    ` : `
                                                    <p class="text-muted" style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: ${BRAND_COLORS.gray400}; font-style: italic;">
                                                        No phone provided
                                                    </p>
                                                    `}
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>

                                ${safeData.notes ? `
                                <!-- Special Instructions -->
                                <tr>
                                    <td class="padding-mobile" style="padding: 0 32px 24px;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: ${BRAND_COLORS.warningLight}; border-radius: 10px; border: 1px solid ${BRAND_COLORS.warning};">
                                            <tr>
                                                <td style="padding: 18px 20px;">
                                                    <p style="margin: 0 0 8px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: ${BRAND_COLORS.warningDark};">
                                                        Special Instructions
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

                                <!-- Reference Number -->
                                <tr>
                                    <td class="padding-mobile" style="padding: 0 32px 24px;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: ${BRAND_COLORS.gray900}; border-radius: 8px;">
                                            <tr>
                                                <td style="padding: 14px; text-align: center;">
                                                    <p class="text-muted" style="margin: 0 0 4px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: ${BRAND_COLORS.gray400};">
                                                        Booking Reference
                                                    </p>
                                                    <p style="margin: 0; font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace; font-size: 16px; font-weight: 700; color: ${BRAND_COLORS.primary}; letter-spacing: 2px;">
                                                        ${safeData.bookingRef}
                                                    </p>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>

                                <!-- Action Buttons Section -->
                                <tr>
                                    <td class="padding-mobile email-card-secondary border-light" style="padding: 24px 32px; background-color: ${BRAND_COLORS.gray50}; border-top: 1px solid ${BRAND_COLORS.gray200};">

                                        <p class="text-dark" style="margin: 0 0 16px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: ${BRAND_COLORS.gray600}; text-align: center;">
                                            Your Response
                                        </p>

                                        <!-- Accept Button -->
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 12px;">
                                            <tr>
                                                <td>
                                                    <a href="${safeData.acceptUrl}" target="_blank" class="button-link button-mobile" style="display: block; padding: 16px 24px; background-color: ${BRAND_COLORS.success}; color: ${BRAND_COLORS.white}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 16px; font-weight: 700; text-decoration: none; border-radius: 10px; text-align: center;">
                                                        &#10003; Confirm Ride
                                                    </a>
                                                </td>
                                            </tr>
                                        </table>

                                        <!-- Decline Button -->
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 16px;">
                                            <tr>
                                                <td>
                                                    <a href="${safeData.denyUrl}" target="_blank" class="button-link button-mobile" style="display: block; padding: 16px 24px; background-color: ${BRAND_COLORS.danger}; color: ${BRAND_COLORS.white}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 16px; font-weight: 700; text-decoration: none; border-radius: 10px; text-align: center;">
                                                        &#10005; Decline Ride
                                                    </a>
                                                </td>
                                            </tr>
                                        </table>

                                        ${safeData.mapUrl ? `
                                        <!-- View Route Button -->
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 16px;">
                                            <tr>
                                                <td>
                                                    <a href="${safeData.mapUrl}" target="_blank" rel="noopener noreferrer" class="button-link button-mobile" style="display: block; padding: 14px 24px; background-color: ${BRAND_COLORS.white}; color: ${BRAND_COLORS.primary}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 8px; text-align: center; border: 2px solid ${BRAND_COLORS.primary};">
                                                        View Route on Google Maps
                                                    </a>
                                                </td>
                                            </tr>
                                        </table>
                                        ` : ''}

                                        <!-- Security Notice -->
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: ${BRAND_COLORS.warningLight}; border-radius: 6px; border: 1px solid ${BRAND_COLORS.warning};">
                                            <tr>
                                                <td style="padding: 10px 14px; text-align: center;">
                                                    <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; color: ${BRAND_COLORS.warningDark}; line-height: 1.4;">
                                                        <strong style="font-weight: 700;">&#9888; Important:</strong> Each button can only be used once. Choose carefully.
                                                    </p>
                                                </td>
                                            </tr>
                                        </table>

                                    </td>
                                </tr>

                            </table>
                        </td>
                    </tr>

                    <!-- Reply Info -->
                    <tr>
                        <td style="padding: 24px 20px 0; text-align: center;">
                            <p class="text-muted" style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: ${BRAND_COLORS.gray500};">
                                Reply to this email to contact the customer directly
                            </p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>

    <!-- Simple Footer for Owner -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto;">
        <tr>
            <td style="padding: 20px; text-align: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                <p class="text-muted" style="margin: 0; font-size: 13px; color: ${BRAND_COLORS.gray400};">
                    AC Shuttles Owner Notification System
                </p>
            </td>
        </tr>
    </table>

</body>
</html>`;

  const text = `AC SHUTTLES - ACTION REQUIRED

New Booking Request

A customer is requesting a ride. Review the details and respond below.

QUICK SUMMARY
=============
Date: ${data.pickupDate}
Time: ${data.pickupTime}

ROUTE DETAILS
=============
From: ${data.startLocation}
To: ${data.endLocation}

TRIP INFO
=========
Passengers: ${data.passengers}
Duration: ${data.estimatedDuration}
Distance: ${data.estimatedDistance}

CUSTOMER
========
Name: ${data.customerName}
Email: ${data.customerEmail}
Phone: ${data.customerPhone || 'Not provided'}

${data.notes ? `SPECIAL INSTRUCTIONS
====================
${data.notes}

` : ''}BOOKING REFERENCE: ${data.bookingRef}

YOUR RESPONSE
=============
Confirm Ride: ${data.acceptUrl}
Decline Ride: ${data.denyUrl}

${data.mapUrl ? `View Route: ${data.mapUrl}

` : ''}Note: Each link can only be used once.

Reply to this email to contact the customer directly.

---
AC Shuttles Owner Notification System`;

  return { html, text };
}
