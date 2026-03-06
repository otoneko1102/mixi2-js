export interface Authenticator {
  getAccessToken(): Promise<string>;
}

export interface AuthenticatorOptions {
  clientId: string;
  clientSecret: string;
  tokenUrl: string;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export class OAuth2Authenticator implements Authenticator {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly tokenUrl: string;

  private accessToken: string | null = null;
  private expiresAt: number | null = null;

  constructor(options: AuthenticatorOptions) {
    this.clientId = options.clientId;
    this.clientSecret = options.clientSecret;
    this.tokenUrl = options.tokenUrl;
  }

  async getAccessToken(): Promise<string> {
    if (this.accessToken && this.expiresAt && Date.now() < this.expiresAt) {
      return this.accessToken;
    }
    await this.refreshToken();
    return this.accessToken!;
  }

  private async refreshToken(): Promise<void> {
    const credentials = Buffer.from(
      `${encodeURIComponent(this.clientId)}:${encodeURIComponent(this.clientSecret)}`,
    ).toString("base64");

    const response = await fetch(this.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${credentials}`,
      },
      body: "grant_type=client_credentials",
    });

    if (!response.ok) {
      throw new Error(
        `Failed to acquire access token: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as TokenResponse;
    this.accessToken = data.access_token;
    // Refresh 1 minute before expiry
    this.expiresAt = Date.now() + (data.expires_in - 60) * 1000;
  }
}
