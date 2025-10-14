/**
 * Customer Denial Email Template - Cancelled Ticket Style
 * 
 * This template generates the ticket-style denial email that customers
 * receive when their booking is declined. Features:
 * - Cancelled ticket design with red/gray styling
 * - Clear cancellation notice and reason
 * - Alternative options and contact information
 * - Professional appearance that explains next steps
 */


export interface CustomerDenialData {
  // Trip details
  startLocation: string;  // Full physical address (e.g., "1000 Boardwalk, Atlantic City, NJ 08401")
  endLocation: string;    // Full physical address (e.g., "101 Atlantic City International Airport, Egg Harbor Township, NJ 08234")
  pickupTime: string;
  pickupDate: string;
  passengers: string;
  mapUrl?: string;  // Google Maps URL for the route

  // Customer details
  customerName: string;
  customerEmail: string;

  // Contact details
  contactPhone: string;
  contactEmail: string;
  websiteUrl?: string;

  // Additional info
  reason?: string;
  bookingRef: string;
}

export function generateCustomerDenialEmail(data: CustomerDenialData): { html: string; text: string } {
  const defaultReason = "Schedule conflict or route limitations";
  const reason = data.reason || defaultReason;
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Booking Update - AC Shuttles</title>
    <style>
        /* Reset styles */
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background-color: #fafafa;
            padding: 20px;
            line-height: 1.4;
        }
        
        .email-container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #fafafa;
        }
        
        .header {
            text-align: center;
            margin-bottom: 20px;
            padding: 20px;
        }
        
        .header h1 {
            color: #333;
            font-size: 24px;
            margin-bottom: 8px;
        }
        
        /* Ticket Card Styles */
        .ticket-card {
            background: white;
            border-radius: 16px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            margin: 20px 0;
            overflow: hidden;
            border: 3px solid #fecaca;
        }
        
        .ticket-header {
            background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%);
            color: white;
            padding: 20px;
            text-align: center;
            position: relative;
        }
        
        .ticket-header::before,
        .ticket-header::after {
            content: '';
            position: absolute;
            top: 0;
            bottom: 0;
            width: 2px;
            background: repeating-linear-gradient(
                to bottom,
                transparent 0px,
                transparent 4px,
                white 4px,
                white 8px
            );
        }
        
        .ticket-header::before { left: 0; }
        .ticket-header::after { right: 0; }
        
        .ticket-title {
            font-size: 18px;
            font-weight: 700;
            margin-bottom: 4px;
        }
        
        .ticket-subtitle {
            font-size: 14px;
            opacity: 0.9;
        }
        
        .ticket-body {
            padding: 24px;
        }
        
        /* Route Display - Cancelled */
        .route-section {
            margin-bottom: 24px;
            background: #fef2f2;
            border-radius: 12px;
            border: 2px solid #fecaca;
            opacity: 0.7;
            overflow: hidden;
        }

        .route-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            mso-table-lspace: 0pt;
            mso-table-rspace: 0pt;
        }

        .route-cell {
            width: 42%;
            padding: 20px 12px;
            text-align: center;
            vertical-align: middle;
            border: none;
        }

        .route-arrow-cell {
            width: 16%;
            padding: 20px 8px;
            text-align: center;
            vertical-align: middle;
            border: none;
        }

        .location-name {
            font-size: 18px;
            color: #333;
            font-weight: 600;
            line-height: 1.4;
            word-wrap: break-word;
            word-break: break-word;
            hyphens: auto;
        }

        .route-arrow {
            font-size: 20px;
            color: #dc2626;
            display: block;
        }
        
        /* Pickup Time */
        .pickup-time-section {
            text-align: center;
            margin-bottom: 20px;
            padding: 20px;
            background: #fef2f2;
            border-radius: 8px;
            border: 2px solid #fecaca;
            opacity: 0.7;
        }
        
        .time-label {
            font-size: 18px;
            color: #dc2626;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 8px;
            font-weight: 700;
        }
        
        .time-value {
            font-size: 28px;
            font-weight: 900;
            color: #dc2626;
            margin-bottom: 4px;
        }
        
        .date-value {
            font-size: 20px;
            color: #333;
            font-weight: 600;
        }
        
        /* Details Grid */
        .details-grid {
            display: flex;
            margin-bottom: 20px;
            border: 1px solid #fecaca;
            border-radius: 8px;
            overflow: hidden;
            opacity: 0.7;
        }
        
        .detail-box {
            flex: 1;
            text-align: center;
            padding: 16px 8px;
            border-right: 1px solid #fecaca;
        }
        
        .detail-box:last-child {
            border-right: none;
        }
        
        .detail-label {
            font-size: 14px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 6px;
            font-weight: 600;
        }
        
        .detail-value {
            font-size: 22px;
            font-weight: 700;
            color: #dc2626;
        }
        
        /* Information Sections */
        .info-section {
            margin-bottom: 20px;
            padding: 16px;
            background: #fef2f2;
            border-radius: 8px;
            border-left: 4px solid #ef4444;
        }
        
        .info-title {
            font-size: 12px;
            color: #dc2626;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 8px;
            font-weight: 700;
        }
        
        .info-content {
            color: #333;
            font-size: 14px;
            line-height: 1.4;
            word-wrap: break-word;
            word-break: break-word;
        }
        
        .contact-item {
            margin-bottom: 6px;
        }
        
        .contact-link {
            color: #dc2626;
            text-decoration: none;
            font-weight: 600;
        }
        
        .contact-link:hover {
            text-decoration: underline;
        }
        
        .alternative-item {
            margin-bottom: 8px;
            padding: 12px;
            background: white;
            border-radius: 6px;
            border: 1px solid #fecaca;
        }
        
        .alternative-icon {
            display: inline-block;
            width: 20px;
            margin-right: 8px;
        }
        
        /* Perforated Line */
        .perforation {
            border-top: 2px dashed #fecaca;
            margin: 20px 0;
            position: relative;
        }
        
        .perforation::before,
        .perforation::after {
            content: '';
            position: absolute;
            top: -8px;
            width: 16px;
            height: 16px;
            background: #fafafa;
            border-radius: 50%;
            border: 2px solid #fecaca;
        }
        
        .perforation::before { left: -8px; }
        .perforation::after { right: -8px; }
        
        /* Ticket Stub */
        .ticket-stub {
            text-align: center;
            padding: 16px;
            background: #fef2f2;
        }
        
        .booking-ref {
            font-size: 14px;
            font-weight: 700;
            color: #dc2626;
            margin-bottom: 4px;
        }
        
        .validity {
            font-size: 11px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        /* Cancellation Notice */
        .cancellation-notice {
            text-align: center;
            padding: 20px;
            background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
            border-radius: 12px;
            margin: 20px 0;
            border: 2px solid #ef4444;
        }
        
        .cancellation-title {
            font-size: 18px;
            font-weight: 700;
            color: #dc2626;
            margin-bottom: 8px;
        }
        
        .cancellation-text {
            color: #991b1b;
            font-size: 14px;
            line-height: 1.4;
        }
        
        /* Map Button */
        .map-button {
            display: block;
            width: 100%;
            padding: 16px 24px;
            margin: 16px 0;
            background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
            color: white;
            text-decoration: none;
            border-radius: 12px;
            font-weight: 700;
            font-size: 16px;
            text-align: center;
            box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
        }

        .map-button:hover {
            background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
        }

        .button-subtitle {
            font-size: 12px;
            opacity: 0.9;
            margin-top: 4px;
        }

        /* Footer */
        .footer {
            text-align: center;
            margin-top: 24px;
            padding: 20px;
            border-top: 2px solid #fecaca;
            color: #666;
            font-size: 14px;
        }
        
        /* Mobile Responsive */
        @media only screen and (max-width: 600px) {
            body {
                padding: 10px !important;
            }

            .ticket-body {
                padding: 16px !important;
            }

            .route-table {
                table-layout: auto !important;
            }

            .route-cell {
                display: block !important;
                width: 100% !important;
                padding: 12px !important;
            }

            .route-arrow-cell {
                display: block !important;
                width: 100% !important;
                padding: 8px !important;
            }

            .location-name {
                font-size: 16px !important;
            }

            .route-arrow {
                transform: rotate(90deg);
                font-size: 18px !important;
            }

            .pickup-time-section {
                padding: 16px !important;
            }

            .time-value {
                font-size: 24px !important;
            }

            .date-value {
                font-size: 17px !important;
            }

            .details-grid {
                flex-direction: column;
            }

            .detail-box {
                border-right: none !important;
                border-bottom: 1px solid #fecaca !important;
                padding: 14px !important;
            }

            .detail-box:last-child {
                border-bottom: none !important;
            }

            .detail-value {
                font-size: 20px !important;
            }

            .info-content {
                font-size: 13px !important;
            }

            .header h1 {
                font-size: 20px !important;
            }

            .cancellation-title {
                font-size: 16px !important;
            }

            .cancellation-text {
                font-size: 13px !important;
            }
        }

        /* Extra Small Devices */
        @media only screen and (max-width: 480px) {
            body {
                padding: 8px !important;
            }

            .ticket-body {
                padding: 12px !important;
            }

            .location-name {
                font-size: 14px !important;
            }

            .time-value {
                font-size: 22px !important;
            }

            .date-value {
                font-size: 16px !important;
            }

            .detail-value {
                font-size: 18px !important;
            }

            .info-content {
                font-size: 12px !important;
            }

            .alternative-item {
                font-size: 13px !important;
                padding: 10px !important;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <h1 style="color: #333;">AC SHUTTLES</h1>
        </div>
        
        <div class="cancellation-notice">
            <div class="cancellation-title">We cannot accommodate this trip</div>
            <div class="cancellation-text">We regret that we cannot accommodate your ride request at this time</div>
        </div>
        
        <div class="ticket-card">
            <div class="ticket-header">
                <div class="ticket-title">AC SHUTTLES TICKET</div>
                <div class="ticket-subtitle">CANCELLED</div>
            </div>
            
            <div class="ticket-body">
                <!-- Route Display - Cancelled -->
                <div class="route-section">
                    <table class="route-table" width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
                        <tr>
                            <td class="route-cell" width="42%" align="center" valign="middle">
                                <div class="location-name">${data.startLocation}</div>
                            </td>
                            <td class="route-arrow-cell" width="16%" align="center" valign="middle">
                                <span class="route-arrow">X</span>
                            </td>
                            <td class="route-cell" width="42%" align="center" valign="middle">
                                <div class="location-name">${data.endLocation}</div>
                            </td>
                        </tr>
                    </table>
                </div>
                
                <!-- Pickup Time -->
                <div class="pickup-time-section">
                    <div class="time-label">Requested Pickup Time</div>
                    <div class="time-value">${data.pickupTime}</div>
                    <div class="date-value">${data.pickupDate}</div>
                </div>
                
                <!-- Details Grid -->
                <div class="details-grid">
                    <div class="detail-box">
                        <div class="detail-label">Passengers</div>
                        <div class="detail-value">${data.passengers}</div>
                    </div>
                    <div class="detail-box">
                        <div class="detail-label">Status</div>
                        <div class="detail-value">DECLINED</div>
                    </div>
                </div>
                
                <!-- Cancellation Notice -->
                <div class="info-section">
                    <div class="info-title">CANCELLATION NOTICE</div>
                    <div class="info-content">
                        We regret that we cannot accommodate your ride request due to ${reason}. We appreciate your understanding.
                    </div>
                </div>
                
                <!-- Alternative Options -->
                <div class="info-section">
                    <div class="info-title">ALTERNATIVE OPTIONS</div>
                    <div class="info-content">
                        <div class="alternative-item">
                            <strong>Call us:</strong> <a href="tel:${data.contactPhone}" class="contact-link">${data.contactPhone}</a>
                        </div>
                        <div class="alternative-item">
                            <strong>Email us:</strong> <a href="mailto:${data.contactEmail}" class="contact-link">${data.contactEmail}</a>
                        </div>
                        ${data.websiteUrl ? `
                        <div class="alternative-item">
                            <strong>Website:</strong> <a href="${data.websiteUrl}" class="contact-link">${data.websiteUrl}</a>
                        </div>
                        ` : ''}
                        
                        <div style="margin-top: 12px; padding: 12px; background: #f3f4f6; border-radius: 6px;">
                            <strong>We may have:</strong><br>
                            • Alternative pickup/drop-off times<br>
                            • Different routes available<br>
                            • Partner services that can help
                        </div>
                    </div>
                </div>

                ${data.mapUrl ? `
                <a href="${data.mapUrl}" class="map-button" target="_blank" rel="noopener noreferrer">
                    VIEW REQUESTED ROUTE
                    <div class="button-subtitle">See the route you requested on Google Maps</div>
                </a>
                ` : ''}

                <!-- Perforated Line -->
                <div class="perforation"></div>
                
                <!-- Ticket Stub -->
                <div class="ticket-stub">
                    <div class="booking-ref">BOOKING REF: ${data.bookingRef}</div>
                    <div class="validity">Ride Cancelled</div>
                </div>
            </div>
        </div>
        
        <!-- Footer -->
        <div class="footer">
            We appreciate your understanding and hope to serve you in the future.<br>
            Need help? Call ${data.contactPhone}
        </div>
    </div>
</body>
</html>`;

  const text = `AC SHUTTLES - BOOKING UPDATE

WE CANNOT ACCOMMODATE THIS TRIP
We regret that we cannot accommodate your ride request at this time.

ORIGINAL REQUEST:
=================
From: ${data.startLocation}
To: ${data.endLocation}
Requested: ${data.pickupTime} on ${data.pickupDate}
Passengers: ${data.passengers}

CANCELLATION NOTICE:
====================
We regret that we cannot accommodate your ride request due to ${reason}. We appreciate your understanding.

ALTERNATIVE OPTIONS:
====================
Call us: ${data.contactPhone}
Email us: ${data.contactEmail}
${data.websiteUrl ? `Website: ${data.websiteUrl}\n` : ''}
We may have:
• Alternative pickup/drop-off times
• Different routes available
• Partner services that can help

${data.mapUrl ? `VIEW REQUESTED ROUTE:
=====================
${data.mapUrl}

` : ''}BOOKING REF: ${data.bookingRef}

We appreciate your understanding and hope to serve you in the future.
Need help? Call ${data.contactPhone}`;

  return { html, text };
}