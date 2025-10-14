/**
 * Customer Submission Acknowledgment Email Template
 *
 * This template generates a simple acknowledgment email sent immediately after
 * a customer submits a booking request. Features:
 * - Quick thank you message
 * - Contact information for questions
 * - Transaction reference number
 * - Route summary for confirmation
 */

export interface CustomerSubmissionAckData {
  // Customer details
  customerName: string;
  customerEmail: string;

  // Trip summary
  startLocation: string;
  endLocation: string;
  pickupTime: string;
  pickupDate: string;

  // Reference
  bookingRef: string;  // Transaction ID for customer reference

  // Contact info
  contactPhone: string;
  contactEmail: string;
}

export function generateCustomerSubmissionAckEmail(data: CustomerSubmissionAckData): { html: string; text: string } {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Submission Received - AC Shuttles</title>
    <style>
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background-color: #f5f5f5;
            padding: 20px;
            line-height: 1.6;
        }

        .email-container {
            max-width: 600px;
            margin: 0 auto;
            background-color: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .header {
            background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
            color: white;
            padding: 32px 24px;
            text-align: center;
        }

        .header-icon {
            font-size: 48px;
            margin-bottom: 12px;
        }

        .header-title {
            font-size: 24px;
            font-weight: 700;
            margin-bottom: 8px;
        }

        .header-subtitle {
            font-size: 16px;
            opacity: 0.9;
        }

        .content {
            padding: 32px 24px;
        }

        .message {
            font-size: 16px;
            color: #333;
            margin-bottom: 24px;
            line-height: 1.6;
        }

        .info-box {
            background: #f8f9fa;
            border-left: 4px solid #2563eb;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 24px;
        }

        .info-title {
            font-size: 14px;
            font-weight: 700;
            color: #2563eb;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 12px;
        }

        .info-item {
            font-size: 15px;
            color: #555;
            margin-bottom: 8px;
        }

        .info-item strong {
            color: #333;
            font-weight: 600;
        }

        .contact-section {
            background: #e7f3ff;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 24px;
        }

        .contact-title {
            font-size: 16px;
            font-weight: 700;
            color: #1d4ed8;
            margin-bottom: 12px;
        }

        .contact-item {
            font-size: 15px;
            color: #333;
            margin-bottom: 8px;
        }

        .contact-link {
            color: #2563eb;
            text-decoration: none;
            font-weight: 600;
        }

        .contact-link:hover {
            text-decoration: underline;
        }

        .reference-box {
            background: #f0f0f0;
            border-radius: 8px;
            padding: 16px;
            text-align: center;
            margin-bottom: 24px;
        }

        .reference-label {
            font-size: 12px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 6px;
        }

        .reference-value {
            font-size: 20px;
            font-weight: 700;
            color: #2563eb;
            font-family: 'Courier New', monospace;
        }

        .footer {
            padding: 24px;
            text-align: center;
            background: #f8f9fa;
            border-top: 1px solid #e5e7eb;
        }

        .footer-text {
            font-size: 14px;
            color: #666;
            line-height: 1.5;
        }

        .logo {
            font-size: 18px;
            font-weight: 700;
            color: #333;
            margin-bottom: 8px;
        }

        /* Mobile Responsive */
        @media only screen and (max-width: 600px) {
            body {
                padding: 10px;
            }

            .header {
                padding: 24px 16px;
            }

            .header-title {
                font-size: 20px;
            }

            .header-subtitle {
                font-size: 14px;
            }

            .content {
                padding: 24px 16px;
            }

            .message {
                font-size: 15px;
            }

            .info-box,
            .contact-section {
                padding: 16px;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <div class="header-title">Thank You for Your Submission!</div>
            <div class="header-subtitle">We've received your ride request</div>
        </div>

        <div class="content">
            <div class="message">
                Hi <strong>${data.customerName}</strong>,<br><br>
                Thank you for submitting your ride request with AC Shuttles. We have received your booking and will review it shortly. We'll be in touch soon to confirm your ride details.
            </div>

            <div class="info-box">
                <div class="info-title">Your Ride Request</div>
                <div class="info-item"><strong>From:</strong> ${data.startLocation}</div>
                <div class="info-item"><strong>To:</strong> ${data.endLocation}</div>
                <div class="info-item"><strong>Pickup:</strong> ${data.pickupTime} on ${data.pickupDate}</div>
            </div>

            <div class="reference-box">
                <div class="reference-label">Your Reference Number</div>
                <div class="reference-value">${data.bookingRef}</div>
            </div>

            <div class="contact-section">
                <div class="contact-title">Have Questions?</div>
                <div class="contact-item">
                    Email: <a href="mailto:${data.contactEmail}" class="contact-link">${data.contactEmail}</a>
                </div>
                <div class="contact-item">
                    Text/Call: <a href="tel:${data.contactPhone}" class="contact-link">${data.contactPhone}</a>
                </div>
                <div class="info-item" style="margin-top: 12px; font-size: 14px; color: #666;">
                    We'll get back to you at the earliest convenience.
                </div>
            </div>
        </div>

        <div class="footer">
            <div class="logo">AC SHUTTLES</div>
            <div class="footer-text">
                This is an automated confirmation. Please do not reply to this email.<br>
                Use the contact information above for questions.
            </div>
        </div>
    </div>
</body>
</html>`;

  const text = `AC SHUTTLES - SUBMISSION RECEIVED

THANK YOU FOR YOUR SUBMISSION!

Hi ${data.customerName},

Thank you for submitting your ride request with AC Shuttles. We have received your booking and will review it shortly. We'll be in touch soon to confirm your ride details.

YOUR RIDE REQUEST:
==================
From: ${data.startLocation}
To: ${data.endLocation}
Pickup: ${data.pickupTime} on ${data.pickupDate}

YOUR REFERENCE NUMBER:
======================
${data.bookingRef}

HAVE QUESTIONS?
===============
Email: ${data.contactEmail}
Text/Call: ${data.contactPhone}

We'll get back to you at the earliest convenience.

---
AC SHUTTLES
This is an automated confirmation. Please do not reply to this email.
Use the contact information above for questions.`;

  return { html, text };
}
