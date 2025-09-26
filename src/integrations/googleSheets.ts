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
  fetchImpl?: typeof fetch;
}

const DEFAULT_TOKEN_URI = "https://oauth2.googleapis.com/token";
const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

export class GoogleSheetsClient {
  private readonly credentials: GoogleServiceAccount;
  private readonly fetchImpl: typeof fetch;
  private tokenCache: TokenCache | null = null;

  constructor(options: GoogleSheetsClientOptions) {
    this.credentials = parseCredentials(options.credentialsJson);
    const defaultFetch = fetch.bind(globalThis);
    this.fetchImpl = options.fetchImpl ?? defaultFetch;
  }

  async appendRow(params: AppendRowParams): Promise<void> {
    const token = await this.getAccessToken();
    const url = new URL(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        params.sheetId
      )}/values/${encodeURIComponent(params.range)}:append`
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
      throw new Error(
        `Google Sheets append failed (${response.status}): ${errorText}`
      );
    }
  }

  async appendAuditEntry(params: AppendRowParams): Promise<void> {
    await this.appendRow(params);
  }

  async readRange(params: ReadRangeParams): Promise<(string | number | null)[][]> {
    const token = await this.getAccessToken();
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      params.sheetId
    )}/values/${encodeURIComponent(params.range)}`;

    const response = await this.fetchImpl(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorText = await safeReadText(response);
      throw new Error(
        `Google Sheets read failed (${response.status}): ${errorText}`
      );
    }

    const data = await response.json() as { values?: (string | number | null)[][] };
    return data.values || [];
  }

  async updateRange(params: UpdateRangeParams): Promise<void> {
    const token = await this.getAccessToken();
    const url = new URL(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        params.sheetId
      )}/values/${encodeURIComponent(params.range)}`
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
      throw new Error(
        `Google Sheets update failed (${response.status}): ${errorText}`
      );
    }
  }

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.tokenCache && this.tokenCache.expiresAt - 60_000 > now) {
      return this.tokenCache.accessToken;
    }

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
      throw new Error(
        `Failed to obtain Google access token (${response.status}): ${errorText}`
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
    return data.access_token;
  }

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

function parseCredentials(json: string): GoogleServiceAccount {
  try {
    const parsed = JSON.parse(json) as GoogleServiceAccount;
    if (!parsed.client_email || !parsed.private_key) {
      throw new Error("Missing client_email or private_key");
    }
    return parsed;
  } catch (error) {
    throw new Error("Invalid GOOGLE_SERVICE_ACCOUNT credential: " + error);
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
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
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

  const buffer = (globalThis as any).Buffer?.from(value, "base64");
  if (buffer) {
    return new Uint8Array(
      buffer.buffer,
      buffer.byteOffset,
      buffer.byteLength
    );
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

  const buffer = (globalThis as any).Buffer?.from(bytes);
  if (buffer) {
    return buffer.toString("base64");
  }

  throw new Error("No base64 encoder available in this environment");
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch (error) {
    console.warn("Failed to read response text", error);
    return "<no body>";
  }
}
