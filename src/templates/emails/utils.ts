/**
 * Email Template Utilities
 * 
 * Shared utility functions for email templates including address parsing,
 * location code generation, and date/time formatting.
 */

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
 * Examples: "1000 Boardwalk, Atlantic City, NJ 08401" -> "ATLC"
 */
export function generateLocationCode(address: string): string {
  // Parse the address to get meaningful parts
  const parsed = parseAddress(address);
  
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

/**
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