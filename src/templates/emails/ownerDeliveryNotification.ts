/**
 * Owner Delivery Notification Email Template
 *
 * Sent to the owner to confirm that the customer received their booking notification.
 *
 * Visual Theme: Slate (Delivery Confirmation)
 * - Clear visual indicator at top showing "DELIVERY CONFIRMED"
 * - Simple, clean informational design
 * - Quick trip summary for reference
 * - Color-coded badge for accepted/denied
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
  escapeHtml,
  formatHumanReadableTimestamp
} from './utils';

export interface OwnerDeliveryNotificationData {
  // Customer details
  customerName: string;
  customerEmail: string;

  // Trip details
  startLocation: string;
  endLocation: string;
  pickupTime: string;
  pickupDate: string;

  // Notification details
  notificationType: 'accepted' | 'denied';
  deliveredAt: string;
  bookingRef: string;
  transactionId: string;
}

export function generateOwnerDeliveryNotificationEmail(data: OwnerDeliveryNotificationData): { html: string; text: string } {
  const isAccepted = data.notificationType === 'accepted';
  const statusColor = isAccepted ? BRAND_COLORS.success : BRAND_COLORS.danger;
  const statusColorLight = isAccepted ? BRAND_COLORS.successLight : BRAND_COLORS.dangerLight;
  const statusText = isAccepted ? 'Accepted' : 'Declined';
  const statusIcon = isAccepted ? '&#10003;' : '&#10005;';

  // Format the delivery timestamp in human-readable format
  const formattedDeliveredAt = formatHumanReadableTimestamp(data.deliveredAt);

  const safeData = {
    customerName: escapeHtml(data.customerName),
    customerEmail: escapeHtml(data.customerEmail),
    startLocation: escapeHtml(data.startLocation),
    endLocation: escapeHtml(data.endLocation),
    pickupTime: escapeHtml(data.pickupTime),
    pickupDate: escapeHtml(data.pickupDate),
    deliveredAt: escapeHtml(formattedDeliveredAt),
    bookingRef: escapeHtml(data.bookingRef),
    transactionId: escapeHtml(data.transactionId),
  };

  const html = `${getEmailHead('Delivery Confirmation - AC Shuttles')}
${getEmailResetStyles()}
</head>
<body style="margin: 0; padding: 0; background-color: ${BRAND_COLORS.gray100};">
    ${getPreheader(`Customer ${safeData.customerName} has received their booking ${statusText.toLowerCase()} notification.`)}

    <!-- Type Indicator -->
    ${getEmailTypeIndicator('delivery_confirmation')}

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
                                            Email Delivered
                                        </h1>
                                        <p class="text-muted" style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; color: ${BRAND_COLORS.gray600}; line-height: 1.5;">
                                            Customer notification was successfully sent.
                                        </p>
                                    </td>
                                </tr>

                                <!-- Status Badge -->
                                <tr>
                                    <td class="padding-mobile" style="padding: 0 32px 24px;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                            <tr>
                                                <td style="text-align: center;">
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="background-color: ${statusColorLight}; border-radius: 20px; border: 2px solid ${statusColor};">
                                                        <tr>
                                                            <td style="padding: 10px 20px;">
                                                                <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; font-weight: 700; color: ${statusColor};">
                                                                    <span style="margin-right: 6px;">${statusIcon}</span>
                                                                    Booking ${statusText}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>

                                <!-- Main Message -->
                                <tr>
                                    <td class="padding-mobile" style="padding: 0 32px 24px;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" class="email-card-secondary border-light" style="background-color: ${BRAND_COLORS.infoLight}; border-radius: 10px; border: 1px solid ${BRAND_COLORS.info};">
                                            <tr>
                                                <td style="padding: 20px; text-align: center;">
                                                    <p class="text-dark" style="margin: 0 0 6px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; font-weight: 600; color: ${BRAND_COLORS.gray800};">
                                                        ${safeData.customerName} has received their notification
                                                    </p>
                                                    <p class="text-muted" style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: ${BRAND_COLORS.gray600};">
                                                        The booking ${statusText.toLowerCase()} email was delivered successfully
                                                    </p>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>

                                <!-- Customer Info -->
                                <tr>
                                    <td class="padding-mobile" style="padding: 0 32px 24px;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" class="email-card-secondary border-light" style="background-color: ${BRAND_COLORS.gray50}; border-radius: 10px; border: 1px solid ${BRAND_COLORS.gray200};">
                                            <tr>
                                                <td style="padding: 18px 20px;">
                                                    <p class="text-muted" style="margin: 0 0 12px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: ${BRAND_COLORS.gray500};">
                                                        Customer
                                                    </p>
                                                    <p class="text-dark" style="margin: 0 0 4px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; font-weight: 600; color: ${BRAND_COLORS.gray800};">
                                                        ${safeData.customerName}
                                                    </p>
                                                    <p class="text-muted" style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: ${BRAND_COLORS.gray600};">
                                                        ${safeData.customerEmail}
                                                    </p>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>

                                <!-- Trip Summary -->
                                <tr>
                                    <td class="padding-mobile" style="padding: 0 32px 24px;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" class="email-card-secondary border-light" style="background-color: ${BRAND_COLORS.gray50}; border-radius: 10px; border: 1px solid ${BRAND_COLORS.gray200};">
                                            <tr>
                                                <td style="padding: 18px 20px;">
                                                    <p class="text-muted" style="margin: 0 0 12px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: ${BRAND_COLORS.gray500};">
                                                        Trip Summary
                                                    </p>
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                        <tr>
                                                            <td class="text-muted" style="padding: 4px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: ${BRAND_COLORS.gray600};">
                                                                <strong class="text-dark" style="color: ${BRAND_COLORS.gray700};">From:</strong> ${safeData.startLocation}
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td class="text-muted" style="padding: 4px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: ${BRAND_COLORS.gray600};">
                                                                <strong class="text-dark" style="color: ${BRAND_COLORS.gray700};">To:</strong> ${safeData.endLocation}
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td class="text-muted" style="padding: 4px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: ${BRAND_COLORS.gray600};">
                                                                <strong class="text-dark" style="color: ${BRAND_COLORS.gray700};">Pickup:</strong> ${safeData.pickupTime} on ${safeData.pickupDate}
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>

                                <!-- Delivery Details -->
                                <tr>
                                    <td class="padding-mobile" style="padding: 0 32px 24px;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" class="email-card-secondary border-light" style="background-color: ${BRAND_COLORS.gray50}; border-radius: 10px; border-left: 4px solid ${BRAND_COLORS.info};">
                                            <tr>
                                                <td style="padding: 18px 20px;">
                                                    <p style="margin: 0 0 12px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: ${BRAND_COLORS.info};">
                                                        Delivery Details
                                                    </p>
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                        <tr>
                                                            <td class="text-muted" style="padding: 4px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: ${BRAND_COLORS.gray600};">
                                                                <strong class="text-dark" style="color: ${BRAND_COLORS.gray700};">Delivered:</strong> ${safeData.deliveredAt}
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td class="text-muted" style="padding: 4px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: ${BRAND_COLORS.gray600};">
                                                                <strong class="text-dark" style="color: ${BRAND_COLORS.gray700};">Booking Ref:</strong> ${safeData.bookingRef}
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td class="text-muted" style="padding: 4px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; color: ${BRAND_COLORS.gray500};">
                                                                <strong class="text-dark" style="color: ${BRAND_COLORS.gray600};">Transaction:</strong> <span style="font-family: 'SF Mono', 'Monaco', monospace; font-size: 12px;">${safeData.transactionId}</span>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>

                                <!-- Footer Message -->
                                <tr>
                                    <td class="padding-mobile email-card-secondary border-light" style="padding: 20px 32px; background-color: ${BRAND_COLORS.gray50}; border-top: 1px solid ${BRAND_COLORS.gray200};">
                                        <p class="text-muted" style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; color: ${BRAND_COLORS.gray500}; text-align: center; line-height: 1.5;">
                                            This is an automated delivery confirmation.<br>
                                            The customer notification process is complete.
                                        </p>
                                    </td>
                                </tr>

                            </table>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>

    <!-- Simple Footer -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto;">
        <tr>
            <td style="padding: 20px; text-align: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                <p class="text-muted" style="margin: 0; font-size: 13px; color: ${BRAND_COLORS.gray400};">
                    AC Shuttles Notification System
                </p>
            </td>
        </tr>
    </table>

</body>
</html>`;

  const text = `AC SHUTTLES - DELIVERY CONFIRMED

Email Delivered Successfully

STATUS: Booking ${statusText}

${safeData.customerName} has received their booking ${statusText.toLowerCase()} notification.

CUSTOMER
========
Name: ${data.customerName}
Email: ${data.customerEmail}

TRIP SUMMARY
============
From: ${data.startLocation}
To: ${data.endLocation}
Pickup: ${data.pickupTime} on ${data.pickupDate}

DELIVERY DETAILS
================
Delivered: ${formattedDeliveredAt}
Booking Ref: ${data.bookingRef}
Transaction: ${data.transactionId}

---
This is an automated delivery confirmation.
The customer notification process is complete.

AC Shuttles Notification System`;

  return { html, text };
}
