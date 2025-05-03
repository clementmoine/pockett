import { retry } from "@/lib/retry";

export const clientIds = {
  EU: "ca89d7d6-f74e-4c4f-9fa9-a28fd13d4074",
  US: "639c2886-026e-452f-b5fc-096683d95b0e",
  AP: "51119b87-8f66-4ef9-973a-60f7034d0a98",
};

export type Region = keyof typeof clientIds;

interface TokenData {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  expiresAt?: number; // Timestamp calculé
}

class KlarnaSession {
  private tokenInfo: TokenData | null = null;
  private refreshing: Promise<string> | null = null;
  private tokenSafetyMargin = 5 * 60 * 1000; // 5 minutes
  private defaultRegion: Region = "EU";

  // Check the token is not expired
  private isTokenExpired(): boolean {
    if (!this.tokenInfo || !this.tokenInfo.expiresAt) return true;
    return Date.now() > this.tokenInfo.expiresAt - this.tokenSafetyMargin;
  }

  // Roken the token
  public revokeToken(): void {
    this.tokenInfo = null;
    this.refreshing = null;
  }

  // Get a valid token (from cache or fetch one)
  public async getToken(region: Region = this.defaultRegion): Promise<string> {
    // Valid token in cache
    if (this.tokenInfo && !this.isTokenExpired()) {
      return this.tokenInfo.access_token;
    }

    // Wait refreshing in progress
    if (this.refreshing) {
      return this.refreshing;
    }

    // Start the token refresh
    this.refreshing = this.refreshAccessToken(region);

    try {
      const token = await this.refreshing;
      return token;
    } finally {
      // Close the ended refresh
      this.refreshing = null;
    }
  }

  // Refresh the token
  private async refreshAccessToken(region: Region): Promise<string> {
    const clientId = clientIds[region];
    const refreshToken = process.env.KLARNA_REFRESH_TOKEN;

    if (!refreshToken) {
      throw new Error("KLARNA_REFRESH_TOKEN was not declared in env.");
    }

    try {
      const response = await retry(() =>
        fetch("https://app.klarna.com/fr/api/auth/refresh", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            grant_type: "refresh_token",
            refresh_token: refreshToken,
            client_id: clientId,
            redirect_uri: "https://app.klarna.com/auth/callback",
          }),
        }),
      );

      if (!response.ok) {
        throw new Error(
          `Failed to refresh access token: ${response.statusText}`,
        );
      }

      const data = (await response.json()) as TokenData;

      // Add expiration date
      if (data.expires_in) {
        data.expiresAt = Date.now() + data.expires_in * 1000;
      }

      this.tokenInfo = data;
      return data.access_token;
    } catch (error) {
      console.error("Error refreshing access token:", error);
      this.revokeToken();
      throw error;
    }
  }

  // Authenticated request
  public async request<T>(
    uri: string,
    options: RequestInit = {},
    region: Region = this.defaultRegion,
  ): Promise<T> {
    if (!options.headers) {
      options.headers = {};
    }

    // Get a valid token
    const token = await this.getToken(region);

    // Add Authorization headers
    (options.headers as Record<string, string>)["Authorization"] =
      `Bearer ${token}`;

    // Request with retry
    return retry(async () => {
      const response = await fetch(`https://app.klarna.com/${uri}`, options);

      if (!response.ok) {
        // Revoke the token if not valid anymore
        if (response.status === 401 || response.status === 403) {
          this.revokeToken();
        }
        throw new Error(
          `Klarna API error: ${response.status} ${response.statusText}`,
        );
      }

      return (await response.json()) as T;
    });
  }

  // Change the region (EU, US, AP)
  public setDefaultRegion(region: Region): void {
    this.defaultRegion = region;
  }
}

// Singleton
export const klarnaSession = new KlarnaSession();
