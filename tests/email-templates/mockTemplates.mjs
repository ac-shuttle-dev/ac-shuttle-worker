/**
 * Mock Email Templates for Testing
 */

// Use dynamic import for the email templates
const emailTemplates = await import('../../src/templates/emails/index.ts');

export const {
  generateOwnerNotificationEmail,
  generateCustomerConfirmationEmail,
  generateCustomerDenialEmail,
  generateCustomerSubmissionAckEmail
} = emailTemplates;
