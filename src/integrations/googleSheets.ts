/**
 * Google Sheets Client with Enterprise-Grade Reliability
 *
 * Features:
 * - Automatic retry with exponential backoff
 * - Write verification (read-after-write)
 * - Comprehensive structured logging
 * - Proper error classification (retryable vs non-retryable)
 * - Token refresh handling
 */

interface GoogleServiceAccount {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

export interface AppendRowParams {
  sheetId: string;
  range: string;
  values: (string | number | null)[];
}

export interface AppendRowResult {
  success: boolean;
  updatedRange: string;
  rowNumber: number;
}

export interface ReadRangeParams {
  sheetId: string;
  range: string;
}

export interface UpdateRangeParams {
  sheetId: string;
  range: string;
  values: (string | number | null)[][];
}

export interface GoogleSheetsClientOptions {
  credentialsJson: string;
  maxRetries?: number;
  retryDelayMs?: number;
  verifyWrites?: boolean;
  fetchImpl?: typeof fetch;
}

interface Logger {
  info(event: string, data?: Record<string, unknown>): void;
  warn(event: string, data?: Record<string, unknown>): void;
  error(event: string, data?: Record<string, unknown>): void;
}

const DEFAULT_TOKEN_URI = "https://oauth2.googleapis.com/token";
const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 1000;
const DEFAULT_VERIFY_WRITES = true;

// Error codes that indicate transient failures worth retrying
const RETRYABLE_STATUS_CODES = [429, 500, 502, 503, 504];
const RETRYABLE_ERROR_PATTERNS = [
  /ECONNRESET/i,
  /ETIMEDOUT/i,
  /ENOTFOUND/i,
  /network/i,
  /socket hang up/i,
  /rate limit/i,
  /quota/i,
];

export class GoogleSheetsError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly sheetId?: string,
    public readonly range?: string,
    public readonly operation?: string,
    public readonly isRetryable: boolean = false
  ) {
    super(message);
    this.name = 'GoogleSheetsError';
  }
}

export class WriteVerificationError extends GoogleSheetsError {
  constructor(
    public readonly expectedValues: (string | number | null)[],
    sheetId: string,
    range: string
  ) {
    super(
      `Write verification failed: row not found after successful write`,
      undefined,
      sheetId,
      range,
      'verify'
    );
    this.name = 'WriteVerificationError';
  }
}

const defaultLogger: Logger = {
  info: (event, data) => console.log(JSON.stringify({ level: 'INFO', event, ...data, timestamp: new Date().toISOString() })),
  warn: (event, data) => console.warn(JSON.stringify({ level: 'WARN', event, ...data, timestamp: new Date().toISOString() })),
  error: (event, data) => console.error(JSON.stringify({ level: 'ERROR', event, ...data, timestamp: new Date().toISOString() })),
};

export class GoogleSheetsClient {
  private readonly credentials: GoogleServiceAccount;
  private readonly fetchImpl: typeof fetch;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private readonly verifyWrites: boolean;
  private readonly logger: Logger;
  private tokenCache: TokenCache | null = null;

  constructor(options: GoogleSheetsClientOptions) {
    this.credentials = parseCredentials(options.credentialsJson);
    this.fetchImpl = options.fetchImpl ?? fetch.bind(globalThis);
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
    this.verifyWrites = options.verifyWrites ?? DEFAULT_VERIFY_WRITES;
    this.logger = defaultLogger;
  }

  /**
   * Append a row to a Google Sheet with retry and verification
   */
  async appendRow(params: AppendRowParams): Promise<AppendRowResult> {
    const operationId = generateOperationId();

    this.logger.info('sheets.append.start', {
      operationId,
      sheetId: params.sheetId,
      range: params.range,
      columnCount: params.values.length,
    });

    const result = await this.withRetry(
      async () => {
        const token = await this.getAccessToken();
        const url = new URL(
          `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(params.sheetId)}/values/${encodeURIComponent(params.range)}:append`
        );
        url.searchParams.set("valueInputOption", "USER_ENTERED");

        const response = await this.fetchImpl(url.toString(), {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ values: [params.values] }),
        });

        if (!response.ok) {
          const errorText = await safeReadText(response);
          const isRetryable = RETRYABLE_STATUS_CODES.includes(response.status);

          this.logger.warn('sheets.append.http_error', {
            operationId,
            statusCode: response.status,
            isRetryable,
            errorText: errorText.slice(0, 500),
          });

          throw new GoogleSheetsError(
            `Google Sheets append failed (${response.status}): ${errorText}`,
            response.status,
            params.sheetId,
            params.range,
            'append',
            isRetryable
          );
        }

        const data = await response.json() as {
          updates?: {
            updatedRange?: string;
            updatedRows?: number;
          };
        };

        const updatedRange = data.updates?.updatedRange ?? params.range;
        const rowNumber = extractRowNumber(updatedRange);

        this.logger.info('sheets.append.success', {
          operationId,
          updatedRange,
          rowNumber,
        });

        return { success: true, updatedRange, rowNumber };
      },
      {
        operationId,
        operation: 'append',
        sheetId: params.sheetId,
        range: params.range,
      }
    );

    // Verify the write if enabled
    if (this.verifyWrites && result.rowNumber > 0) {
      await this.verifyWrite(params, result.rowNumber, operationId);
    }

    return result;
  }

  /**
   * Append an audit entry (convenience wrapper with less strict verification)
   */
  async appendAuditEntry(params: AppendRowParams): Promise<void> {
    const operationId = generateOperationId();

    this.logger.info('sheets.audit.start', {
      operationId,
      sheetId: params.sheetId,
      range: params.range,
      entryType: params.values[1], // Usually the event type
    });

    try {
      // Audit entries don't need verification - they're fire-and-forget with retry
      await this.withRetry(
        async () => {
          const token = await this.getAccessToken();
          const url = new URL(
            `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(params.sheetId)}/values/${encodeURIComponent(params.range)}:append`
          );
          url.searchParams.set("valueInputOption", "USER_ENTERED");

          const response = await this.fetchImpl(url.toString(), {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ values: [params.values] }),
          });

          if (!response.ok) {
            const errorText = await safeReadText(response);
            const isRetryable = RETRYABLE_STATUS_CODES.includes(response.status);

            throw new GoogleSheetsError(
              `Google Sheets audit append failed (${response.status}): ${errorText}`,
              response.status,
              params.sheetId,
              params.range,
              'audit',
              isRetryable
            );
          }

          return true;
        },
        {
          operationId,
          operation: 'audit',
          sheetId: params.sheetId,
          range: params.range,
        }
      );

      this.logger.info('sheets.audit.success', { operationId });
    } catch (error) {
      // Audit failures are logged but don't throw - they shouldn't block the main operation
      this.logger.error('sheets.audit.failed', {
        operationId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Read a range from a Google Sheet
   */
  async readRange(params: ReadRangeParams): Promise<(string | number | null)[][]> {
    const operationId = generateOperationId();

    this.logger.info('sheets.read.start', {
      operationId,
      sheetId: params.sheetId,
      range: params.range,
    });

    const result = await this.withRetry(
      async () => {
        const token = await this.getAccessToken();
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(params.sheetId)}/values/${encodeURIComponent(params.range)}`;

        const response = await this.fetchImpl(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const errorText = await safeReadText(response);
          const isRetryable = RETRYABLE_STATUS_CODES.includes(response.status);

          this.logger.warn('sheets.read.http_error', {
            operationId,
            statusCode: response.status,
            isRetryable,
          });

          throw new GoogleSheetsError(
            `Google Sheets read failed (${response.status}): ${errorText}`,
            response.status,
            params.sheetId,
            params.range,
            'read',
            isRetryable
          );
        }

        const data = await response.json() as { values?: (string | number | null)[][] };
        const values = data.values ?? [];

        this.logger.info('sheets.read.success', {
          operationId,
          rowCount: values.length,
        });

        return values;
      },
      {
        operationId,
        operation: 'read',
        sheetId: params.sheetId,
        range: params.range,
      }
    );

    return result;
  }

  /**
   * Update a specific range in a Google Sheet
   */
  async updateRange(params: UpdateRangeParams): Promise<void> {
    const operationId = generateOperationId();

    this.logger.info('sheets.update.start', {
      operationId,
      sheetId: params.sheetId,
      range: params.range,
    });

    await this.withRetry(
      async () => {
        const token = await this.getAccessToken();
        const url = new URL(
          `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(params.sheetId)}/values/${encodeURIComponent(params.range)}`
        );
        url.searchParams.set("valueInputOption", "USER_ENTERED");

        const response = await this.fetchImpl(url.toString(), {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ values: params.values }),
        });

        if (!response.ok) {
          const errorText = await safeReadText(response);
          const isRetryable = RETRYABLE_STATUS_CODES.includes(response.status);

          this.logger.warn('sheets.update.http_error', {
            operationId,
            statusCode: response.status,
            isRetryable,
          });

          throw new GoogleSheetsError(
            `Google Sheets update failed (${response.status}): ${errorText}`,
            response.status,
            params.sheetId,
            params.range,
            'update',
            isRetryable
          );
        }

        this.logger.info('sheets.update.success', { operationId });
        return true;
      },
      {
        operationId,
        operation: 'update',
        sheetId: params.sheetId,
        range: params.range,
      }
    );
  }

  /**
   * Verify a write by reading back the row
   */
  private async verifyWrite(
    params: AppendRowParams,
    rowNumber: number,
    operationId: string
  ): Promise<void> {
    // Extract sheet name from range (e.g., "Sheet1!A:Z" -> "Sheet1")
    const sheetName = params.range.split('!')[0] || 'Sheet1';
    const verifyRange = `${sheetName}!A${rowNumber}:Z${rowNumber}`;

    this.logger.info('sheets.verify.start', {
      operationId,
      verifyRange,
      rowNumber,
    });

    try {
      const rows = await this.readRange({
        sheetId: params.sheetId,
        range: verifyRange,
      });

      if (rows.length === 0) {
        this.logger.error('sheets.verify.failed', {
          operationId,
          reason: 'row_not_found',
          rowNumber,
        });
        throw new WriteVerificationError(params.values, params.sheetId, params.range);
      }

      // Check if the first value (transaction ID) matches
      const writtenRow = rows[0];
      const expectedFirstValue = String(params.values[0]);
      const actualFirstValue = String(writtenRow[0] ?? '');

      if (actualFirstValue !== expectedFirstValue) {
        this.logger.error('sheets.verify.failed', {
          operationId,
          reason: 'value_mismatch',
          expected: expectedFirstValue,
          actual: actualFirstValue,
        });
        throw new WriteVerificationError(params.values, params.sheetId, params.range);
      }

      this.logger.info('sheets.verify.success', {
        operationId,
        rowNumber,
        transactionId: expectedFirstValue.slice(0, 12),
      });
    } catch (error) {
      if (error instanceof WriteVerificationError) {
        throw error;
      }
      // Log but don't fail if verification itself errors (network issues, etc.)
      this.logger.warn('sheets.verify.error', {
        operationId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Execute an operation with retry logic
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    context: {
      operationId: string;
      operation: string;
      sheetId: string;
      range: string;
    }
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        const isRetryable = this.isRetryableError(error);
        const isLastAttempt = attempt === this.maxRetries;

        this.logger.warn('sheets.retry', {
          ...context,
          attempt,
          maxRetries: this.maxRetries,
          isRetryable,
          isLastAttempt,
          error: lastError.message,
        });

        if (!isRetryable || isLastAttempt) {
          throw lastError;
        }

        // Exponential backoff with jitter
        const delay = this.retryDelayMs * Math.pow(2, attempt - 1) + Math.random() * 100;
        await this.delay(delay);
      }
    }

    throw lastError ?? new Error('Retry failed with unknown error');
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof GoogleSheetsError) {
      return error.isRetryable;
    }

    if (error instanceof Error) {
      return RETRYABLE_ERROR_PATTERNS.some(pattern => pattern.test(error.message));
    }

    return false;
  }

  /**
   * Delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get a valid access token, refreshing if necessary
   */
  private async getAccessToken(): Promise<string> {
    const now = Date.now();

    // Return cached token if still valid (with 60s buffer)
    if (this.tokenCache && this.tokenCache.expiresAt - 60_000 > now) {
      return this.tokenCache.accessToken;
    }

    this.logger.info('sheets.auth.refresh', {
      reason: this.tokenCache ? 'expired' : 'initial',
    });

    const assertion = await this.createJwtAssertion();
    const tokenUri = this.credentials.token_uri ?? DEFAULT_TOKEN_URI;

    const body = new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    });

    const response = await this.fetchImpl(tokenUri, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await safeReadText(response);
      this.logger.error('sheets.auth.failed', {
        statusCode: response.status,
        error: errorText.slice(0, 200),
      });
      throw new GoogleSheetsError(
        `Failed to obtain Google access token (${response.status}): ${errorText}`,
        response.status,
        undefined,
        undefined,
        'auth',
        RETRYABLE_STATUS_CODES.includes(response.status)
      );
    }

    const data = (await response.json()) as {
      access_token: string;
      expires_in: number;
    };

    const expiresAt = now + Math.max((data.expires_in - 60) * 1000, 0);
    this.tokenCache = {
      accessToken: data.access_token,
      expiresAt,
    };

    this.logger.info('sheets.auth.success', {
      expiresIn: data.expires_in,
    });

    return data.access_token;
  }

  /**
   * Create a JWT assertion for Google OAuth
   */
  private async createJwtAssertion(): Promise<string> {
    const header = base64UrlEncodeJson({ alg: "RS256", typ: "JWT" });
    const nowSeconds = Math.floor(Date.now() / 1000);
    const payload = base64UrlEncodeJson({
      iss: this.credentials.client_email,
      scope: SHEETS_SCOPE,
      aud: this.credentials.token_uri ?? DEFAULT_TOKEN_URI,
      exp: nowSeconds + 3600,
      iat: nowSeconds,
    });

    const unsignedToken = `${header}.${payload}`;
    const signatureBytes = await sign(unsignedToken, this.credentials.private_key);
    const signature = base64UrlEncodeBytes(signatureBytes);

    return `${unsignedToken}.${signature}`;
  }
}

// Helper functions

function parseCredentials(json: string): GoogleServiceAccount {
  try {
    const parsed = JSON.parse(json) as GoogleServiceAccount;
    if (!parsed.client_email || !parsed.private_key) {
      throw new Error("Missing client_email or private_key");
    }
    return parsed;
  } catch (error) {
    throw new GoogleSheetsError(
      `Invalid GOOGLE_SERVICE_ACCOUNT credential: ${error}`,
      undefined,
      undefined,
      undefined,
      'parse',
      false
    );
  }
}

async function sign(message: string, pem: string): Promise<Uint8Array> {
  const keyData = pemToArrayBuffer(pem);
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(message)
  );

  return new Uint8Array(signature);
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const clean = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const bytes = decodeBase64(clean);
  // Copy to a new ArrayBuffer to ensure we have a plain ArrayBuffer (not SharedArrayBuffer)
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function decodeBase64(value: string): Uint8Array {
  if (typeof atob === "function") {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  throw new Error("No base64 decoder available in this environment");
}

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  return base64Encode(bytes)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlEncodeJson(value: Record<string, unknown>): string {
  const json = JSON.stringify(value);
  const bytes = new TextEncoder().encode(json);
  return base64UrlEncodeBytes(bytes);
}

function base64Encode(bytes: Uint8Array): string {
  if (typeof btoa === "function") {
    let binary = "";
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  throw new Error("No base64 encoder available in this environment");
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "<unable to read response body>";
  }
}

function extractRowNumber(range: string): number {
  // Extract row number from range like "Sheet1!A5:Z5" or "Sheet1!A5"
  const match = range.match(/!?[A-Z]+(\d+)/i);
  return match ? parseInt(match[1], 10) : 0;
}

function generateOperationId(): string {
  return Math.random().toString(36).slice(2, 10);
}
