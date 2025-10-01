/**
 * Customer Confirmation Email Template - Confirmed Ticket Style
 * 
 * This template generates the ticket-style confirmation email that customers
 * receive when their booking is accepted. Features:
 * - Confirmed ticket design with green success styling
 * - Driver contact information prominently displayed
 * - Clear pickup instructions and timing
 * - Professional ticket appearance customers can save/show
 */


export interface CustomerConfirmationData {
  // Trip details
  startLocation: string;  // Full physical address (e.g., "1000 Boardwalk, Atlantic City, NJ 08401")
  endLocation: string;    // Full physical address (e.g., "101 Atlantic City International Airport, Egg Harbor Township, NJ 08234")
  pickupTime: string;
  pickupDate: string;
  price: string;
  passengers: string;
  estimatedDuration: string;
  
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
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Booking Confirmed - AC Shuttles</title>
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
            color: #16a34a;
            font-size: 24px;
            margin-bottom: 8px;
        }
        
        .header p {
            color: #166534;
            font-size: 16px;
        }
        
        /* Ticket Card Styles */
        .ticket-card {
            background: white;
            border-radius: 16px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            margin: 20px 0;
            overflow: hidden;
            border: 3px solid #bbf7d0;
        }
        
        .ticket-header {
            background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%);
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
            margin-bottom: 24px;
            background: #f0fdf4;
            border-radius: 12px;
            border: 2px solid #bbf7d0;
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
            width: 45%;
            padding: 20px 12px;
            text-align: center;
            vertical-align: middle;
            border: none;
        }
        
        .route-arrow-cell {
            width: 10%;
            padding: 10px;
            text-align: center;
            vertical-align: middle;
            border: none;
        }
        
        .location-name {
            font-size: 18px;
            color: #333;
            font-weight: 600;
            line-height: 1.3;
            word-wrap: break-word;
            hyphens: auto;
        }
        
        .route-arrow {
            font-size: 24px;
            color: #22c55e;
            display: block;
        }
        
        /* Pickup Time */
        .pickup-time-section {
            text-align: center;
            margin-bottom: 20px;
            padding: 20px;
            background: #f0fdf4;
            border-radius: 8px;
            border: 2px solid #bbf7d0;
        }
        
        .time-label {
            font-size: 16px;
            color: #16a34a;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 12px;
            font-weight: 700;
        }
        
        .time-value {
            font-size: 32px;
            font-weight: 900;
            color: #16a34a;
            margin-bottom: 8px;
            line-height: 1.1;
        }
        
        .date-value {
            font-size: 20px;
            color: #333;
            font-weight: 600;
        }
        
        /* Details Grid */
        .details-grid {
            margin-bottom: 24px;
            border: 2px solid #bbf7d0;
            border-radius: 8px;
            overflow: hidden;
        }
        
        .details-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            mso-table-lspace: 0pt;
            mso-table-rspace: 0pt;
        }
        
        .detail-cell {
            width: 50%;
            text-align: center;
            padding: 20px 12px;
            vertical-align: middle;
            border: none;
            border-right: 1px solid #bbf7d0;
        }
        
        .detail-cell:last-child {
            border-right: none;
        }
        
        .detail-label {
            font-size: 12px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 8px;
            font-weight: 600;
            display: block;
        }
        
        .detail-value {
            font-size: 20px;
            font-weight: 700;
            color: #16a34a;
            line-height: 1.2;
        }
        
        /* Information Sections */
        .info-section {
            margin-bottom: 20px;
            padding: 16px;
            background: #f0fdf4;
            border-radius: 8px;
            border-left: 4px solid #22c55e;
        }
        
        .info-title {
            font-size: 14px;
            color: #16a34a;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 12px;
            font-weight: 700;
        }
        
        .info-content {
            color: #333;
            font-size: 16px;
            line-height: 1.5;
        }
        
        .contact-item {
            margin-bottom: 4px;
        }
        
        .contact-link {
            color: #16a34a;
            text-decoration: none;
        }
        
        .contact-link:hover {
            text-decoration: underline;
        }
        
        .instruction-list {
            list-style: none;
            padding: 0;
        }
        
        .instruction-item {
            margin-bottom: 6px;
            padding-left: 16px;
            position: relative;
        }
        
        .instruction-item::before {
            content: '•';
            color: #22c55e;
            font-weight: 700;
            position: absolute;
            left: 0;
        }
        
        /* Perforated Line */
        .perforation {
            border-top: 2px dashed #bbf7d0;
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
            border: 2px solid #bbf7d0;
        }
        
        .perforation::before { left: -8px; }
        .perforation::after { right: -8px; }
        
        /* Ticket Stub */
        .ticket-stub {
            text-align: center;
            padding: 16px;
            background: #f0fdf4;
        }
        
        .booking-ref {
            font-size: 14px;
            font-weight: 700;
            color: #16a34a;
            margin-bottom: 4px;
        }
        
        .validity {
            font-size: 11px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        /* Success Message */
        .success-message {
            text-align: center;
            padding: 20px;
            background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
            border-radius: 12px;
            margin: 20px 0;
            border: 2px solid #22c55e;
        }
        
        .success-title {
            font-size: 18px;
            font-weight: 700;
            color: #16a34a;
            margin-bottom: 8px;
        }
        
        .success-text {
            color: #166534;
            font-size: 14px;
            line-height: 1.4;
        }
        
        /* Footer */
        .footer {
            text-align: center;
            margin-top: 24px;
            padding: 20px;
            border-top: 2px solid #bbf7d0;
            color: #666;
            font-size: 14px;
        }
        
        /* Mobile Responsive */
        @media only screen and (max-width: 600px) {
            body {
                padding: 10px;
            }
            
            .route-table {
                table-layout: auto;
            }
            
            .route-cell {
                width: 50%;
                padding: 16px 8px;
            }
            
            .route-arrow-cell {
                width: auto;
                padding: 8px;
            }
            
            .location-name {
                font-size: 16px;
                line-height: 1.2;
            }
            
            .route-arrow {
                font-size: 20px;
            }
            
            .pickup-time-section {
                padding: 16px;
            }
            
            .time-value {
                font-size: 28px;
            }
            
            .date-value {
                font-size: 18px;
            }
            
            .details-table {
                table-layout: auto;
            }
            
            .detail-cell {
                width: 50%;
                padding: 16px 8px;
            }
            
            .detail-value {
                font-size: 18px;
            }
            
            .info-content {
                font-size: 15px;
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
            <h1 style="color: #333;">🚐 AC SHUTTLES</h1>
        </div>
        
        <div class="success-message">
            <div class="success-title">Your ride is confirmed!</div>
            <div class="success-text">Save this ticket and show it to your driver</div>
        </div>
        
        <div class="ticket-card">
            <div class="ticket-header">
                <div class="ticket-title">🎫 AC SHUTTLES TICKET</div>
                <div class="ticket-subtitle">✅ CONFIRMED</div>
            </div>
            
            <div class="ticket-body">
                <!-- Route Display -->
                <div class="route-section">
                    <table class="route-table" width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                            <td class="route-cell" width="45%" align="center" valign="middle">
                                <div class="location-name">${data.startLocation}</div>
                            </td>
                            <td class="route-arrow-cell" width="10%" align="center" valign="middle">
                                <div class="route-arrow">🚐</div>
                            </td>
                            <td class="route-cell" width="45%" align="center" valign="middle">
                                <div class="location-name">${data.endLocation}</div>
                            </td>
                        </tr>
                    </table>
                </div>
                
                <!-- Pickup Time -->
                <div class="pickup-time-section">
                    <div class="time-label">Pickup Time</div>
                    <div class="time-value">${data.pickupTime}</div>
                    <div class="date-value">${data.pickupDate}</div>
                </div>
                
                <!-- Details Grid -->
                <div class="details-grid">
                    <table class="details-table" width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                            <td class="detail-cell" width="50%" align="center" valign="middle">
                                <div class="detail-label">Passengers</div>
                                <div class="detail-value">${data.passengers}</div>
                            </td>
                            <td class="detail-cell" width="50%" align="center" valign="middle">
                                <div class="detail-label">Fare</div>
                                <div class="detail-value">${data.price}</div>
                            </td>
                        </tr>
                    </table>
                </div>
                
                <!-- Driver Details -->
                <div class="info-section">
                    <div class="info-title">👤 Your Driver</div>
                    <div class="info-content">
                        <div class="contact-item"><strong>Name:</strong> ${data.driverName}</div>
                        <div class="contact-item"><strong>Phone:</strong> <a href="tel:${data.driverPhone}" class="contact-link">${data.driverPhone}</a></div>
                        <div class="contact-item"><strong>Email:</strong> <a href="mailto:${data.driverEmail}" class="contact-link">${data.driverEmail}</a></div>
                    </div>
                </div>
                
                <!-- Pickup Instructions -->
                <div class="info-section">
                    <div class="info-title">📍 Pickup Instructions</div>
                    <div class="info-content">
                        <ul class="instruction-list">
                            <li class="instruction-item">Be ready 5-10 minutes before scheduled time</li>
                            <li class="instruction-item">Driver will call you when approaching</li>
                            <li class="instruction-item">Wait at the building entrance</li>
                            <li class="instruction-item">Have this ticket ready to show</li>
                        </ul>
                        <div style="margin-top: 12px;">
                            <strong>Pickup Location:</strong><br>
                            ${data.startLocation}
                        </div>
                    </div>
                </div>
                
                ${data.notes ? `
                <div class="info-section">
                    <div class="info-title">📝 Trip Notes</div>
                    <div class="info-content">${data.notes}</div>
                </div>
                ` : ''}
                
                <!-- Perforated Line -->
                <div class="perforation"></div>
                
                <!-- Ticket Stub -->
                <div class="ticket-stub">
                    <div class="booking-ref">BOOKING REF: ${data.bookingRef}</div>
                    <div class="validity">Ride Confirmed</div>
                </div>
            </div>
        </div>
        
        <!-- Footer -->
        <div class="footer">
            📞 Questions? Call ${data.driverPhone} or reply to this email
        </div>
    </div>
</body>
</html>`;

  const text = `🎫 AC SHUTTLES - BOOKING CONFIRMED

✅ YOUR RIDE IS CONFIRMED!
Save this ticket and show it to your driver.

TICKET DETAILS:
===============
From: ${data.startLocation}
To: ${data.endLocation}
Pickup Time: ${data.pickupTime} on ${data.pickupDate}
Passengers: ${data.passengers}
Fare: ${data.price}
Duration: ${data.estimatedDuration}

YOUR DRIVER:
============
Name: ${data.driverName}
Phone: ${data.driverPhone}
Email: ${data.driverEmail}

PICKUP INSTRUCTIONS:
====================
• Be ready 5-10 minutes before scheduled time
• Driver will call you when approaching
• Wait at the building entrance
• Have this ticket ready to show

PICKUP LOCATION:
================
${data.startLocation}

${data.notes ? `TRIP NOTES:
============
${data.notes}

` : ''}BOOKING REF: ${data.bookingRef}

Questions? Call ${data.driverPhone} or reply to this email.`;

  return { html, text };
}