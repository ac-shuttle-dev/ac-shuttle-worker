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

// Re-export utility functions
export {
  parseAddress,
  generateLocationCode,
  formatTicketDate,
  formatTicketTime,
  calculateArrivalTime,
  parseDurationMinutes
} from './utils';