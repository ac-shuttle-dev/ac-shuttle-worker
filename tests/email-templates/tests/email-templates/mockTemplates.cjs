/**
 * Mock Email Templates for Testing
 * 
 * These are JavaScript implementations of the TypeScript email templates
 * that can be used for generating HTML previews.
 */

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function generateOwnerNotificationEmail(data) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Ride Request - AC Shuttles</title>
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
            align-items: center;
            justify-content: space-between;
            margin-bottom: 24px;
            padding: 20px;
            background: #f8fdf8;
            border-radius: 12px;
            border: 2px dashed #d0e7d0;
        }
        
        .location-box {
            text-align: center;
            flex: 1;
        }
        
        .location-code {
            font-size: 24px;
            font-weight: 900;
            color: #2d5a3d;
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
            color: #4a8a5a;
        }
        
        /* Times */
        .times-section {
            display: flex;
            justify-content: space-between;
            margin-bottom: 20px;
            padding: 16px;
            background: #f8fdf8;
            border-radius: 8px;
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
            color: #2d5a3d;
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
            border: 1px solid #e8f5e8;
            border-radius: 8px;
            overflow: hidden;
        }
        
        .detail-box {
            flex: 1;
            text-align: center;
            padding: 16px 8px;
            border-right: 1px solid #e8f5e8;
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
            font-size: 12px;
            color: #2d5a3d;
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
                border-bottom: 1px solid #e8f5e8;
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
                    <div class="location-box">
                        <div class="location-code">${data.startLocationCode}</div>
                        <div class="location-name">${data.startLocation}</div>
                    </div>
                    <div class="route-arrow">🚐</div>
                    <div class="location-box">
                        <div class="location-code">${data.endLocationCode}</div>
                        <div class="location-name">${data.endLocation}</div>
                    </div>
                </div>
                
                <!-- Times -->
                <div class="times-section">
                    <div class="time-column">
                        <div class="time-label">Departure</div>
                        <div class="time-value">${data.pickupTime}</div>
                        <div class="date-value">${data.pickupDate}</div>
                    </div>
                    <div class="time-column">
                        <div class="time-label">Arrival</div>
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
                        <div class="detail-label">Fare</div>
                        <div class="detail-value">${data.price}</div>
                    </div>
                    <div class="detail-box">
                        <div class="detail-label">Duration</div>
                        <div class="detail-value">${data.estimatedDuration}</div>
                    </div>
                </div>
                
                <!-- Passenger Details -->
                <div class="info-section">
                    <div class="info-title">👤 Passenger Details</div>
                    <div class="info-content">
                        <div class="contact-item"><strong>Name:</strong> ${escapeHtml(data.customerName)}</div>
                        <div class="contact-item"><strong>Email:</strong> <a href="mailto:${escapeHtml(data.customerEmail)}" class="contact-link">${escapeHtml(data.customerEmail)}</a></div>
                        <div class="contact-item"><strong>Phone:</strong> ${data.customerPhone ? `<a href="tel:${escapeHtml(data.customerPhone)}" class="contact-link">${escapeHtml(data.customerPhone)}</a>` : 'Not provided'}</div>
                    </div>
                </div>
                
                <!-- Pickup Address -->
                <div class="info-section">
                    <div class="info-title">📍 Pickup Address</div>
                    <div class="info-content">
                        <div class="address-line">${escapeHtml(data.pickupAddress.street)}</div>
                        ${data.pickupAddress.suite ? `<div class="address-line">${escapeHtml(data.pickupAddress.suite)}</div>` : ''}
                        <div class="address-line">${escapeHtml(data.pickupAddress.city)}, ${escapeHtml(data.pickupAddress.state)} ${escapeHtml(data.pickupAddress.zipCode)}</div>
                    </div>
                </div>
                
                <!-- Dropoff Address -->
                <div class="info-section">
                    <div class="info-title">📍 Dropoff Address</div>
                    <div class="info-content">
                        <div class="address-line">${escapeHtml(data.dropoffAddress.street)}</div>
                        ${data.dropoffAddress.suite ? `<div class="address-line">${escapeHtml(data.dropoffAddress.suite)}</div>` : ''}
                        <div class="address-line">${escapeHtml(data.dropoffAddress.city)}, ${escapeHtml(data.dropoffAddress.state)} ${escapeHtml(data.dropoffAddress.zipCode)}</div>
                    </div>
                </div>
                
                ${data.notes ? `
                <div class="info-section">
                    <div class="info-title">📝 Special Instructions</div>
                    <div class="info-content">${escapeHtml(data.notes)}</div>
                </div>
                ` : ''}
                
                <!-- Perforated Line -->
                <div class="perforation"></div>
                
                <!-- Ticket Stub -->
                <div class="ticket-stub">
                    <div class="booking-ref">BOOKING REF: ${escapeHtml(data.bookingRef)}</div>
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

  return { html, text: 'Text version placeholder' };
}

function generateCustomerConfirmationEmail(data) {
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
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 24px;
            padding: 20px;
            background: #f0fdf4;
            border-radius: 12px;
            border: 2px solid #bbf7d0;
        }
        
        .location-box {
            text-align: center;
            flex: 1;
        }
        
        .location-code {
            font-size: 24px;
            font-weight: 900;
            color: #16a34a;
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
            color: #22c55e;
        }
        
        /* Times */
        .times-section {
            display: flex;
            justify-content: space-between;
            margin-bottom: 20px;
            padding: 16px;
            background: #f0fdf4;
            border-radius: 8px;
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
            color: #16a34a;
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
            border: 1px solid #bbf7d0;
            border-radius: 8px;
            overflow: hidden;
        }
        
        .detail-box {
            flex: 1;
            text-align: center;
            padding: 16px 8px;
            border-right: 1px solid #bbf7d0;
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
            color: #16a34a;
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
            font-size: 12px;
            color: #16a34a;
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
                border-bottom: 1px solid #bbf7d0;
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
            <p>✅ Booking Confirmed</p>
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
                    <div class="location-box">
                        <div class="location-code">${data.startLocationCode}</div>
                        <div class="location-name">${data.startLocation}</div>
                    </div>
                    <div class="route-arrow">🚐</div>
                    <div class="location-box">
                        <div class="location-code">${data.endLocationCode}</div>
                        <div class="location-name">${data.endLocation}</div>
                    </div>
                </div>
                
                <!-- Times -->
                <div class="times-section">
                    <div class="time-column">
                        <div class="time-label">Departure</div>
                        <div class="time-value">${data.pickupTime}</div>
                        <div class="date-value">${data.pickupDate}</div>
                    </div>
                    <div class="time-column">
                        <div class="time-label">Arrival</div>
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
                        <div class="detail-label">Fare</div>
                        <div class="detail-value">${data.price}</div>
                    </div>
                    <div class="detail-box">
                        <div class="detail-label">Duration</div>
                        <div class="detail-value">${data.estimatedDuration}</div>
                    </div>
                </div>
                
                <!-- Driver Details -->
                <div class="info-section">
                    <div class="info-title">👤 Your Driver</div>
                    <div class="info-content">
                        <div class="contact-item"><strong>Name:</strong> ${escapeHtml(data.driverName)}</div>
                        <div class="contact-item"><strong>Phone:</strong> <a href="tel:${escapeHtml(data.driverPhone)}" class="contact-link">${escapeHtml(data.driverPhone)}</a></div>
                        <div class="contact-item"><strong>Email:</strong> <a href="mailto:${escapeHtml(data.driverEmail)}" class="contact-link">${escapeHtml(data.driverEmail)}</a></div>
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
                            ${escapeHtml(data.pickupAddress.street)}<br>
                            ${data.pickupAddress.suite ? escapeHtml(data.pickupAddress.suite) + '<br>' : ''}
                            ${escapeHtml(data.pickupAddress.city)}, ${escapeHtml(data.pickupAddress.state)} ${escapeHtml(data.pickupAddress.zipCode)}
                        </div>
                    </div>
                </div>
                
                ${data.notes ? `
                <div class="info-section">
                    <div class="info-title">📝 Trip Notes</div>
                    <div class="info-content">${escapeHtml(data.notes)}</div>
                </div>
                ` : ''}
                
                <!-- Perforated Line -->
                <div class="perforation"></div>
                
                <!-- Ticket Stub -->
                <div class="ticket-stub">
                    <div class="booking-ref">BOOKING REF: ${escapeHtml(data.bookingRef)}</div>
                    <div class="validity">Ride Confirmed</div>
                </div>
            </div>
        </div>
        
        <!-- Footer -->
        <div class="footer">
            📞 Questions? Call ${escapeHtml(data.driverPhone)} or reply to this email
        </div>
    </div>
</body>
</html>`;

  return { html, text: 'Text version placeholder' };
}

function generateCustomerDenialEmail(data) {
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
                        We regret that we cannot accommodate your ride request due to ${data.reason || 'schedule conflict or route limitations'}. We appreciate your understanding.
                    </div>
                </div>
                
                <!-- Alternative Options -->
                <div class="info-section">
                    <div class="info-title">🔄 Alternative Options</div>
                    <div class="info-content">
                        <div class="alternative-item">
                            <span class="alternative-icon">📞</span>
                            <strong>Call us:</strong> <a href="tel:${escapeHtml(data.contactPhone)}" class="contact-link">${escapeHtml(data.contactPhone)}</a>
                        </div>
                        <div class="alternative-item">
                            <span class="alternative-icon">📧</span>
                            <strong>Email us:</strong> <a href="mailto:${escapeHtml(data.contactEmail)}" class="contact-link">${escapeHtml(data.contactEmail)}</a>
                        </div>
                        ${data.websiteUrl ? `
                        <div class="alternative-item">
                            <span class="alternative-icon">🌐</span>
                            <strong>Website:</strong> <a href="${escapeHtml(data.websiteUrl)}" class="contact-link">${escapeHtml(data.websiteUrl)}</a>
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
                            ${escapeHtml(data.pickupAddress.street)}<br>
                            ${data.pickupAddress.suite ? escapeHtml(data.pickupAddress.suite) + '<br>' : ''}
                            ${escapeHtml(data.pickupAddress.city)}, ${escapeHtml(data.pickupAddress.state)} ${escapeHtml(data.pickupAddress.zipCode)}
                        </div>
                        <div>
                            <strong>Dropoff:</strong><br>
                            ${escapeHtml(data.dropoffAddress.street)}<br>
                            ${data.dropoffAddress.suite ? escapeHtml(data.dropoffAddress.suite) + '<br>' : ''}
                            ${escapeHtml(data.dropoffAddress.city)}, ${escapeHtml(data.dropoffAddress.state)} ${escapeHtml(data.dropoffAddress.zipCode)}
                        </div>
                    </div>
                </div>
                
                <!-- Perforated Line -->
                <div class="perforation"></div>
                
                <!-- Ticket Stub -->
                <div class="ticket-stub">
                    <div class="booking-ref">BOOKING REF: ${escapeHtml(data.bookingRef)}</div>
                    <div class="validity">Ride Cancelled</div>
                </div>
            </div>
        </div>
        
        <!-- Footer -->
        <div class="footer">
            We appreciate your understanding and hope to serve you in the future.<br>
            📞 Need help? Call ${escapeHtml(data.contactPhone)}
        </div>
    </div>
</body>
</html>`;

  return { html, text: 'Text version placeholder' };
}

module.exports = {
  generateOwnerNotificationEmail,
  generateCustomerConfirmationEmail,
  generateCustomerDenialEmail
};