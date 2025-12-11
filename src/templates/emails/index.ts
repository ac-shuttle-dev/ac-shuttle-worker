/**
 * Email Templates Index
 * 
 * Centralized exports for all email templates used in the AC Shuttles booking system.
 * All templates follow a consistent ticket card design with professional styling.
 */

export { generateOwnerNotificationEmail, type OwnerNotificationData } from './ownerNotification';
export { generateCustomerConfirmationEmail, type CustomerConfirmationData } from './customerConfirmation';
export { generateCustomerDenialEmail, type CustomerDenialData } from './customerDenial';
export { generateOwnerDeliveryNotificationEmail, type OwnerDeliveryNotificationData } from './ownerDeliveryNotification';
export { generateCustomerSubmissionAckEmail, type CustomerSubmissionAckData } from './customerSubmissionAck';
export { generateCustomerReminderEmail, type CustomerReminderData } from './customerReminder';

// Re-export utility functions
export {
  parseAddress,
  generateLocationCode,
  formatPickupDateTime,
  formatTicketDate,
  formatTicketTime,
  calculateArrivalTime,
  parseDurationMinutes,
  formatHumanReadableTimestamp
} from './utils';