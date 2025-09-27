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

import { parseAddress, generateLocationCode } from './utils';

export interface CustomerDenialData {
  // Trip details
  startLocation: string;  // Full physical address (e.g., "1000 Boardwalk, Atlantic City, NJ 08401")
  endLocation: string;    // Full physical address (e.g., "101 Atlantic City International Airport, Egg Harbor Township, NJ 08234")
  pickupTime: string;
  arrivalTime: string;
  pickupDate: string;
  arrivalDate: string;
  passengers: string;
  estimatedDuration: string;
  
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
  // Parse addresses and generate location codes
  const startLocationCode = generateLocationCode(data.startLocation);
  const endLocationCode = generateLocationCode(data.endLocation);
  const pickupAddress = parseAddress(data.startLocation);
  const dropoffAddress = parseAddress(data.endLocation);
  
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
            color: #dc2626;
            font-size: 24px;
            margin-bottom: 8px;
        }
        
        .header p {
            color: #991b1b;
            font-size: 16px;
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
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 24px;
            padding: 20px;
            background: #fef2f2;
            border-radius: 12px;
            border: 2px solid #fecaca;
            opacity: 0.7;
        }
        
        .location-box {
            text-align: center;
            flex: 1;
        }
        
        .location-code {
            font-size: 24px;
            font-weight: 900;
            color: #7f1d1d;
            margin-bottom: 4px;
        }
        
        .location-name {
            font-size: 12px;
            color: #666;
            font-weight: 500;
        }
        
        .route-arrow {
            margin: 0 16px;
            font-size: 20px;
            color: #dc2626;
        }
        
        /* Times */
        .times-section {
            display: flex;
            justify-content: space-between;
            margin-bottom: 20px;
            padding: 16px;
            background: #fef2f2;
            border-radius: 8px;
            opacity: 0.7;
        }
        
        .time-column {
            text-align: center;
            flex: 1;
        }
        
        .time-label {
            font-size: 11px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 4px;
            font-weight: 600;
        }
        
        .time-value {
            font-size: 16px;
            font-weight: 700;
            color: #7f1d1d;
            margin-bottom: 2px;
        }
        
        .date-value {
            font-size: 12px;
            color: #666;
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
            font-size: 10px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 6px;
            font-weight: 600;
        }
        
        .detail-value {
            font-size: 16px;
            font-weight: 700;
            color: #7f1d1d;
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
                padding: 10px;
            }
            
            .route-section {
                flex-direction: column;
                padding: 16px;
            }
            
            .route-arrow {
                margin: 12px 0;
                transform: rotate(90deg);
            }
            
            .times-section {
                flex-direction: column;
                gap: 12px;
            }
            
            .details-grid {
                flex-direction: column;
            }
            
            .detail-box {
                border-right: none;
                border-bottom: 1px solid #fecaca;
            }
            
            .detail-box:last-child {
                border-bottom: none;
            }
            
            .location-code {
                font-size: 20px;
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
            <p>❌ Booking Update</p>
        </div>
        
        <div class="cancellation-notice">
            <div class="cancellation-title">We cannot accommodate this trip</div>
            <div class="cancellation-text">We regret that we cannot accommodate your ride request at this time</div>
        </div>
        
        <div class="ticket-card">
            <div class="ticket-header">
                <div class="ticket-title">🎫 AC SHUTTLES TICKET</div>
                <div class="ticket-subtitle">❌ CANCELLED</div>
            </div>
            
            <div class="ticket-body">
                <!-- Route Display - Cancelled -->
                <div class="route-section">
                    <div class="location-box">
                        <div class="location-code">${data.startLocationCode}</div>
                        <div class="location-name">${data.startLocation}</div>
                    </div>
                    <div class="route-arrow">❌</div>
                    <div class="location-box">
                        <div class="location-code">${data.endLocationCode}</div>
                        <div class="location-name">${data.endLocation}</div>
                    </div>
                </div>
                
                <!-- Times -->
                <div class="times-section">
                    <div class="time-column">
                        <div class="time-label">Requested</div>
                        <div class="time-value">${data.pickupTime}</div>
                        <div class="date-value">${data.pickupDate}</div>
                    </div>
                    <div class="time-column">
                        <div class="time-label">Requested</div>
                        <div class="time-value">${data.arrivalTime}</div>
                        <div class="date-value">${data.arrivalDate}</div>
                    </div>
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
                    <div class="detail-box">
                        <div class="detail-label">Duration</div>
                        <div class="detail-value">${data.estimatedDuration}</div>
                    </div>
                </div>
                
                <!-- Cancellation Notice -->
                <div class="info-section">
                    <div class="info-title">📋 Cancellation Notice</div>
                    <div class="info-content">
                        We regret that we cannot accommodate your ride request due to ${reason}. We appreciate your understanding.
                    </div>
                </div>
                
                <!-- Alternative Options -->
                <div class="info-section">
                    <div class="info-title">🔄 Alternative Options</div>
                    <div class="info-content">
                        <div class="alternative-item">
                            <span class="alternative-icon">📞</span>
                            <strong>Call us:</strong> <a href="tel:${data.contactPhone}" class="contact-link">${data.contactPhone}</a>
                        </div>
                        <div class="alternative-item">
                            <span class="alternative-icon">📧</span>
                            <strong>Email us:</strong> <a href="mailto:${data.contactEmail}" class="contact-link">${data.contactEmail}</a>
                        </div>
                        ${data.websiteUrl ? `
                        <div class="alternative-item">
                            <span class="alternative-icon">🌐</span>
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
                
                <!-- Original Request -->
                <div class="info-section">
                    <div class="info-title">📍 Original Request</div>
                    <div class="info-content">
                        <div style="margin-bottom: 8px;">
                            <strong>Pickup:</strong><br>
                            ${data.pickupAddress.street}<br>
                            ${data.pickupAddress.suite ? data.pickupAddress.suite + '<br>' : ''}
                            ${data.pickupAddress.city}, ${data.pickupAddress.state} ${data.pickupAddress.zipCode}
                        </div>
                        <div>
                            <strong>Dropoff:</strong><br>
                            ${data.dropoffAddress.street}<br>
                            ${data.dropoffAddress.suite ? data.dropoffAddress.suite + '<br>' : ''}
                            ${data.dropoffAddress.city}, ${data.dropoffAddress.state} ${data.dropoffAddress.zipCode}
                        </div>
                    </div>
                </div>
                
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
            📞 Need help? Call ${data.contactPhone}
        </div>
    </div>
</body>
</html>`;

  const text = `🎫 AC SHUTTLES - BOOKING UPDATE

❌ WE CANNOT ACCOMMODATE THIS TRIP
We regret that we cannot accommodate your ride request at this time.

ORIGINAL REQUEST:
=================
Route: ${data.startLocationCode} (${data.startLocation}) → ${data.endLocationCode} (${data.endLocation})
Requested: ${data.pickupTime} on ${data.pickupDate}
Passengers: ${data.passengers}
Duration: ${data.estimatedDuration}

CANCELLATION NOTICE:
====================
We regret that we cannot accommodate your ride request due to ${reason}. We appreciate your understanding.

ALTERNATIVE OPTIONS:
====================
📞 Call us: ${data.contactPhone}
📧 Email us: ${data.contactEmail}
${data.websiteUrl ? `🌐 Website: ${data.websiteUrl}\n` : ''}
We may have:
• Alternative pickup/drop-off times
• Different routes available  
• Partner services that can help

ORIGINAL PICKUP:
================
${data.pickupAddress.street}
${data.pickupAddress.suite ? data.pickupAddress.suite + '\n' : ''}${data.pickupAddress.city}, ${data.pickupAddress.state} ${data.pickupAddress.zipCode}

ORIGINAL DROPOFF:
=================
${data.dropoffAddress.street}
${data.dropoffAddress.suite ? data.dropoffAddress.suite + '\n' : ''}${data.dropoffAddress.city}, ${data.dropoffAddress.state} ${data.dropoffAddress.zipCode}

BOOKING REF: ${data.bookingRef}

We appreciate your understanding and hope to serve you in the future.
Need help? Call ${data.contactPhone}`;

  return { html, text };
}