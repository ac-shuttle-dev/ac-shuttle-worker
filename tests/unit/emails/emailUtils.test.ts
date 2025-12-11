/**
 * Email Utility Function Tests
 *
 * Tests for utility functions used in email generation:
 * - Location code generation
 * - Date/time formatting
 * - HTML escaping
 * - Address parsing
 */

import { describe, it, expect } from 'vitest';
import {
  generateLocationCode,
  formatPickupDateTime,
  formatTicketDate,
  formatTicketTime,
  parseAddress,
  escapeHtml,
} from '../../../src/templates/emails/utils';

describe('generateLocationCode', () => {
  it('generates codes up to 4 characters from cities', () => {
    // The function extracts meaningful parts from addresses
    // Philadelphia, PA -> city "Philadelphia" -> "PHIL"
    const philaCode = generateLocationCode('Philadelphia, PA');
    expect(philaCode).toMatch(/^[A-Z]{2,4}$/);
    expect(philaCode.length).toBeLessThanOrEqual(4);
  });

  it('handles airport names', () => {
    const code = generateLocationCode('Newark Airport, NJ');
    expect(code.length).toBeLessThanOrEqual(4);
    expect(code).toMatch(/^[A-Z]{2,4}$/);
  });

  it('handles full addresses', () => {
    const code = generateLocationCode('123 Main Street, Philadelphia, PA 19103');
    expect(code.length).toBeLessThanOrEqual(4);
    expect(code).toMatch(/^[A-Z]{2,4}$/);
  });

  it('handles short location names', () => {
    const code = generateLocationCode('AC'); // Atlantic City abbreviation
    expect(code.length).toBeLessThanOrEqual(4);
  });

  it('generates consistent codes for same location', () => {
    const code1 = generateLocationCode('Philadelphia Airport');
    const code2 = generateLocationCode('Philadelphia Airport');
    expect(code1).toBe(code2);
  });
});

describe('formatPickupDateTime', () => {
  it('formats ISO datetime string', () => {
    const result = formatPickupDateTime('2025-02-20T14:30:00-05:00');

    expect(result.date).toBeDefined();
    expect(result.time).toBeDefined();
    expect(typeof result.date).toBe('string');
    expect(typeof result.time).toBe('string');
  });

  it('handles different timezones', () => {
    const result = formatPickupDateTime('2025-06-15T10:00:00-04:00');

    expect(result.date).toBeDefined();
    expect(result.time).toBeDefined();
  });

  it('formats date in human-readable format', () => {
    const result = formatPickupDateTime('2025-03-15T09:00:00-04:00');

    // Should contain month and day
    expect(result.date).toMatch(/\d{1,2}/); // Contains a day number
  });

  it('formats time in human-readable format', () => {
    const result = formatPickupDateTime('2025-03-15T14:30:00-04:00');

    // Should contain time
    expect(result.time).toMatch(/\d{1,2}:\d{2}/);
  });
});

describe('formatTicketDate', () => {
  it('formats date for ticket display', () => {
    const dateStr = '2025-04-20T12:00:00Z';
    const result = formatTicketDate(dateStr);

    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('includes day information', () => {
    const dateStr = '2025-12-25T12:00:00Z';
    const result = formatTicketDate(dateStr);

    // Should contain day number 25
    expect(result).toContain('25');
  });
});

describe('formatTicketTime', () => {
  it('formats time for ticket display', () => {
    const dateStr = '2025-04-20T14:30:00Z';
    const result = formatTicketTime(dateStr);

    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('formats afternoon times correctly', () => {
    const dateStr = '2025-04-20T15:45:00Z';
    const result = formatTicketTime(dateStr);

    // Should be formatted as time
    expect(result).toMatch(/\d{1,2}/);
  });
});

describe('parseAddress', () => {
  it('parses full address with street, city, state', () => {
    const result = parseAddress('123 Main Street, Philadelphia, PA 19103');

    expect(result.street).toBeDefined();
    expect(result.city).toBeDefined();
    expect(result.state).toBeDefined();
  });

  it('parses address with just city and state', () => {
    const result = parseAddress('Philadelphia, PA');

    expect(result.city).toBeDefined();
    expect(result.state).toBeDefined();
  });

  it('handles airport names', () => {
    const result = parseAddress('Newark Liberty International Airport');

    expect(result).toBeDefined();
  });

  it('handles addresses with zip codes', () => {
    const result = parseAddress('456 Oak Ave, Suite 100, Cherry Hill, NJ 08034');

    expect(result).toBeDefined();
  });
});

describe('escapeHtml', () => {
  it('escapes < and > characters', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
    expect(escapeHtml('a < b > c')).toBe('a &lt; b &gt; c');
  });

  it('escapes ampersand', () => {
    expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
  });

  it('escapes double quotes', () => {
    expect(escapeHtml('Say "hello"')).toBe('Say &quot;hello&quot;');
  });

  it('escapes single quotes', () => {
    expect(escapeHtml("It's fine")).toContain('&#39;');
  });

  it('handles multiple special characters', () => {
    const input = '<script>alert("test & more")</script>';
    const result = escapeHtml(input);

    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
    expect(result).toContain('&lt;');
    expect(result).toContain('&gt;');
    expect(result).toContain('&quot;');
    expect(result).toContain('&amp;');
  });

  it('returns same string if no special characters', () => {
    expect(escapeHtml('Hello World')).toBe('Hello World');
    expect(escapeHtml('12345')).toBe('12345');
  });

  it('handles empty string', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('handles XSS attack patterns', () => {
    const xssPatterns = [
      '<img src=x onerror=alert(1)>',
      '"><script>alert("XSS")</script>',
      "javascript:alert('XSS')",
      '<svg onload=alert(1)>',
    ];

    xssPatterns.forEach((pattern) => {
      const escaped = escapeHtml(pattern);
      expect(escaped).not.toContain('<img');
      expect(escaped).not.toContain('<script');
      expect(escaped).not.toContain('<svg');
    });
  });
});
