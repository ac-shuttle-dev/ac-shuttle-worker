/**
 * Owner Delivery Notification Email Template
 * 
 * This template generates the email that owners receive when a customer
 * has successfully received their booking accept/denial notification.
 * Used for delivery confirmation tracking via Resend webhooks.
 */

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
  const statusColor = data.notificationType === 'accepted' ? '#16a34a' : '#dc2626';
  const statusText = data.notificationType === 'accepted' ? 'ACCEPTED' : 'DENIED';
  const statusIcon = data.notificationType === 'accepted' ? '✅' : '❌';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Customer Notified - AC Shuttles</title>
    <style>
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background-color: #f8fafc;
            padding: 20px;
            line-height: 1.4;
        }
        
        .email-container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #f8fafc;
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
        
        .status-card {
            background: white;
            border-radius: 16px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            margin: 20px 0;
            overflow: hidden;
            border: 3px solid #e2e8f0;
        }
        
        .status-header {
            background: linear-gradient(135deg, #64748b 0%, #94a3b8 100%);
            color: white;
            padding: 20px;
            text-align: center;
        }
        
        .status-title {
            font-size: 18px;
            font-weight: 700;
            margin-bottom: 4px;
        }
        
        .status-subtitle {
            font-size: 14px;
            opacity: 0.9;
        }
        
        .status-body {
            padding: 24px;
        }
        
        .delivery-notice {
            text-align: center;
            padding: 20px;
            background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
            border-radius: 12px;
            margin-bottom: 24px;
            border: 2px solid #cbd5e1;
        }
        
        .delivery-title {
            font-size: 20px;
            font-weight: 700;
            color: #334155;
            margin-bottom: 8px;
        }
        
        .delivery-text {
            color: #64748b;
            font-size: 16px;
            line-height: 1.4;
        }
        
        .status-indicator {
            display: inline-flex;
            align-items: center;
            padding: 12px 20px;
            background: ${statusColor};
            color: white;
            border-radius: 8px;
            font-weight: 700;
            font-size: 16px;
            margin: 16px 0;
        }
        
        .status-icon {
            margin-right: 8px;
            font-size: 18px;
        }
        
        .customer-section {
            margin-bottom: 24px;
            padding: 16px;
            background: #f8fafc;
            border-radius: 8px;
            border-left: 4px solid #64748b;
        }
        
        .section-title {
            font-size: 14px;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 8px;
            font-weight: 700;
        }
        
        .section-content {
            color: #333;
            font-size: 16px;
            line-height: 1.4;
        }
        
        .trip-details {
            margin-bottom: 20px;
            padding: 16px;
            background: #f8fafc;
            border-radius: 8px;
            border-left: 4px solid #64748b;
        }
        
        .route-info {
            margin-bottom: 12px;
        }
        
        .location {
            font-weight: 600;
            color: #334155;
            margin-bottom: 4px;
        }
        
        .pickup-info {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 12px;
            padding: 12px;
            background: white;
            border-radius: 6px;
            border: 1px solid #e2e8f0;
        }
        
        .pickup-time {
            font-weight: 700;
            color: #334155;
            font-size: 16px;
        }
        
        .delivery-details {
            margin-bottom: 20px;
            padding: 16px;
            background: #f0f9ff;
            border-radius: 8px;
            border-left: 4px solid #0ea5e9;
        }
        
        .detail-item {
            margin-bottom: 8px;
            font-size: 14px;
        }
        
        .detail-label {
            font-weight: 600;
            color: #334155;
        }
        
        .detail-value {
            color: #64748b;
        }
        
        .footer {
            text-align: center;
            margin-top: 24px;
            padding: 20px;
            border-top: 2px solid #e2e8f0;
            color: #64748b;
            font-size: 14px;
        }
        
        @media only screen and (max-width: 600px) {
            body {
                padding: 10px;
            }
            
            .status-body {
                padding: 16px;
            }
            
            .pickup-info {
                flex-direction: column;
                align-items: flex-start;
            }
            
            .pickup-time {
                margin-top: 8px;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <h1>🚐 AC SHUTTLES</h1>
        </div>
        
        <div class="status-card">
            <div class="status-header">
                <div class="status-title">📧 DELIVERY CONFIRMATION</div>
                <div class="status-subtitle">Customer Notification Delivered</div>
            </div>
            
            <div class="status-body">
                <div class="delivery-notice">
                    <div class="delivery-title">Customer Has Been Notified</div>
                    <div class="delivery-text">The customer has successfully received their booking ${data.notificationType} notification</div>
                    <div class="status-indicator">
                        <span class="status-icon">${statusIcon}</span>
                        Booking ${statusText}
                    </div>
                </div>
                
                <div class="customer-section">
                    <div class="section-title">👤 Customer Details</div>
                    <div class="section-content">
                        <div><strong>Name:</strong> ${data.customerName}</div>
                        <div><strong>Email:</strong> ${data.customerEmail}</div>
                    </div>
                </div>
                
                <div class="trip-details">
                    <div class="section-title">🗺️ Trip Information</div>
                    <div class="route-info">
                        <div class="location"><strong>From:</strong> ${data.startLocation}</div>
                        <div class="location"><strong>To:</strong> ${data.endLocation}</div>
                    </div>
                    <div class="pickup-info">
                        <div>
                            <div style="font-size: 12px; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">Pickup Time</div>
                            <div class="pickup-time">${data.pickupTime}</div>
                        </div>
                        <div>
                            <div style="font-size: 12px; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">Date</div>
                            <div class="pickup-time">${data.pickupDate}</div>
                        </div>
                    </div>
                </div>
                
                <div class="delivery-details">
                    <div class="section-title">📬 Delivery Information</div>
                    <div class="detail-item">
                        <span class="detail-label">Delivered At:</span> 
                        <span class="detail-value">${data.deliveredAt}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Booking Reference:</span> 
                        <span class="detail-value">${data.bookingRef}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Transaction ID:</span> 
                        <span class="detail-value">${data.transactionId}</span>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="footer">
            This is an automated delivery confirmation from AC Shuttles.<br>
            The customer notification process is now complete.
        </div>
    </div>
</body>
</html>`;

  const text = `📧 AC SHUTTLES - DELIVERY CONFIRMATION

${statusIcon} CUSTOMER NOTIFICATION DELIVERED

The customer has successfully received their booking ${data.notificationType.toUpperCase()} notification.

CUSTOMER DETAILS:
================
Name: ${data.customerName}
Email: ${data.customerEmail}

TRIP INFORMATION:
================
From: ${data.startLocation}
To: ${data.endLocation}
Pickup: ${data.pickupTime} on ${data.pickupDate}

DELIVERY DETAILS:
================
Status: Booking ${statusText}
Delivered At: ${data.deliveredAt}
Booking Reference: ${data.bookingRef}
Transaction ID: ${data.transactionId}

This is an automated delivery confirmation from AC Shuttles.
The customer notification process is now complete.`;

  return { html, text };
}