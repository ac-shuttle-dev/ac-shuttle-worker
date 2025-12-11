/**
 * Email Template Utilities
 *
 * Shared utility functions and constants for email templates including:
 * - Address parsing and location code generation
 * - Date/time formatting
 * - Brand color constants
 * - Light/Dark mode support
 * - Visual indicator components
 * - Anti-spam compliant email structure helpers
 */

// =============================================================================
// BRAND COLORS - Matching AC Shuttles website design
// =============================================================================
export const BRAND_COLORS = {
  // Primary brand color (teal/emerald from website)
  primary: '#14b8a6',
  primaryDark: '#0d9488',
  primaryLight: '#5eead4',
  primaryMuted: '#99f6e4',

  // Neutral colors - Light mode
  white: '#ffffff',
  black: '#0a0a0a',
  gray50: '#fafafa',
  gray100: '#f4f4f5',
  gray200: '#e4e4e7',
  gray300: '#d4d4d8',
  gray400: '#a1a1aa',
  gray500: '#71717a',
  gray600: '#52525b',
  gray700: '#3f3f46',
  gray800: '#27272a',
  gray900: '#18181b',

  // Dark mode background colors (from website dark theme)
  darkBg: '#0f172a',
  darkCard: '#1e293b',
  darkBorder: '#334155',
  darkText: '#f1f5f9',
  darkTextMuted: '#94a3b8',

  // Email type accent colors
  pending: '#3b82f6',      // Blue - for submission ack
  pendingLight: '#dbeafe',
  pendingDark: '#1d4ed8',

  success: '#14b8a6',      // Teal - for confirmation (matches brand)
  successLight: '#ccfbf1',
  successDark: '#0f766e',

  warning: '#f59e0b',      // Amber - for owner action required
  warningLight: '#fef3c7',
  warningDark: '#d97706',

  danger: '#ef4444',       // Red - for denial
  dangerLight: '#fee2e2',
  dangerDark: '#dc2626',

  info: '#64748b',         // Slate - for informational
  infoLight: '#f1f5f9',
  infoDark: '#475569',
} as const;

// =============================================================================
// EMAIL TYPE DEFINITIONS
// =============================================================================
export type EmailType = 'request_received' | 'action_required' | 'confirmed' | 'denied' | 'reminder' | 'delivery_confirmation';

export interface EmailTypeConfig {
  icon: string;
  label: string;
  color: string;
  colorLight: string;
  colorDark: string;
  description: string;
}

export const EMAIL_TYPES: Record<EmailType, EmailTypeConfig> = {
  request_received: {
    icon: '📬',
    label: 'REQUEST RECEIVED',
    color: BRAND_COLORS.pending,
    colorLight: BRAND_COLORS.pendingLight,
    colorDark: BRAND_COLORS.pendingDark,
    description: 'Your ride request is being reviewed'
  },
  action_required: {
    icon: '⚡',
    label: 'ACTION REQUIRED',
    color: BRAND_COLORS.warning,
    colorLight: BRAND_COLORS.warningLight,
    colorDark: BRAND_COLORS.warningDark,
    description: 'New booking request needs your attention'
  },
  confirmed: {
    icon: '✓',
    label: 'RIDE CONFIRMED',
    color: BRAND_COLORS.success,
    colorLight: BRAND_COLORS.successLight,
    colorDark: BRAND_COLORS.successDark,
    description: 'Your ride has been confirmed'
  },
  denied: {
    icon: '✕',
    label: 'UNABLE TO ACCOMMODATE',
    color: BRAND_COLORS.danger,
    colorLight: BRAND_COLORS.dangerLight,
    colorDark: BRAND_COLORS.dangerDark,
    description: 'We cannot accommodate this request'
  },
  reminder: {
    icon: '🔔',
    label: 'TRIP REMINDER',
    color: BRAND_COLORS.primary,
    colorLight: BRAND_COLORS.successLight,
    colorDark: BRAND_COLORS.primaryDark,
    description: 'Your ride is coming up soon'
  },
  delivery_confirmation: {
    icon: '✉',
    label: 'DELIVERY CONFIRMED',
    color: BRAND_COLORS.info,
    colorLight: BRAND_COLORS.infoLight,
    colorDark: BRAND_COLORS.infoDark,
    description: 'Customer notification delivered'
  }
};

// =============================================================================
// ANTI-SPAM EMAIL HEADERS AND STRUCTURE
// =============================================================================

/**
 * Generates the standard HTML email head section with anti-spam best practices
 * - Proper charset and viewport
 * - Preheader text support
 * - MSO (Microsoft Office) conditional comments for Outlook
 */
export function getEmailHead(title: string): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="x-apple-disable-message-reformatting">
    <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
    <title>${title}</title>
    <!--[if mso]>
    <noscript>
        <xml>
            <o:OfficeDocumentSettings>
                <o:PixelsPerInch>96</o:PixelsPerInch>
            </o:OfficeDocumentSettings>
        </xml>
    </noscript>
    <![endif]-->`;
}

/**
 * Generates CSS reset styles for email clients
 * These ensure consistent rendering across different email clients
 * Includes dark mode support via prefers-color-scheme
 */
export function getEmailResetStyles(): string {
  return `
    <style type="text/css">
        /* Reset styles for email clients */
        body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
        table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
        img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
        body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; }
        a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; font-size: inherit !important; font-family: inherit !important; font-weight: inherit !important; line-height: inherit !important; }
        #MessageViewBody a { color: inherit; text-decoration: none; font-size: inherit; font-family: inherit; font-weight: inherit; line-height: inherit; }
        .button-link { text-decoration: none !important; }

        /* Base styles - Light mode (default) */
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background-color: ${BRAND_COLORS.gray100};
            margin: 0;
            padding: 0;
        }

        /* Dark mode styles */
        @media (prefers-color-scheme: dark) {
            body { background-color: ${BRAND_COLORS.darkBg} !important; }
            .email-body-bg { background-color: ${BRAND_COLORS.darkBg} !important; }
            .email-card { background-color: ${BRAND_COLORS.darkCard} !important; }
            .email-card-secondary { background-color: ${BRAND_COLORS.darkBg} !important; border-color: ${BRAND_COLORS.darkBorder} !important; }
            .email-ref-badge { background-color: ${BRAND_COLORS.gray900} !important; border-color: ${BRAND_COLORS.darkBorder} !important; }
            .text-dark { color: ${BRAND_COLORS.darkText} !important; }
            .text-muted { color: ${BRAND_COLORS.darkTextMuted} !important; }
            .text-ref { color: ${BRAND_COLORS.primary} !important; }
            .border-light { border-color: ${BRAND_COLORS.darkBorder} !important; }
            .logo-light { display: none !important; }
            .logo-dark { display: block !important; }
        }

        /* Responsive styles */
        @media only screen and (max-width: 620px) {
            .email-container { width: 100% !important; max-width: 100% !important; }
            .fluid { width: 100% !important; max-width: 100% !important; height: auto !important; }
            .stack-column { display: block !important; width: 100% !important; max-width: 100% !important; padding-right: 0 !important; padding-left: 0 !important; padding-bottom: 12px !important; }
            .stack-column-center { display: block !important; width: 100% !important; max-width: 100% !important; text-align: center !important; }
            .center-on-narrow { text-align: center !important; display: block !important; margin-left: auto !important; margin-right: auto !important; float: none !important; }
            table.center-on-narrow { display: inline-block !important; }
            .padding-mobile { padding-left: 20px !important; padding-right: 20px !important; }
            .padding-mobile-sm { padding-left: 16px !important; padding-right: 16px !important; }
            .hide-mobile { display: none !important; }
            .show-mobile { display: block !important; }
            .font-mobile-lg { font-size: 22px !important; }
            .font-mobile-md { font-size: 18px !important; }
            .font-mobile-sm { font-size: 14px !important; }
            .button-mobile { padding: 14px 20px !important; font-size: 15px !important; }
            .type-indicator { padding: 12px 16px !important; }
            .type-indicator-icon { font-size: 20px !important; }
            .type-indicator-text { font-size: 11px !important; }
        }
    </style>`;
}

/**
 * Generates the visual type indicator bar at the top of emails
 * This provides immediate visual context about the email's purpose
 */
export function getEmailTypeIndicator(emailType: EmailType): string {
  const config = EMAIL_TYPES[emailType];

  return `
    <!-- Type Indicator Bar -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: ${config.color};">
        <tr>
            <td class="type-indicator" style="padding: 16px 24px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto;">
                    <tr>
                        <td style="text-align: center;">
                            <span class="type-indicator-icon" style="font-size: 24px; margin-right: 10px; vertical-align: middle;">${config.icon}</span>
                            <span class="type-indicator-text" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; font-weight: 700; color: ${BRAND_COLORS.white}; letter-spacing: 2px; text-transform: uppercase; vertical-align: middle;">
                                ${config.label}
                            </span>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>`;
}

// =============================================================================
// BRAND LOGO - AC Shuttles logo images (base64 encoded for email embedding)
// =============================================================================

// Dark logo (black background, white arrow) - for use on light backgrounds
const LOGO_DARK_BASE64 = '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';

// Light logo (white/outline) - for use on dark backgrounds
const LOGO_LIGHT_BASE64 = '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';

/**
 * Get base64 data URI for the AC Shuttles logo
 * @param variant 'dark' for dark logo (use on light backgrounds), 'light' for light logo (use on dark backgrounds)
 */
export function getLogoDataUri(variant: 'dark' | 'light' = 'dark'): string {
  const base64 = variant === 'dark' ? LOGO_DARK_BASE64 : LOGO_LIGHT_BASE64;
  return `data:image/png;base64,${base64}`;
}

/**
 * Generates the AC Shuttles logo/header for emails
 * Includes both light and dark mode versions for email client support
 */
export function getEmailLogoHeader(): string {
  const darkLogoUri = getLogoDataUri('dark');
  const lightLogoUri = getLogoDataUri('light');

  return `
    <!-- Logo/Header -->
    <tr>
        <td style="padding: 28px 20px 24px; text-align: center;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                <tr>
                    <td style="padding-right: 12px; vertical-align: middle;">
                        <!-- Light logo for light mode (default) -->
                        <img class="logo-light" src="${lightLogoUri}" alt="AC Shuttles" width="32" height="32" style="display: block; width: 32px; height: 32px; border: 0;">
                        <!-- Dark logo for dark mode (hidden by default, shown via CSS) -->
                        <img class="logo-dark" src="${darkLogoUri}" alt="AC Shuttles" width="32" height="32" style="display: none; width: 32px; height: 32px; border: 0;">
                    </td>
                    <td style="vertical-align: middle;">
                        <span class="text-dark" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 18px; font-weight: 700; color: ${BRAND_COLORS.gray900}; letter-spacing: 2px;">AC SHUTTLES</span>
                    </td>
                </tr>
            </table>
        </td>
    </tr>`;
}

/**
 * Generates the email footer with required anti-spam elements
 * - Physical address (required by CAN-SPAM)
 * - Contact information
 * - Company branding
 * Supports dark mode via CSS classes
 */
export function getEmailFooter(contactPhone: string, contactEmail: string): string {
  return `
    <!-- Footer -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto;">
        <tr>
            <td style="padding: 30px 20px; text-align: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                <p class="text-muted" style="margin: 0 0 10px 0; font-size: 14px; color: ${BRAND_COLORS.gray500};">
                    AC Shuttles - Private Shuttle Service
                </p>
                <p class="text-muted" style="margin: 0 0 10px 0; font-size: 13px; color: ${BRAND_COLORS.gray400};">
                    Serving NJ, Philadelphia &amp; NYC Area
                </p>
                <p style="margin: 0 0 15px 0; font-size: 13px;">
                    <a href="tel:${contactPhone}" style="color: ${BRAND_COLORS.primary}; text-decoration: none;">${contactPhone}</a>
                    <span class="text-muted" style="color: ${BRAND_COLORS.gray400};">&nbsp;&bull;&nbsp;</span>
                    <a href="mailto:${contactEmail}" style="color: ${BRAND_COLORS.primary}; text-decoration: none;">${contactEmail}</a>
                </p>
                <p class="text-muted" style="margin: 0; font-size: 12px; color: ${BRAND_COLORS.gray400};">
                    &copy; ${new Date().getFullYear()} AC Shuttles. All rights reserved.
                </p>
            </td>
        </tr>
    </table>`;
}

/**
 * Generates a preheader (preview text) that shows in email clients
 * This text appears after the subject line in the inbox preview
 */
export function getPreheader(text: string): string {
  // The hidden span with whitespace prevents email clients from pulling in other content
  return `
    <div style="display: none; font-size: 1px; color: #fefefe; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
        ${text}
        ${'&zwnj;&nbsp;'.repeat(50)}
    </div>`;
}

// =============================================================================
// ADDRESS PARSING UTILITIES
// =============================================================================

/**
 * Common airport name to IATA code mappings
 * These provide recognizable codes for well-known airports
 */
const AIRPORT_CODES: Record<string, string> = {
  // New York Area
  'newark liberty international airport': 'EWR',
  'newark airport': 'EWR',
  'newark liberty': 'EWR',
  'ewr': 'EWR',
  'john f kennedy international airport': 'JFK',
  'jfk airport': 'JFK',
  'jfk international': 'JFK',
  'kennedy airport': 'JFK',
  'laguardia airport': 'LGA',
  'laguardia': 'LGA',

  // Philadelphia Area
  'philadelphia international airport': 'PHL',
  'philadelphia airport': 'PHL',
  'phl airport': 'PHL',

  // Atlantic City
  'atlantic city international airport': 'ACY',
  'atlantic city airport': 'ACY',

  // Other Regional
  'trenton mercer airport': 'TTN',
  'trenton airport': 'TTN',
  'lehigh valley international airport': 'ABE',
  'allentown airport': 'ABE',
};

/**
 * City name to short code mappings for non-airport locations
 */
const CITY_CODES: Record<string, string> = {
  'philadelphia': 'PHIL',
  'atlantic city': 'ATLC',
  'newark': 'NWRK',
  'new york': 'NYC',
  'manhattan': 'NYC',
  'brooklyn': 'BKLN',
  'queens': 'QNS',
  'trenton': 'TRTN',
  'princeton': 'PRCN',
  'cherry hill': 'CHHL',
  'camden': 'CMDN',
  'hoboken': 'HBKN',
  'jersey city': 'JRCY',
};

/**
 * Utility function to parse address from various input formats
 * Handles formats like: "1000 Boardwalk, Atlantic City, NJ 08401"
 */
export function parseAddress(input: string): {
  street: string;
  suite?: string;
  city: string;
  state: string;
  zipCode: string;
} {
  const trimmed = input.trim();

  // Split by commas and clean up
  const parts = trimmed.split(',').map(part => part.trim());

  if (parts.length >= 3) {
    // Format: "Street Address, City, State Zip"
    const street = parts[0];
    const city = parts[parts.length - 2];
    const stateZipPart = parts[parts.length - 1];

    // Extract state and zip from last part (e.g., "NJ 08401")
    const stateZipMatch = stateZipPart.match(/^([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/);

    if (stateZipMatch) {
      return {
        street,
        city,
        state: stateZipMatch[1],
        zipCode: stateZipMatch[2]
      };
    }
  }

  // If parsing fails, return the input as street address
  return {
    street: trimmed,
    city: '',
    state: '',
    zipCode: ''
  };
}

/**
 * Generate location codes from physical addresses
 * Used for the large airport-style codes in tickets
 *
 * Priority:
 * 1. Check for known airport names -> return IATA code (EWR, JFK, PHL, etc.)
 * 2. Check for known city names -> return city code (PHIL, ATLC, etc.)
 * 3. Fall back to generating code from address text
 *
 * Examples:
 * - "Newark Liberty International Airport, Newark, NJ" -> "EWR"
 * - "123 Main Street, Philadelphia, PA 19103" -> "PHIL"
 * - "1000 Boardwalk, Atlantic City, NJ 08401" -> "ATLC"
 */
export function generateLocationCode(address: string): string {
  const lowerAddress = address.toLowerCase();

  // First, check for known airport names
  for (const [airportName, code] of Object.entries(AIRPORT_CODES)) {
    if (lowerAddress.includes(airportName)) {
      return code;
    }
  }

  // Parse the address to get meaningful parts
  const parsed = parseAddress(address);
  const lowerCity = parsed.city.toLowerCase();

  // Check for known city names
  for (const [cityName, code] of Object.entries(CITY_CODES)) {
    if (lowerCity === cityName || lowerCity.includes(cityName)) {
      return code;
    }
  }

  // Prefer city name for generating code, fallback to street
  const sourceText = parsed.city || parsed.street;

  // Remove common words and clean up
  const cleanLocation = sourceText
    .replace(/\b(street|st|avenue|ave|boulevard|blvd|road|rd|lane|ln|drive|dr|court|ct|circle|cir|place|pl|way|international|airport|the|and|of|in|at|to|from)\b/gi, '')
    .replace(/[^a-zA-Z\s]/g, '')
    .trim();

  const words = cleanLocation.split(/\s+/).filter(word => word.length > 1);

  if (words.length === 0) {
    // Fallback: use first 4 chars of original input
    return address.replace(/[^a-zA-Z]/g, '').substring(0, 4).toUpperCase() || 'ADDR';
  } else if (words.length === 1) {
    // Single word: take first 4 characters
    return words[0].substring(0, 4).toUpperCase();
  } else if (words.length === 2) {
    // Two words: take first 2 chars of each
    return (words[0].substring(0, 2) + words[1].substring(0, 2)).toUpperCase();
  } else {
    // Multiple words: take first char of each word, up to 4 chars
    return words
      .map(word => word.charAt(0))
      .join('')
      .substring(0, 4)
      .toUpperCase();
  }
}

// =============================================================================
// DATE/TIME FORMATTING UTILITIES
// =============================================================================

/**
 * Format datetime string for display without timezone conversion
 * Handles various input formats and outputs human-readable format
 *
 * @param dateTimeString - Can be ISO string like "2025-10-16T13:52" or already formatted
 * @returns Object with formatted date and time strings
 */
export function formatPickupDateTime(dateTimeString: string): { date: string; time: string } {
  // If already formatted (contains AM/PM), return as-is
  if (/\d{1,2}:\d{2}\s*(AM|PM)/i.test(dateTimeString)) {
    return {
      date: dateTimeString,
      time: dateTimeString
    };
  }

  // Try to parse as ISO datetime (e.g., "2025-10-16T13:52")
  try {
    const date = new Date(dateTimeString);

    // Check if date is valid
    if (isNaN(date.getTime())) {
      // Return original if can't parse
      return { date: dateTimeString, time: dateTimeString };
    }

    // Format date as MM/DD/YYYY
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    const formattedDate = `${month}/${day}/${year}`;

    // Format time as H:MM AM/PM (without leading zero for hours)
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12; // Convert to 12-hour format
    const formattedTime = `${hours}:${minutes} ${ampm}`;

    return {
      date: formattedDate,
      time: formattedTime
    };
  } catch (error) {
    // Return original if any error
    return { date: dateTimeString, time: dateTimeString };
  }
}

/**
 * @deprecated Use formatPickupDateTime instead
 * Format date for display in tickets
 * Converts UTC time to the specified timezone before formatting
 *
 * @param dateString ISO date string (typically in UTC)
 * @param timeZone IANA timezone (default: America/New_York)
 */
export function formatTicketDate(dateString: string, timeZone: string = 'America/New_York'): string {
  const date = new Date(dateString);
  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
    timeZone
  };
  return date.toLocaleDateString('en-US', options).toUpperCase();
}

/**
 * @deprecated Use formatPickupDateTime instead
 * Format time for display in tickets
 * Converts UTC time to the specified timezone before formatting
 *
 * @param dateString ISO date string (typically in UTC)
 * @param timeZone IANA timezone (default: America/New_York)
 */
export function formatTicketTime(dateString: string, timeZone: string = 'America/New_York'): string {
  const date = new Date(dateString);
  const options: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone
  };
  return date.toLocaleTimeString('en-US', options).toUpperCase();
}

/**
 * Calculate estimated arrival time given pickup time and duration
 */
export function calculateArrivalTime(pickupTime: string, durationMinutes: number): string {
  const pickup = new Date(pickupTime);
  const arrival = new Date(pickup.getTime() + (durationMinutes * 60000));
  return arrival.toISOString();
}

/**
 * Extract duration in minutes from duration string (e.g., "25 minutes" -> 25)
 */
export function parseDurationMinutes(duration: string): number {
  const match = duration.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 30; // Default to 30 minutes
}

/**
 * Escapes HTML special characters to prevent XSS
 */
export function escapeHtml(text: string): string {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  return text.replace(/[&<>"']/g, char => htmlEntities[char] || char);
}

/**
 * Format an ISO timestamp to a human-readable format
 * Example: "2025-12-10T15:45:18.840Z" -> "December 10, 2025 at 10:45 AM EST"
 *
 * @param isoTimestamp - ISO 8601 timestamp string
 * @param timeZone - IANA timezone (default: America/New_York)
 */
export function formatHumanReadableTimestamp(isoTimestamp: string, timeZone: string = 'America/New_York'): string {
  try {
    const date = new Date(isoTimestamp);

    // Check if date is valid
    if (isNaN(date.getTime())) {
      return isoTimestamp; // Return original if can't parse
    }

    const options: Intl.DateTimeFormatOptions = {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone,
      timeZoneName: 'short'
    };

    return date.toLocaleString('en-US', options);
  } catch (error) {
    return isoTimestamp; // Return original if any error
  }
}
