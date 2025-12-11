/**
 * Customer Denial Email Template
 *
 * Sent when a booking request cannot be accommodated.
 *
 * Visual Theme: Red (Unable to Accommodate)
 * - Clear visual indicator at top showing "UNABLE TO ACCOMMODATE"
 * - Empathetic, professional tone
 * - Clear explanation without being harsh
 * - Alternative contact options
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
  escapeHtml
} from './utils';

export interface CustomerDenialData {
  // Trip details
  startLocation: string;
  endLocation: string;
  pickupTime: string;
  pickupDate: string;
  passengers: string;

  // Customer details
  customerName: string;
  customerEmail: string;

  // Contact details
  contactPhone: string;
  contactEmail: string;

  // Additional info
  reason?: string;
  bookingRef: string;
}

export function generateCustomerDenialEmail(data: CustomerDenialData): { html: string; text: string } {
  const defaultReason = "scheduling conflicts";
  const reason = data.reason || defaultReason;

  const safeData = {
    customerName: escapeHtml(data.customerName),
    startLocation: escapeHtml(data.startLocation),
    endLocation: escapeHtml(data.endLocation),
    pickupTime: escapeHtml(data.pickupTime),
    pickupDate: escapeHtml(data.pickupDate),
    passengers: escapeHtml(data.passengers),
    reason: escapeHtml(reason),
    bookingRef: escapeHtml(data.bookingRef),
    contactPhone: escapeHtml(data.contactPhone),
    contactEmail: escapeHtml(data.contactEmail),
  };

  const html = `${getEmailHead('Booking Update - AC Shuttles')}
${getEmailResetStyles()}
</head>
<body style="margin: 0; padding: 0; background-color: ${BRAND_COLORS.gray100};">
    ${getPreheader(`Update on your ride request for ${safeData.pickupDate}. Reference: ${safeData.bookingRef}`)}

    <!-- Type Indicator -->
    ${getEmailTypeIndicator('denied')}

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
                                        <h1 class="text-dark" style="margin: 0 0 12px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 24px; font-weight: 700; color: ${BRAND_COLORS.gray900}; line-height: 1.3;">
                                            We're sorry
                                        </h1>
                                        <p class="text-muted" style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; color: ${BRAND_COLORS.gray600}; line-height: 1.6;">
                                            Hi ${safeData.customerName}, thank you for your interest in AC Shuttles. Unfortunately, we're unable to accommodate your ride request at this time due to ${safeData.reason}.
                                        </p>
                                    </td>
                                </tr>

                                <!-- Original Request Summary -->
                                <tr>
                                    <td class="padding-mobile" style="padding: 0 32px 24px;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" class="email-card-secondary border-light" style="background-color: ${BRAND_COLORS.gray50}; border-radius: 10px; border: 1px solid ${BRAND_COLORS.gray200};">
                                            <tr>
                                                <td style="padding: 20px;">
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 16px;">
                                                        <tr>
                                                            <td>
                                                                <p class="text-muted" style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 700; color: ${BRAND_COLORS.gray400}; text-transform: uppercase; letter-spacing: 1px;">
                                                                    Your Original Request
                                                                </p>
                                                            </td>
                                                            <td style="text-align: right;">
                                                                <span style="display: inline-block; padding: 4px 10px; background-color: ${BRAND_COLORS.dangerLight}; color: ${BRAND_COLORS.danger}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border-radius: 4px;">
                                                                    Unavailable
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    </table>

                                                    <!-- From -->
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 12px;">
                                                        <tr>
                                                            <td width="28" valign="top">
                                                                <div style="width: 8px; height: 8px; background-color: ${BRAND_COLORS.gray300}; border-radius: 50%; margin-top: 5px;"></div>
                                                            </td>
                                                            <td style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                                                                <p class="text-muted" style="margin: 0 0 2px 0; font-size: 10px; font-weight: 500; color: ${BRAND_COLORS.gray400};">From</p>
                                                                <p class="text-muted" style="margin: 0; font-size: 14px; color: ${BRAND_COLORS.gray400};">${safeData.startLocation}</p>
                                                            </td>
                                                        </tr>
                                                    </table>

                                                    <!-- Connector Line -->
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                        <tr>
                                                            <td width="28" style="text-align: center; padding: 2px 0;">
                                                                <div style="width: 2px; height: 12px; background-color: ${BRAND_COLORS.gray200}; margin: 0 auto; margin-left: 3px;"></div>
                                                            </td>
                                                            <td></td>
                                                        </tr>
                                                    </table>

                                                    <!-- To -->
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 16px;">
                                                        <tr>
                                                            <td width="28" valign="top">
                                                                <div style="width: 8px; height: 8px; background-color: ${BRAND_COLORS.gray300}; border-radius: 50%; margin-top: 5px;"></div>
                                                            </td>
                                                            <td style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                                                                <p class="text-muted" style="margin: 0 0 2px 0; font-size: 10px; font-weight: 500; color: ${BRAND_COLORS.gray400};">To</p>
                                                                <p class="text-muted" style="margin: 0; font-size: 14px; color: ${BRAND_COLORS.gray400};">${safeData.endLocation}</p>
                                                            </td>
                                                        </tr>
                                                    </table>

                                                    <!-- Date/Time/Passengers -->
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-top: 1px solid ${BRAND_COLORS.gray200}; padding-top: 14px;">
                                                        <tr>
                                                            <td width="33%" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; color: ${BRAND_COLORS.gray400};">
                                                                ${safeData.pickupDate}
                                                            </td>
                                                            <td width="34%" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; color: ${BRAND_COLORS.gray400}; text-align: center;">
                                                                ${safeData.pickupTime}
                                                            </td>
                                                            <td width="33%" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; color: ${BRAND_COLORS.gray400}; text-align: right;">
                                                                ${safeData.passengers} passenger${safeData.passengers !== '1' ? 's' : ''}
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>

                                <!-- Alternative Options -->
                                <tr>
                                    <td class="padding-mobile" style="padding: 0 32px 24px;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" class="email-card-secondary border-light" style="background-color: ${BRAND_COLORS.gray50}; border-radius: 10px; border: 1px solid ${BRAND_COLORS.gray200}; border-left: 4px solid ${BRAND_COLORS.primary};">
                                            <tr>
                                                <td style="padding: 20px;">
                                                    <p class="text-dark" style="margin: 0 0 12px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; font-weight: 600; color: ${BRAND_COLORS.gray900};">
                                                        We may still be able to help!
                                                    </p>
                                                    <p class="text-muted" style="margin: 0 0 12px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.5; color: ${BRAND_COLORS.gray600};">
                                                        Give us a call to discuss alternatives:
                                                    </p>
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                        <tr>
                                                            <td class="text-muted" style="padding: 4px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: ${BRAND_COLORS.gray600};">
                                                                <span style="color: ${BRAND_COLORS.primary}; margin-right: 8px;">&#8226;</span>Alternative pickup times
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td class="text-muted" style="padding: 4px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: ${BRAND_COLORS.gray600};">
                                                                <span style="color: ${BRAND_COLORS.primary}; margin-right: 8px;">&#8226;</span>Different dates that may work
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td class="text-muted" style="padding: 4px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: ${BRAND_COLORS.gray600};">
                                                                <span style="color: ${BRAND_COLORS.primary}; margin-right: 8px;">&#8226;</span>Modified route options
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>

                                <!-- Contact CTA -->
                                <tr>
                                    <td class="padding-mobile" style="padding: 0 32px 24px;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                            <tr>
                                                <td style="text-align: center;">
                                                    <a href="tel:${safeData.contactPhone}" class="button-link button-mobile" style="display: inline-block; padding: 16px 32px; background-color: ${BRAND_COLORS.primary}; color: ${BRAND_COLORS.white}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 16px; font-weight: 700; text-decoration: none; border-radius: 10px;">
                                                        Call Us: ${safeData.contactPhone}
                                                    </a>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding-top: 12px; text-align: center;">
                                                    <p class="text-muted" style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: ${BRAND_COLORS.gray500};">
                                                        or email <a href="mailto:${safeData.contactEmail}" style="color: ${BRAND_COLORS.primary}; text-decoration: none; font-weight: 500;">${safeData.contactEmail}</a>
                                                    </p>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>

                                <!-- Reference Footer -->
                                <tr>
                                    <td class="padding-mobile" style="padding: 24px 32px 32px;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" class="email-ref-badge" style="background-color: ${BRAND_COLORS.gray900}; border-radius: 10px;">
                                            <tr>
                                                <td style="padding: 18px 24px; text-align: center;">
                                                    <p class="text-muted" style="margin: 0 0 6px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 10px; font-weight: 600; color: ${BRAND_COLORS.gray400}; text-transform: uppercase; letter-spacing: 1.5px;">
                                                        Reference Number
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

                    <!-- Closing Message -->
                    <tr>
                        <td style="padding: 24px 20px 0; text-align: center;">
                            <p class="text-muted" style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: ${BRAND_COLORS.gray500}; line-height: 1.5;">
                                We'd love another chance to get you where you need to go.
                            </p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>

    ${getEmailFooter(safeData.contactPhone, safeData.contactEmail)}

</body>
</html>`;

  const text = `AC SHUTTLES - UNABLE TO ACCOMMODATE

Hi ${data.customerName},

Thank you for your interest in AC Shuttles. Unfortunately, we're unable to accommodate your ride request at this time due to ${reason}.

YOUR ORIGINAL REQUEST
=====================
From: ${data.startLocation}
To: ${data.endLocation}
Date: ${data.pickupDate}
Time: ${data.pickupTime}
Passengers: ${data.passengers}

WE MAY STILL BE ABLE TO HELP!
=============================
Give us a call to discuss alternatives:
- Alternative pickup times
- Different dates that may work
- Modified route options

CONTACT US
==========
Phone: ${data.contactPhone}
Email: ${data.contactEmail}

Reference Number: ${data.bookingRef}

We'd love another chance to get you where you need to go.

---
AC Shuttles - Private Shuttle Service
Serving NJ, Philadelphia & NYC Area`;

  return { html, text };
}
