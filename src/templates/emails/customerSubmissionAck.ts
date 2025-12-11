/**
 * Customer Submission Acknowledgment Email Template
 *
 * Sent immediately after a customer submits a booking request AND
 * after the owner has been notified successfully.
 *
 * Visual Theme: Blue (Request Received)
 * - Clear visual indicator at top showing "REQUEST RECEIVED"
 * - Clean, minimal design matching website aesthetic
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

export interface CustomerSubmissionAckData {
  customerName: string;
  customerEmail: string;
  startLocation: string;
  endLocation: string;
  pickupTime: string;
  pickupDate: string;
  passengers?: string;
  bookingRef: string;
  contactPhone: string;
  contactEmail: string;
}

export function generateCustomerSubmissionAckEmail(data: CustomerSubmissionAckData): { html: string; text: string } {
  const safeData = {
    customerName: escapeHtml(data.customerName),
    startLocation: escapeHtml(data.startLocation),
    endLocation: escapeHtml(data.endLocation),
    pickupTime: escapeHtml(data.pickupTime),
    pickupDate: escapeHtml(data.pickupDate),
    passengers: data.passengers ? escapeHtml(data.passengers) : '1',
    bookingRef: escapeHtml(data.bookingRef),
    contactPhone: escapeHtml(data.contactPhone),
    contactEmail: escapeHtml(data.contactEmail),
  };

  const html = `${getEmailHead('Request Received - AC Shuttles')}
${getEmailResetStyles()}
</head>
<body style="margin: 0; padding: 0; background-color: ${BRAND_COLORS.gray100};">
    ${getPreheader(`We've received your ride request for ${safeData.pickupDate}. Reference: ${safeData.bookingRef}`)}

    <!-- Type Indicator -->
    ${getEmailTypeIndicator('request_received')}

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
                                            We're reviewing your request
                                        </h1>
                                        <p class="text-muted" style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; color: ${BRAND_COLORS.gray600}; line-height: 1.5;">
                                            Hi ${safeData.customerName}, thanks for choosing AC Shuttles! We've received your trip request and our driver will reach out to you shortly with a personalized quote.
                                        </p>
                                    </td>
                                </tr>

                                <!-- Trip Summary -->
                                <tr>
                                    <td class="padding-mobile" style="padding: 0 32px 24px;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: ${BRAND_COLORS.gray900}; border-radius: 10px;">
                                            <tr>
                                                <td style="padding: 20px;">
                                                    <p style="margin: 0 0 16px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 700; color: ${BRAND_COLORS.gray400}; text-transform: uppercase; letter-spacing: 1px;">
                                                        Trip Summary
                                                    </p>

                                                    <!-- From -->
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                        <tr>
                                                            <td width="28" valign="top">
                                                                <div style="width: 10px; height: 10px; background-color: ${BRAND_COLORS.pending}; border-radius: 50%; margin-top: 4px;"></div>
                                                            </td>
                                                            <td style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                                                                <p style="margin: 0 0 2px 0; font-size: 10px; font-weight: 600; color: ${BRAND_COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.5px;">From</p>
                                                                <p style="margin: 0; font-size: 14px; font-weight: 500; color: ${BRAND_COLORS.white};">${safeData.startLocation}</p>
                                                            </td>
                                                        </tr>
                                                    </table>

                                                    <!-- Connector Line -->
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                        <tr>
                                                            <td width="28" style="text-align: center; padding: 4px 0;">
                                                                <div style="width: 2px; height: 16px; background-color: ${BRAND_COLORS.gray600}; margin: 0 auto; margin-left: 4px;"></div>
                                                            </td>
                                                            <td></td>
                                                        </tr>
                                                    </table>

                                                    <!-- To -->
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                        <tr>
                                                            <td width="28" valign="top">
                                                                <div style="width: 10px; height: 10px; background-color: ${BRAND_COLORS.primary}; border-radius: 50%; margin-top: 4px;"></div>
                                                            </td>
                                                            <td style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                                                                <p style="margin: 0 0 2px 0; font-size: 10px; font-weight: 600; color: ${BRAND_COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.5px;">To</p>
                                                                <p style="margin: 0; font-size: 14px; font-weight: 500; color: ${BRAND_COLORS.white};">${safeData.endLocation}</p>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>

                                <!-- Date/Time/Passengers -->
                                <tr>
                                    <td class="padding-mobile" style="padding: 0 32px 24px;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                            <tr>
                                                <td class="stack-column" width="33%" style="padding-right: 4px;" valign="top">
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: ${BRAND_COLORS.gray800}; border-radius: 8px; height: 70px;">
                                                        <tr>
                                                            <td style="padding: 12px 8px; text-align: center; vertical-align: middle; height: 70px;">
                                                                <p style="margin: 0 0 4px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 10px; font-weight: 600; color: ${BRAND_COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.5px;">Date</p>
                                                                <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; font-weight: 700; color: ${BRAND_COLORS.white}; line-height: 1.3;">${safeData.pickupDate}</p>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </td>
                                                <td class="stack-column" width="33%" style="padding-right: 4px; padding-left: 4px;" valign="top">
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: ${BRAND_COLORS.gray800}; border-radius: 8px; height: 70px;">
                                                        <tr>
                                                            <td style="padding: 12px 8px; text-align: center; vertical-align: middle; height: 70px;">
                                                                <p style="margin: 0 0 4px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 10px; font-weight: 600; color: ${BRAND_COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.5px;">Time</p>
                                                                <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; font-weight: 700; color: ${BRAND_COLORS.white};">${safeData.pickupTime}</p>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </td>
                                                <td class="stack-column" width="33%" style="padding-left: 4px;" valign="top">
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: ${BRAND_COLORS.gray800}; border-radius: 8px; height: 70px;">
                                                        <tr>
                                                            <td style="padding: 12px 8px; text-align: center; vertical-align: middle; height: 70px;">
                                                                <p style="margin: 0 0 4px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 10px; font-weight: 600; color: ${BRAND_COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.5px;">Passengers</p>
                                                                <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; font-weight: 700; color: ${BRAND_COLORS.white};">${safeData.passengers}</p>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>

                                <!-- What's Next -->
                                <tr>
                                    <td class="padding-mobile" style="padding: 0 32px 24px;">
                                        <p class="text-dark" style="margin: 0 0 12px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; font-weight: 600; color: ${BRAND_COLORS.gray900};">
                                            What happens next?
                                        </p>
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                            <tr>
                                                <td class="text-muted" style="padding: 5px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: ${BRAND_COLORS.gray600};">
                                                    <span style="color: ${BRAND_COLORS.pending}; margin-right: 8px; font-weight: 600;">1.</span>We're reviewing your request now
                                                </td>
                                            </tr>
                                            <tr>
                                                <td class="text-muted" style="padding: 5px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: ${BRAND_COLORS.gray600};">
                                                    <span style="color: ${BRAND_COLORS.pending}; margin-right: 8px; font-weight: 600;">2.</span>Our driver will call or text you with a trip quote
                                                </td>
                                            </tr>
                                            <tr>
                                                <td class="text-muted" style="padding: 5px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: ${BRAND_COLORS.gray600};">
                                                    <span style="color: ${BRAND_COLORS.pending}; margin-right: 8px; font-weight: 600;">3.</span>Once you approve, we'll confirm your booking
                                                </td>
                                            </tr>
                                            <tr>
                                                <td class="text-muted" style="padding: 5px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: ${BRAND_COLORS.gray600};">
                                                    <span style="color: ${BRAND_COLORS.pending}; margin-right: 8px; font-weight: 600;">4.</span>You'll receive a confirmation email with all details
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>

                                <!-- Reference Footer -->
                                <tr>
                                    <td class="padding-mobile" style="padding: 0 32px 24px;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: ${BRAND_COLORS.gray900}; border-radius: 8px;">
                                            <tr>
                                                <td style="padding: 16px; text-align: center;">
                                                    <p style="margin: 0 0 6px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 10px; font-weight: 600; color: ${BRAND_COLORS.gray400}; text-transform: uppercase; letter-spacing: 1px;">
                                                        Reference Number
                                                    </p>
                                                    <p style="margin: 0; font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace; font-size: 18px; font-weight: 700; color: ${BRAND_COLORS.primary}; letter-spacing: 3px;">
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
                                Questions? Call <a href="tel:${safeData.contactPhone}" style="color: ${BRAND_COLORS.primary}; text-decoration: none; font-weight: 500;">${safeData.contactPhone}</a> or email <a href="mailto:${safeData.contactEmail}" style="color: ${BRAND_COLORS.primary}; text-decoration: none;">${safeData.contactEmail}</a>
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

  const text = `AC SHUTTLES - REQUEST RECEIVED

We're reviewing your request

Hi ${data.customerName}, thanks for choosing AC Shuttles! We've received your trip request and our driver will reach out to you shortly with a personalized quote.

TRIP SUMMARY
============
From: ${data.startLocation}
  |
To: ${data.endLocation}

Date: ${data.pickupDate}
Time: ${data.pickupTime}
Passengers: ${data.passengers || '1'}

WHAT HAPPENS NEXT?
==================
1. We're reviewing your request now
2. Our driver will call or text you with a trip quote
3. Once you approve, we'll confirm your booking
4. You'll receive a confirmation email with all details

REFERENCE NUMBER: ${data.bookingRef}

Questions? Call ${data.contactPhone} or email ${data.contactEmail}

---
AC Shuttles - Private Shuttle Service
Serving NJ, Philadelphia & NYC Area`;

  return { html, text };
}
