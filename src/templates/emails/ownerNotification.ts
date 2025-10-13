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
  arrivalTime: string;
  pickupDate: string;
  arrivalDate: string;
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
            line-height: 1.4;
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
            font-size: 24px;
            margin-bottom: 8px;
        }
        
        .header p {
            color: #5a7a6a;
            font-size: 16px;
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
        
        /* Route Display */
        .route-section {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            margin-bottom: 24px;
            padding: 20px 16px;
            background: #f8fdf8;
            border-radius: 12px;
            border: 2px dashed #d0e7d0;
            min-height: 120px;
        }
        
        .route-item {
            flex: 1;
            font-size: 22px;
            color: #333;
            font-weight: 500;
            line-height: 1.6;
            padding: 20px 16px;
            text-align: left;
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
            min-height: 80px;
        }
        
        .route-item strong {
            color: #2d5a3d;
            font-weight: 700;
        }
        
        .route-arrow {
            margin: 0 16px;
            font-size: 24px;
            color: #4a8a5a;
            align-self: center;
            flex-shrink: 0;
        }
        
        /* Fare & Pickup Time */
        .fare-time-section {
            margin-bottom: 20px;
        }
        
        .fare-pickup-grid {
            display: flex;
            gap: 16px;
        }
        
        .fare-box, .pickup-box {
            flex: 1;
            text-align: center;
            padding: 20px;
            background: #f8fdf8;
            border-radius: 8px;
            border: 2px solid #d0e7d0;
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
        
        .trip-details-grid {
            display: flex;
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
            flex: 1;
            text-align: center;
            padding: 20px 12px;
            border-right: 1px solid #d0e7d0;
        }
        
        .detail-box:last-child {
            border-right: none;
        }
        
        .detail-label {
            font-size: 16px;
            color: #2d5a3d;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 10px;
            font-weight: 700;
        }
        
        .detail-value {
            font-size: 28px;
            font-weight: 900;
            color: #2d5a3d;
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
            font-size: 20px;
            color: #2d5a3d;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 16px;
            font-weight: 700;
        }
        
        .info-content {
            color: #333;
            font-size: 22px;
            line-height: 1.6;
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
            font-size: 18px;
            font-weight: 700;
            color: #2d5a3d;
            margin-bottom: 20px;
        }
        
        .action-button {
            display: block;
            width: 100%;
            padding: 18px 24px;
            margin-bottom: 12px;
            border-radius: 12px;
            text-decoration: none;
            font-weight: 700;
            font-size: 16px;
            text-align: center;
            border: none;
            transition: all 0.2s ease;
        }
        
        .accept-button {
            background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
            color: white;
            box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);
        }
        
        .accept-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(34, 197, 94, 0.4);
        }
        
        .decline-button {
            background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
            color: white;
            box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
        }
        
        .decline-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(239, 68, 68, 0.4);
        }
        
        .button-subtitle {
            font-size: 12px;
            opacity: 0.9;
            margin-top: 4px;
        }

        .map-button {
            background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
            color: white;
            box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
        }

        .map-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(59, 130, 246, 0.4);
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
            font-size: 13px;
            color: #a16207;
            line-height: 1.4;
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
                padding: 10px;
            }
            
            .route-section {
                flex-direction: column;
                padding: 16px;
                min-height: auto;
            }
            
            .route-arrow {
                margin: 12px 0;
                transform: rotate(90deg);
            }
            
            .route-item {
                font-size: 18px;
                padding: 16px 12px;
            }
            
            .fare-pickup-grid {
                flex-direction: column;
                gap: 12px;
            }
            
            .fare-box, .pickup-box {
                padding: 16px;
            }
            
            .detail-value {
                font-size: 24px;
            }
            
            .pickup-date {
                font-size: 16px;
            }
            
            .trip-details-grid {
                flex-direction: column;
            }
            
            .detail-box {
                border-right: none;
                border-bottom: 1px solid #d0e7d0;
                padding: 16px;
            }
            
            .detail-box:last-child {
                border-bottom: none;
            }
            
            .info-content {
                font-size: 18px;
            }
            
            
            .ticket-body {
                padding: 16px;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <h1>📍 AC SHUTTLES</h1>
            <p>New Booking Request</p>
        </div>
        
        <div class="ticket-card">
            <div class="ticket-header">
                <div class="ticket-title">🎫 AC SHUTTLES TICKET</div>
                <div class="ticket-subtitle">Booking Request</div>
            </div>
            
            <div class="ticket-body">
                <!-- Route Display -->
                <div class="route-section">
                    <div class="route-item">
                        <strong>FROM:</strong> ${data.startLocation}
                    </div>
                    <div class="route-arrow">🚐</div>
                    <div class="route-item">
                        <strong>TO:</strong> ${data.endLocation}
                    </div>
                </div>
                
                <!-- Fare & Pickup Time -->
                <div class="fare-time-section">
                    <div class="fare-pickup-grid">
                        <div class="fare-box">
                            <div class="detail-label">Fare</div>
                            <div class="detail-value">${data.price}</div>
                        </div>
                        <div class="pickup-box">
                            <div class="detail-label">Pickup Time</div>
                            <div class="detail-value">${data.pickupTime}</div>
                            <div class="pickup-date">${data.pickupDate}</div>
                        </div>
                    </div>
                </div>
                
                <!-- Trip Details -->
                <div class="trip-details-section">
                    <div class="trip-details-grid">
                        <div class="detail-box">
                            <div class="detail-label">Passengers</div>
                            <div class="detail-value">${data.passengers}</div>
                        </div>
                        <div class="detail-box">
                            <div class="detail-label">Duration</div>
                            <div class="detail-value">${data.estimatedDuration}</div>
                        </div>
                        <div class="detail-box">
                            <div class="detail-label">Distance</div>
                            <div class="detail-value">${data.estimatedDistance}</div>
                        </div>
                    </div>
                </div>
                
                <!-- Passenger Details -->
                <div class="info-section">
                    <div class="info-title">👤 Passenger Details</div>
                    <div class="info-content">
                        <div class="contact-item"><strong>Name:</strong> ${data.customerName}</div>
                        <div class="contact-item"><strong>Email:</strong> <a href="mailto:${data.customerEmail}" class="contact-link">${data.customerEmail}</a></div>
                        <div class="contact-item"><strong>Phone:</strong> ${data.customerPhone ? `<a href="tel:${data.customerPhone}" class="contact-link">${data.customerPhone}</a>` : 'Not provided'}</div>
                    </div>
                </div>
                
                
                ${data.notes ? `
                <div class="info-section">
                    <div class="info-title">📝 Special Instructions</div>
                    <div class="info-content">${data.notes}</div>
                </div>
                ` : ''}
                
                <!-- Perforated Line -->
                <div class="perforation"></div>
                
                <!-- Ticket Stub -->
                <div class="ticket-stub">
                    <div class="booking-ref">BOOKING REF: ${data.bookingRef}</div>
                    <div class="validity">Valid Today Only</div>
                </div>
            </div>
        </div>
        
        <!-- Action Buttons -->
        <div class="actions-section">
            <div class="actions-title">⚡ Action Required</div>
            
            <a href="${data.acceptUrl}" class="action-button accept-button">
                ✅ ACCEPT RIDE
                <div class="button-subtitle">Confirm this ticket</div>
            </a>
            
            <a href="${data.denyUrl}" class="action-button decline-button">
                ❌ DECLINE RIDE
                <div class="button-subtitle">Cancel this ticket</div>
            </a>

            ${data.mapUrl ? `
            <a href="${data.mapUrl}" class="action-button map-button" target="_blank" rel="noopener noreferrer">
                🗺️ VIEW ROUTE MAP
                <div class="button-subtitle">See directions on Google Maps</div>
            </a>
            ` : ''}
        </div>

        <!-- Security Notice -->
        <div class="security-notice">
            <div class="security-notice-text">
                ⚠️ Once you choose, this ticket becomes invalid for security. Choose carefully!
            </div>
        </div>
        
        <!-- Footer -->
        <div class="footer">
            📧 Reply to this email to contact the passenger directly
        </div>
    </div>
</body>
</html>`;

  const text = `🎫 AC SHUTTLES - NEW BOOKING REQUEST

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

⚠️ Once you click either link, both become invalid for security.

Reply to this email to contact the passenger directly.`;

  return { html, text };
}