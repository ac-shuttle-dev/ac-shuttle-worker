/**
 * Owner Notification Email Template - Ticket Card Style
 * 
 * This template generates the ticket-style email that owners receive when
 * a new booking request comes in. Features:
 * - Realistic ticket card design with perforated edges
 * - Clear FROM/TO route display with shuttle icon
 * - Organized information sections like a real ticket
 * - Prominent accept/deny buttons
 * - Mobile-responsive design
 */


export interface OwnerNotificationData {
  // Trip details
  startLocation: string;  // Full physical address (e.g., "1000 Boardwalk, Atlantic City, NJ 08401")
  endLocation: string;    // Full physical address (e.g., "101 Atlantic City International Airport, Egg Harbor Township, NJ 08234")
  pickupTime: string;
  arrivalTime?: string;
  pickupDate: string;
  arrivalDate?: string;
  price: string;
  passengers: string;
  estimatedDuration: string;
  estimatedDistance: string;
  mapUrl?: string;  // Google Maps URL for the route

  // Customer details
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;

  // Additional info
  vehicleType?: string;
  notes?: string;
  bookingRef: string;

  // Action URLs
  acceptUrl: string;
  denyUrl: string;
}

export function generateOwnerNotificationEmail(data: OwnerNotificationData): { html: string; text: string } {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Booking Request - AC Shuttles</title>
    <style>
        /* Reset styles */
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background-color: #f0f8f0;
            padding: 20px;
            line-height: 1.6;
            font-size: 16px;
        }
        
        .email-container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #f0f8f0;
        }
        
        .header {
            text-align: center;
            margin-bottom: 20px;
            padding: 20px;
        }
        
        .header h1 {
            color: #2d5a3d;
            font-size: 28px;
            margin-bottom: 10px;
            font-weight: 800;
        }

        .header p {
            color: #5a7a6a;
            font-size: 18px;
            font-weight: 600;
        }
        
        /* Ticket Card Styles */
        .ticket-card {
            background: white;
            border-radius: 16px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            margin: 20px 0;
            overflow: hidden;
            border: 3px solid #e8f5e8;
        }
        
        .ticket-header {
            background: linear-gradient(135deg, #2d5a3d 0%, #4a8a5a 100%);
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
            font-size: 22px;
            font-weight: 800;
            margin-bottom: 6px;
            letter-spacing: 1px;
        }

        .ticket-subtitle {
            font-size: 16px;
            opacity: 0.95;
            font-weight: 600;
        }
        
        .ticket-body {
            padding: 24px;
        }
        
        /* Route Display */
        .route-section {
            margin-bottom: 24px;
            background: #f8fdf8;
            border-radius: 12px;
            border: 2px dashed #d0e7d0;
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
            vertical-align: top;
            border: none;
        }

        .route-arrow-cell {
            width: 16%;
            padding: 20px 8px;
            text-align: center;
            vertical-align: middle;
            border: none;
        }

        .route-label {
            font-size: 14px;
            color: #2d5a3d;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 10px;
            display: block;
        }

        .route-location {
            font-size: 17px;
            color: #1a1a1a;
            font-weight: 600;
            line-height: 1.5;
            word-wrap: break-word;
            word-break: break-word;
            hyphens: auto;
        }

        .route-arrow {
            font-size: 24px;
            color: #4a8a5a;
            display: block;
        }
        
        /* Fare & Pickup Time */
        .fare-time-section {
            margin-bottom: 20px;
        }

        .fare-pickup-table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 8px;
        }

        .fare-box, .pickup-box {
            text-align: center;
            padding: 20px;
            background: #f8fdf8;
            border-radius: 8px;
            border: 2px solid #d0e7d0;
            width: 50%;
        }
        
        .pickup-date {
            font-size: 18px;
            color: #666;
            font-weight: 600;
            margin-top: 6px;
        }
        
        /* Trip Details */
        .trip-details-section {
            margin-bottom: 20px;
        }

        .trip-details-table {
            width: 100%;
            border-collapse: collapse;
            border: 1px solid #d0e7d0;
            border-radius: 8px;
            overflow: hidden;
        }
        
        .time-label {
            font-size: 14px;
            color: #2d5a3d;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 8px;
            font-weight: 700;
        }
        
        .time-value {
            font-size: 24px;
            font-weight: 900;
            color: #2d5a3d;
            margin-bottom: 4px;
        }
        
        .date-value {
            font-size: 16px;
            color: #333;
            font-weight: 600;
        }
        
        .detail-box {
            text-align: center;
            padding: 20px 12px;
            border-right: 1px solid #d0e7d0;
            width: 33.33%;
        }

        .detail-box-last {
            border-right: none;
        }
        
        .detail-label {
            font-size: 14px;
            color: #2d5a3d;
            text-transform: uppercase;
            letter-spacing: 1.2px;
            margin-bottom: 10px;
            font-weight: 800;
        }

        .detail-value {
            font-size: 26px;
            font-weight: 900;
            color: #1a4d2e;
        }
        
        /* Information Sections */
        .info-section {
            margin-bottom: 20px;
            padding: 16px;
            background: #f8fdf8;
            border-radius: 8px;
            border-left: 4px solid #4a8a5a;
        }
        
        .info-title {
            font-size: 16px;
            color: #1a4d2e;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            margin-bottom: 14px;
            font-weight: 800;
        }

        .info-content {
            color: #1a1a1a;
            font-size: 16px;
            line-height: 1.6;
            word-wrap: break-word;
            word-break: break-word;
        }
        
        .address-line {
            margin-bottom: 2px;
        }
        
        .contact-item {
            margin-bottom: 4px;
        }
        
        .contact-link {
            color: #4a8a5a;
            text-decoration: none;
        }
        
        .contact-link:hover {
            text-decoration: underline;
        }
        
        /* Perforated Line */
        .perforation {
            border-top: 2px dashed #d0e7d0;
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
            background: #f0f8f0;
            border-radius: 50%;
            border: 2px solid #d0e7d0;
        }
        
        .perforation::before { left: -8px; }
        .perforation::after { right: -8px; }
        
        /* Ticket Stub */
        .ticket-stub {
            text-align: center;
            padding: 16px;
            background: #f8fdf8;
        }
        
        .booking-ref {
            font-size: 14px;
            font-weight: 700;
            color: #2d5a3d;
            margin-bottom: 4px;
        }
        
        .validity {
            font-size: 11px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        /* Action Buttons */
        .actions-section {
            margin: 24px 0;
            text-align: center;
        }
        
        .actions-title {
            font-size: 20px;
            font-weight: 800;
            color: #1a4d2e;
            margin-bottom: 20px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        .action-button {
            display: block;
            width: 100%;
            padding: 22px 28px;
            margin-bottom: 14px;
            border-radius: 12px;
            text-decoration: none !important;
            font-weight: 800;
            font-size: 18px;
            text-align: center;
            border: none;
            letter-spacing: 0.5px;
        }

        .accept-button {
            background-color: #059669;
            color: #ffffff !important;
            box-shadow: 0 6px 16px rgba(5, 150, 105, 0.4);
        }

        .decline-button {
            background-color: #dc2626;
            color: #ffffff !important;
            box-shadow: 0 6px 16px rgba(220, 38, 38, 0.4);
        }

        .button-subtitle {
            font-size: 13px;
            margin-top: 6px;
            font-weight: 600;
            color: #ffffff !important;
        }

        .map-button {
            background-color: #2563eb;
            color: #ffffff !important;
            box-shadow: 0 6px 16px rgba(37, 99, 235, 0.4);
        }

        /* Security Notice */
        .security-notice {
            text-align: center;
            padding: 16px;
            background: #fef3cd;
            border: 1px solid #fde047;
            border-radius: 8px;
            margin: 20px 0;
        }
        
        .security-notice-text {
            font-size: 14px;
            color: #92400e;
            line-height: 1.5;
            font-weight: 600;
        }
        
        /* Footer */
        .footer {
            text-align: center;
            margin-top: 24px;
            padding: 20px;
            border-top: 2px solid #e8f5e8;
            color: #666;
            font-size: 14px;
        }
        
        /* Mobile Responsive */
        @media only screen and (max-width: 600px) {
            body {
                padding: 12px !important;
                font-size: 15px !important;
            }

            .ticket-body {
                padding: 18px !important;
            }

            .route-table {
                table-layout: auto !important;
            }

            .route-cell {
                display: block !important;
                width: 100% !important;
                padding: 14px !important;
            }

            .route-arrow-cell {
                display: block !important;
                width: 100% !important;
                padding: 10px !important;
            }

            .route-arrow {
                transform: rotate(90deg);
                font-size: 22px !important;
            }

            .route-label {
                font-size: 13px !important;
            }

            .route-location {
                font-size: 16px !important;
            }

            .fare-pickup-table {
                border-spacing: 0 !important;
            }

            .fare-box, .pickup-box {
                display: block !important;
                width: 100% !important;
                padding: 18px !important;
                margin-bottom: 8px !important;
            }

            .fare-pickup-table tr {
                display: block !important;
            }

            .fare-pickup-table td {
                display: block !important;
                width: 100% !important;
            }

            .detail-label {
                font-size: 15px !important;
            }

            .detail-value {
                font-size: 24px !important;
            }

            .pickup-date {
                font-size: 17px !important;
            }

            .trip-details-table tr {
                display: block !important;
            }

            .trip-details-table td {
                display: block !important;
                width: 100% !important;
            }

            .detail-box {
                border-right: none !important;
                border-bottom: 1px solid #d0e7d0 !important;
                padding: 16px !important;
            }

            .detail-box-last {
                border-bottom: none !important;
            }

            .info-title {
                font-size: 18px !important;
            }

            .info-content {
                font-size: 15px !important;
            }

            .header h1 {
                font-size: 24px !important;
            }

            .header p {
                font-size: 16px !important;
            }

            .ticket-title {
                font-size: 20px !important;
            }

            .ticket-subtitle {
                font-size: 15px !important;
            }

            .actions-title {
                font-size: 18px !important;
            }

            .action-button {
                padding: 20px 24px !important;
                font-size: 17px !important;
            }

            .button-subtitle {
                font-size: 12px !important;
            }
        }

        /* Extra Small Devices */
        @media only screen and (max-width: 480px) {
            body {
                padding: 10px !important;
                font-size: 14px !important;
            }

            .ticket-body {
                padding: 14px !important;
            }

            .route-label {
                font-size: 12px !important;
            }

            .route-location {
                font-size: 15px !important;
            }

            .detail-label {
                font-size: 14px !important;
            }

            .detail-value {
                font-size: 22px !important;
            }

            .pickup-date {
                font-size: 16px !important;
            }

            .info-title {
                font-size: 17px !important;
            }

            .info-content {
                font-size: 14px !important;
            }

            .header h1 {
                font-size: 22px !important;
            }

            .header p {
                font-size: 15px !important;
            }

            .action-button {
                padding: 18px 22px !important;
                font-size: 16px !important;
            }

            .button-subtitle {
                font-size: 11px !important;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <h1>AC SHUTTLES</h1>
            <p>New Booking Request</p>
        </div>
        
        <div class="ticket-card">
            <div class="ticket-header">
                <div class="ticket-title">AC SHUTTLES TICKET</div>
                <div class="ticket-subtitle">Booking Request</div>
            </div>
            
            <div class="ticket-body">
                <!-- Route Display -->
                <div class="route-section">
                    <table class="route-table" width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
                        <tr>
                            <td class="route-cell" width="42%" valign="top">
                                <span class="route-label">FROM:</span>
                                <div class="route-location">${data.startLocation}</div>
                            </td>
                            <td class="route-arrow-cell" width="16%" align="center" valign="middle">
                                <span class="route-arrow">→</span>
                            </td>
                            <td class="route-cell" width="42%" valign="top">
                                <span class="route-label">TO:</span>
                                <div class="route-location">${data.endLocation}</div>
                            </td>
                        </tr>
                    </table>
                </div>
                
                <!-- Fare & Pickup Time -->
                <div class="fare-time-section">
                    <table class="fare-pickup-table" width="100%" cellpadding="0" cellspacing="8" border="0" role="presentation">
                        <tr>
                            <td class="fare-box" width="50%" align="center" valign="middle" style="text-align: center; padding: 20px; background: #f8fdf8; border-radius: 8px; border: 2px solid #d0e7d0;">
                                <div class="detail-label" style="font-size: 14px; color: #2d5a3d; text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 10px; font-weight: 800;">Fare</div>
                                <div class="detail-value" style="font-size: 26px; font-weight: 900; color: #1a4d2e;">${data.price}</div>
                            </td>
                            <td class="pickup-box" width="50%" align="center" valign="middle" style="text-align: center; padding: 20px; background: #f8fdf8; border-radius: 8px; border: 2px solid #d0e7d0;">
                                <div class="detail-label" style="font-size: 14px; color: #2d5a3d; text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 10px; font-weight: 800;">Pickup Time</div>
                                <div class="detail-value" style="font-size: 26px; font-weight: 900; color: #1a4d2e;">${data.pickupTime}</div>
                                <div class="pickup-date" style="font-size: 18px; color: #666; font-weight: 600; margin-top: 6px;">${data.pickupDate}</div>
                            </td>
                        </tr>
                    </table>
                </div>
                
                <!-- Trip Details -->
                <div class="trip-details-section">
                    <table class="trip-details-table" width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="border: 1px solid #d0e7d0; border-radius: 8px;">
                        <tr>
                            <td class="detail-box" width="33.33%" align="center" valign="middle" style="text-align: center; padding: 20px 12px; border-right: 1px solid #d0e7d0;">
                                <div class="detail-label" style="font-size: 14px; color: #2d5a3d; text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 10px; font-weight: 800;">Passengers</div>
                                <div class="detail-value" style="font-size: 26px; font-weight: 900; color: #1a4d2e;">${data.passengers}</div>
                            </td>
                            <td class="detail-box" width="33.33%" align="center" valign="middle" style="text-align: center; padding: 20px 12px; border-right: 1px solid #d0e7d0;">
                                <div class="detail-label" style="font-size: 14px; color: #2d5a3d; text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 10px; font-weight: 800;">Duration</div>
                                <div class="detail-value" style="font-size: 26px; font-weight: 900; color: #1a4d2e;">${data.estimatedDuration}</div>
                            </td>
                            <td class="detail-box detail-box-last" width="33.33%" align="center" valign="middle" style="text-align: center; padding: 20px 12px;">
                                <div class="detail-label" style="font-size: 14px; color: #2d5a3d; text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 10px; font-weight: 800;">Distance</div>
                                <div class="detail-value" style="font-size: 26px; font-weight: 900; color: #1a4d2e;">${data.estimatedDistance}</div>
                            </td>
                        </tr>
                    </table>
                </div>
                
                <!-- Passenger Details -->
                <div class="info-section">
                    <div class="info-title">PASSENGER DETAILS</div>
                    <div class="info-content">
                        <div class="contact-item"><strong>Name:</strong> ${data.customerName}</div>
                        <div class="contact-item"><strong>Email:</strong> <a href="mailto:${data.customerEmail}" class="contact-link">${data.customerEmail}</a></div>
                        <div class="contact-item"><strong>Phone:</strong> ${data.customerPhone ? `<a href="tel:${data.customerPhone}" class="contact-link">${data.customerPhone}</a>` : 'Not provided'}</div>
                    </div>
                </div>
                
                
                ${data.notes ? `
                <div class="info-section">
                    <div class="info-title">SPECIAL INSTRUCTIONS</div>
                    <div class="info-content">${data.notes}</div>
                </div>
                ` : ''}
                
                <!-- Perforated Line -->
                <div class="perforation"></div>
                
                <!-- Ticket Stub -->
                <div class="ticket-stub">
                    <div class="booking-ref">BOOKING REF: ${data.bookingRef}</div>
                </div>
            </div>
        </div>
        
        <!-- Action Buttons -->
        <div class="actions-section">
            <div class="actions-title">ACTION REQUIRED</div>

            <a href="${data.acceptUrl}" class="action-button accept-button" style="display: block; width: 100%; padding: 22px 28px; margin-bottom: 14px; border-radius: 12px; text-decoration: none; font-weight: 800; font-size: 18px; text-align: center; background-color: #059669; color: #ffffff; box-shadow: 0 6px 16px rgba(5, 150, 105, 0.4); letter-spacing: 0.5px;">
                <span style="color: #ffffff; text-decoration: none;">ACCEPT RIDE</span>
                <div class="button-subtitle" style="font-size: 13px; margin-top: 6px; font-weight: 600; color: #ffffff;">Confirm this ticket</div>
            </a>

            <a href="${data.denyUrl}" class="action-button decline-button" style="display: block; width: 100%; padding: 22px 28px; margin-bottom: 14px; border-radius: 12px; text-decoration: none; font-weight: 800; font-size: 18px; text-align: center; background-color: #dc2626; color: #ffffff; box-shadow: 0 6px 16px rgba(220, 38, 38, 0.4); letter-spacing: 0.5px;">
                <span style="color: #ffffff; text-decoration: none;">DECLINE RIDE</span>
                <div class="button-subtitle" style="font-size: 13px; margin-top: 6px; font-weight: 600; color: #ffffff;">Cancel this ticket</div>
            </a>

            ${data.mapUrl ? `
            <a href="${data.mapUrl}" class="action-button map-button" target="_blank" rel="noopener noreferrer" style="display: block; width: 100%; padding: 22px 28px; margin-bottom: 14px; border-radius: 12px; text-decoration: none; font-weight: 800; font-size: 18px; text-align: center; background-color: #2563eb; color: #ffffff; box-shadow: 0 6px 16px rgba(37, 99, 235, 0.4); letter-spacing: 0.5px;">
                <span style="color: #ffffff; text-decoration: none;">VIEW ROUTE MAP</span>
                <div class="button-subtitle" style="font-size: 13px; margin-top: 6px; font-weight: 600; color: #ffffff;">See directions on Google Maps</div>
            </a>
            ` : ''}
        </div>

        <!-- Security Notice -->
        <div class="security-notice">
            <div class="security-notice-text">
                IMPORTANT: Once you choose, this ticket becomes invalid for security. Choose carefully!
            </div>
        </div>
        
        <!-- Footer -->
        <div class="footer">
            Reply to this email to contact the passenger directly
        </div>
    </div>
</body>
</html>`;

  const text = `AC SHUTTLES - NEW BOOKING REQUEST

TICKET DETAILS:
===============
From: ${data.startLocation}
To: ${data.endLocation}
Pickup Time: ${data.pickupTime} on ${data.pickupDate}
Passengers: ${data.passengers}
Fare: ${data.price}
Duration: ${data.estimatedDuration}

PASSENGER DETAILS:
==================
Name: ${data.customerName}
Email: ${data.customerEmail}
Phone: ${data.customerPhone || 'Not provided'}

PICKUP ADDRESS:
===============
${data.startLocation}

DROPOFF ADDRESS:
================
${data.endLocation}

${data.notes ? `SPECIAL INSTRUCTIONS:
====================
${data.notes}

` : ''}${data.mapUrl ? `VIEW ROUTE MAP:
===============
${data.mapUrl}

` : ''}ACTION REQUIRED:
================
Accept: ${data.acceptUrl}
Decline: ${data.denyUrl}

BOOKING REF: ${data.bookingRef}

IMPORTANT: Once you click either link, both become invalid for security.

Reply to this email to contact the passenger directly.`;

  return { html, text };
}