/**
 * Email Preview Generator
 *
 * Generates HTML preview files for all email templates.
 * Run with: npx tsx scripts/generate-email-previews.ts
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { generateCustomerSubmissionAckEmail } from '../src/templates/emails/customerSubmissionAck';
import { generateCustomerConfirmationEmail } from '../src/templates/emails/customerConfirmation';
import { generateCustomerDenialEmail } from '../src/templates/emails/customerDenial';
import { generateCustomerReminderEmail } from '../src/templates/emails/customerReminder';
import { generateOwnerNotificationEmail } from '../src/templates/emails/ownerNotification';
import { generateOwnerDeliveryNotificationEmail } from '../src/templates/emails/ownerDeliveryNotification';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OUTPUT_DIR = join(__dirname, '../email-previews');

// Ensure output directory exists
mkdirSync(OUTPUT_DIR, { recursive: true });

// Sample data for previews
const sampleData = {
  customerName: 'John Smith',
  customerEmail: 'john.smith@example.com',
  customerPhone: '(609) 555-1234',
  startLocation: '123 Main Street, Philadelphia, PA 19103',
  endLocation: 'Newark Liberty International Airport, Newark, NJ',
  pickupDate: 'Thursday, February 20, 2025',
  pickupTime: '2:30 PM',
  passengers: '3',
  notes: 'Please call upon arrival. I have 2 large suitcases.',
  bookingRef: 'ABC123XYZ',
  contactPhone: '(609) 555-0100',
  contactEmail: 'info@acshuttles.com',
  driverName: 'Mike Johnson',
  driverPhone: '(609) 555-0199',
  driverEmail: 'driver@acshuttles.com',
  estimatedDuration: '45 minutes',
  estimatedDistance: '32 miles',
  mapUrl: 'https://www.google.com/maps/dir/?api=1&origin=123+Main+Street,+Philadelphia,+PA&destination=Newark+Liberty+International+Airport,+Newark,+NJ&travelmode=driving',
};

// Generate all previews
console.log('Generating email previews...\n');

// 1. Customer Submission Acknowledgment
const submissionAck = generateCustomerSubmissionAckEmail({
  customerName: sampleData.customerName,
  customerEmail: sampleData.customerEmail,
  startLocation: sampleData.startLocation,
  endLocation: sampleData.endLocation,
  pickupTime: sampleData.pickupTime,
  pickupDate: sampleData.pickupDate,
  passengers: sampleData.passengers,
  bookingRef: sampleData.bookingRef,
  contactPhone: sampleData.contactPhone,
  contactEmail: sampleData.contactEmail,
});
writeFileSync(join(OUTPUT_DIR, '1-customer-submission-ack.html'), submissionAck.html);
console.log('  ✓ 1. Customer Submission Acknowledgment');

// 2. Customer Confirmation
const confirmation = generateCustomerConfirmationEmail({
  customerName: sampleData.customerName,
  customerEmail: sampleData.customerEmail,
  startLocation: sampleData.startLocation,
  endLocation: sampleData.endLocation,
  pickupTime: sampleData.pickupTime,
  pickupDate: sampleData.pickupDate,
  passengers: sampleData.passengers,
  estimatedDuration: sampleData.estimatedDuration,
  mapUrl: sampleData.mapUrl,
  bookingRef: sampleData.bookingRef,
  driverName: sampleData.driverName,
  driverPhone: sampleData.driverPhone,
  driverEmail: sampleData.driverEmail,
});
writeFileSync(join(OUTPUT_DIR, '2-customer-confirmation.html'), confirmation.html);
console.log('  ✓ 2. Customer Confirmation');

// 3. Customer Denial
const denial = generateCustomerDenialEmail({
  customerName: sampleData.customerName,
  customerEmail: sampleData.customerEmail,
  startLocation: sampleData.startLocation,
  endLocation: sampleData.endLocation,
  pickupTime: sampleData.pickupTime,
  pickupDate: sampleData.pickupDate,
  passengers: sampleData.passengers,
  bookingRef: sampleData.bookingRef,
  contactPhone: sampleData.contactPhone,
  contactEmail: sampleData.contactEmail,
});
writeFileSync(join(OUTPUT_DIR, '3-customer-denial.html'), denial.html);
console.log('  ✓ 3. Customer Denial');

// 4. Customer Reminder
const reminder = generateCustomerReminderEmail({
  customerName: sampleData.customerName,
  customerEmail: sampleData.customerEmail,
  startLocation: sampleData.startLocation,
  endLocation: sampleData.endLocation,
  pickupTime: sampleData.pickupTime,
  pickupDate: sampleData.pickupDate,
  passengers: sampleData.passengers,
  bookingRef: sampleData.bookingRef,
  driverName: sampleData.driverName,
  driverPhone: sampleData.driverPhone,
  driverEmail: sampleData.driverEmail,
});
writeFileSync(join(OUTPUT_DIR, '4-customer-reminder.html'), reminder.html);
console.log('  ✓ 4. Customer Reminder');

// 5. Owner Notification
const ownerNotification = generateOwnerNotificationEmail({
  customerName: sampleData.customerName,
  customerEmail: sampleData.customerEmail,
  customerPhone: sampleData.customerPhone,
  startLocation: sampleData.startLocation,
  endLocation: sampleData.endLocation,
  pickupTime: sampleData.pickupTime,
  pickupDate: sampleData.pickupDate,
  passengers: sampleData.passengers,
  estimatedDuration: sampleData.estimatedDuration,
  estimatedDistance: sampleData.estimatedDistance,
  mapUrl: sampleData.mapUrl,
  notes: sampleData.notes,
  bookingRef: sampleData.bookingRef,
  acceptUrl: 'https://ac-shuttle-worker.example.com/owner/confirm?token=abc123xyz',
  denyUrl: 'https://ac-shuttle-worker.example.com/owner/deny?token=abc123xyz',
});
writeFileSync(join(OUTPUT_DIR, '5-owner-notification.html'), ownerNotification.html);
console.log('  ✓ 5. Owner Notification');

// 6. Owner Delivery Notification
const deliveryNotification = generateOwnerDeliveryNotificationEmail({
  customerName: sampleData.customerName,
  customerEmail: sampleData.customerEmail,
  startLocation: sampleData.startLocation,
  endLocation: sampleData.endLocation,
  pickupTime: sampleData.pickupTime,
  pickupDate: sampleData.pickupDate,
  bookingRef: sampleData.bookingRef,
  notificationType: 'accepted',
  deliveredAt: new Date().toISOString(),
  transactionId: 'TXN-ABC123XYZ',
});
writeFileSync(join(OUTPUT_DIR, '6-owner-delivery-notification.html'), deliveryNotification.html);
console.log('  ✓ 6. Owner Delivery Notification');

console.log('\n✓ All previews generated in:', OUTPUT_DIR);
console.log('\nOpen any HTML file in a browser to view the preview.');
