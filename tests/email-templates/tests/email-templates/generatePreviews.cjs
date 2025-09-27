/**
 * Email Template Preview Generator
 * 
 * This script generates HTML preview files for all email templates
 * so you can open them in a browser to see how they look.
 * 
 * Usage: node test/email-templates/generatePreviews.js
 */

const fs = require('fs');
const path = require('path');

// Import the email template functions
// Note: We'll use dynamic imports to handle TypeScript modules
async function loadTemplates() {
  try {
    // For now, we'll create mock implementations since we can't directly import TS modules
    return {
      generateOwnerNotificationEmail: require('./mockTemplates.cjs').generateOwnerNotificationEmail,
      generateCustomerConfirmationEmail: require('./mockTemplates.cjs').generateCustomerConfirmationEmail,
      generateCustomerDenialEmail: require('./mockTemplates.cjs').generateCustomerDenialEmail,
    };
  } catch (error) {
    console.error('Error loading templates:', error);
    console.log('Using mock data instead...');
    return require('./mockTemplates.cjs');
  }
}

// Sample data for testing
const sampleOwnerData = {
  startLocation: "Downtown Financial District",
  endLocation: "Los Angeles International Airport Terminal 1",
  startLocationCode: "DTWN",
  endLocationCode: "LAX",
  pickupTime: "3:30 PM",
  arrivalTime: "4:30 PM", 
  pickupDate: "DEC 15, MON",
  arrivalDate: "DEC 15, MON",
  price: "$45.00",
  passengers: "2",
  estimatedDuration: "25 minutes",
  estimatedDistance: "12.3 miles",
  customerName: "John Smith",
  customerEmail: "john.smith@email.com",
  customerPhone: "(555) 123-4567",
  pickupAddress: {
    street: "1247 Washington Boulevard",
    suite: "Suite 400",
    city: "Los Angeles",
    state: "CA",
    zipCode: "90015"
  },
  dropoffAddress: {
    street: "1 World Way, Terminal 1",
    suite: "Departure Level",
    city: "Los Angeles", 
    state: "CA",
    zipCode: "90045"
  },
  vehicleType: "Standard Sedan",
  notes: "Need help with two large suitcases and a car seat for 3-year-old. Will tip well for assistance.",
  bookingRef: "AC250359445",
  acceptUrl: "https://ac-shuttle-dev-worker.goldenkey-realestate-residential.workers.dev/accept/abc123def456",
  denyUrl: "https://ac-shuttle-dev-worker.goldenkey-realestate-residential.workers.dev/deny/xyz789ghi012"
};

const sampleConfirmationData = {
  startLocation: "Downtown Financial District",
  endLocation: "Los Angeles International Airport Terminal 1", 
  startLocationCode: "DTWN",
  endLocationCode: "LAX",
  pickupTime: "3:30 PM",
  arrivalTime: "4:30 PM",
  pickupDate: "DEC 15, MON", 
  arrivalDate: "DEC 15, MON",
  price: "$45.00",
  passengers: "2",
  estimatedDuration: "25 minutes",
  customerName: "John Smith",
  customerEmail: "john.smith@email.com",
  driverName: "Mike Johnson",
  driverPhone: "(555) 987-6543",
  driverEmail: "mike@acshuttles.com",
  pickupAddress: {
    street: "1247 Washington Boulevard",
    suite: "Suite 400", 
    city: "Los Angeles",
    state: "CA",
    zipCode: "90015"
  },
  dropoffAddress: {
    street: "1 World Way, Terminal 1",
    suite: "Departure Level",
    city: "Los Angeles",
    state: "CA", 
    zipCode: "90045"
  },
  notes: "Car seat and luggage assistance needed",
  bookingRef: "AC250359445"
};

const sampleDenialData = {
  startLocation: "Downtown Financial District",
  endLocation: "Los Angeles International Airport Terminal 1",
  startLocationCode: "DTWN", 
  endLocationCode: "LAX",
  pickupTime: "3:30 PM",
  arrivalTime: "4:30 PM",
  pickupDate: "DEC 15, MON",
  arrivalDate: "DEC 15, MON", 
  passengers: "2",
  estimatedDuration: "25 minutes",
  customerName: "John Smith",
  customerEmail: "john.smith@email.com",
  contactPhone: "(555) 987-6543",
  contactEmail: "bookings@acshuttles.com",
  websiteUrl: "https://acshuttles.com",
  pickupAddress: {
    street: "1247 Washington Boulevard",
    suite: "Suite 400",
    city: "Los Angeles", 
    state: "CA",
    zipCode: "90015"
  },
  dropoffAddress: {
    street: "1 World Way, Terminal 1", 
    suite: "Departure Level",
    city: "Los Angeles",
    state: "CA",
    zipCode: "90045"
  },
  reason: "Schedule conflict or route limitations",
  bookingRef: "AC250359445"
};

async function generatePreviewFiles() {
  console.log('🎫 Generating email template previews...');
  
  const templates = await loadTemplates();
  const outputDir = path.join(__dirname, 'previews');
  
  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  try {
    // Generate owner notification preview
    console.log('📧 Generating owner notification preview...');
    const ownerEmail = templates.generateOwnerNotificationEmail(sampleOwnerData);
    const ownerPreviewHtml = createPreviewWrapper(
      'Owner Notification Email',
      'This is the email that business owners receive when a new booking request comes in.',
      ownerEmail.html
    );
    fs.writeFileSync(path.join(outputDir, 'owner-notification.html'), ownerPreviewHtml);
    
    // Generate customer confirmation preview  
    console.log('✅ Generating customer confirmation preview...');
    const confirmationEmail = templates.generateCustomerConfirmationEmail(sampleConfirmationData);
    const confirmationPreviewHtml = createPreviewWrapper(
      'Customer Confirmation Email',
      'This is the email that customers receive when their booking is accepted.',
      confirmationEmail.html
    );
    fs.writeFileSync(path.join(outputDir, 'customer-confirmation.html'), confirmationPreviewHtml);
    
    // Generate customer denial preview
    console.log('❌ Generating customer denial preview...');
    const denialEmail = templates.generateCustomerDenialEmail(sampleDenialData);
    const denialPreviewHtml = createPreviewWrapper(
      'Customer Denial Email', 
      'This is the email that customers receive when their booking is declined.',
      denialEmail.html
    );
    fs.writeFileSync(path.join(outputDir, 'customer-denial.html'), denialPreviewHtml);
    
    // Generate index page with all previews
    console.log('📑 Generating index page...');
    const indexHtml = createIndexPage();
    fs.writeFileSync(path.join(outputDir, 'index.html'), indexHtml);
    
    console.log('✨ Preview files generated successfully!');
    console.log(`📂 Open: ${path.join(outputDir, 'index.html')}`);
    console.log('');
    console.log('Individual preview files:');
    console.log(`   📧 Owner Notification: ${path.join(outputDir, 'owner-notification.html')}`);
    console.log(`   ✅ Customer Confirmation: ${path.join(outputDir, 'customer-confirmation.html')}`);
    console.log(`   ❌ Customer Denial: ${path.join(outputDir, 'customer-denial.html')}`);
    
  } catch (error) {
    console.error('❌ Error generating previews:', error);
  }
}

function createPreviewWrapper(title, description, emailHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - AC Shuttles Email Preview</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: #f5f5f5;
            margin: 0;
            padding: 20px;
        }
        .preview-header {
            max-width: 800px;
            margin: 0 auto 30px auto;
            text-align: center;
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .preview-container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .email-frame {
            width: 100%;
            min-height: 800px;
            border: none;
        }
        .back-link {
            display: inline-block;
            margin-bottom: 15px;
            color: #007bff;
            text-decoration: none;
        }
        .back-link:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="preview-header">
        <a href="index.html" class="back-link">← Back to All Previews</a>
        <h1>${title}</h1>
        <p style="color: #666; margin: 10px 0 0 0;">${description}</p>
    </div>
    
    <div class="preview-container">
        <iframe class="email-frame" srcdoc="${emailHtml.replace(/"/g, '&quot;')}"></iframe>
    </div>
</body>
</html>`;
}

function createIndexPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AC Shuttles Email Templates Preview</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: #f5f5f5;
            margin: 0;
            padding: 40px 20px;
            line-height: 1.6;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
        }
        .header {
            text-align: center;
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            margin-bottom: 30px;
        }
        .templates-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-top: 30px;
        }
        .template-card {
            background: white;
            border-radius: 12px;
            padding: 30px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            text-align: center;
            transition: transform 0.2s ease;
        }
        .template-card:hover {
            transform: translateY(-2px);
        }
        .template-icon {
            font-size: 48px;
            margin-bottom: 20px;
        }
        .template-link {
            display: inline-block;
            background: #007bff;
            color: white;
            padding: 12px 24px;
            border-radius: 6px;
            text-decoration: none;
            margin-top: 15px;
            transition: background 0.2s ease;
        }
        .template-link:hover {
            background: #0056b3;
        }
        .owner-card { border-top: 4px solid #2d5a3d; }
        .confirmation-card { border-top: 4px solid #16a34a; }
        .denial-card { border-top: 4px solid #dc2626; }
        .info-box {
            background: #e3f2fd;
            border: 1px solid #90caf9;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎫 AC Shuttles Email Templates</h1>
            <p>Professional ticket-style email templates for the booking system</p>
            
            <div class="info-box">
                <strong>📱 Mobile-Responsive Design</strong><br>
                All templates are optimized for desktop, mobile, and email clients including Gmail, Outlook, and Apple Mail.
                <br><br>
                <strong>🎨 Airline-Inspired Styling</strong><br>
                Features realistic ticket card design with perforated edges, location codes, and professional branding.
            </div>
        </div>
        
        <div class="templates-grid">
            <div class="template-card owner-card">
                <div class="template-icon">📧</div>
                <h3>Owner Notification</h3>
                <p>The email that business owners receive when a new booking request comes in. Features prominent accept/deny buttons and complete trip details.</p>
                <a href="owner-notification.html" class="template-link">View Preview</a>
            </div>
            
            <div class="template-card confirmation-card">
                <div class="template-icon">✅</div>
                <h3>Customer Confirmation</h3>
                <p>The confirmation email sent to customers when their booking is accepted. Includes driver contact details and pickup instructions.</p>
                <a href="customer-confirmation.html" class="template-link">View Preview</a>
            </div>
            
            <div class="template-card denial-card">
                <div class="template-icon">❌</div>
                <h3>Customer Denial</h3>
                <p>The email sent to customers when their booking cannot be accommodated. Provides alternative options and contact information.</p>
                <a href="customer-denial.html" class="template-link">View Preview</a>
            </div>
        </div>
        
        <div style="text-align: center; margin-top: 40px; color: #666;">
            <p>Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
        </div>
    </div>
</body>
</html>`;
}

// Run the generator
generatePreviewFiles().catch(console.error);