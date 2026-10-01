import { retry } from "@/lib/retry";
import {
  clearKlarnaRefreshToken,
  persistKlarnaRefreshToken,
  resolveKlarnaRefreshToken,
} from "@/lib/klarna-config";

/**
 * Klarna web (app.klarna.com / klapp SPA) — verified 2026-09 against loyalty BFF.
 * Native Android client_id still works for tokens sniffed from the app; override via env.
 */
export const KLARNA_WEB_CLIENT_ID = "ca89d7d6-f74e-4c4f-9fa9-a28fd13d4074";

/** @deprecated use KLARNA_CLIENT_ID — kept for env overrides from native mitm. */
export const KLARNA_NATIVE_CLIENT_ID =
  "68879600-266c-4805-a978-1916b25239d2";

export const KLARNA_CLIENT_ID =
  process.env.KLARNA_CLIENT_ID || KLARNA_WEB_CLIENT_ID;

export const KLARNA_REDIRECT_URI =
  process.env.KLARNA_REDIRECT_URI || "https://app.klarna.com/auth/callback";

export const KLARNA_API_BASE =
  process.env.KLARNA_API_BASE || "https://app-api.klarna.com";

/** Regional web client ids (US / AP) if market ever needs them. */
export const clientIds = {
  EU: KLARNA_WEB_CLIENT_ID,
  US: "639c2886-026e-452f-b5fc-096683d95b0e",
  AP: "51119b87-8f66-4ef9-973a-60f7034d0a98",
};

export type Region = keyof typeof clientIds;

interface TokenData {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  expiresAt?: number;
}

function resolveRefreshToken(): string {
  const token = resolveKlarnaRefreshToken();
  if (!token) {
    throw new Error(
      "KLARNA_REFRESH_TOKEN manquant — ouvrir Connect Klarna dans Pockett.",
    );
  }
  return token;
}

export function defaultKlarnaHeaders(
  market = "FR",
): Record<string, string> {
  return {
    Accept: "application/json",
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    "x-klarna-app-platform": "web",
    "x-klarna-app-locale": `${market.toLowerCase()}-${market}`,
    "x-klarna-app-timezone": "Europe/Paris",
    "x-klarna-client-flavor": "pink",
    "x-klarna-client-target": "app",
    "x-klarna-app-client": "klapp",
    "x-klarna-market": market,
  };
}

class KlarnaSession {
  private tokenInfo: TokenData | null = null;
  private refreshing: Promise<string> | null = null;
  /** Access tokens expire in ~300s. */
  private tokenSafetyMargin = 30 * 1000;
  private defaultRegion: Region = "EU";
  private keepaliveTimer: ReturnType<typeof setInterval> | null = null;
  private keepaliveBackoffTimer: ReturnType<typeof setTimeout> | null = null;

  private isTokenExpired(): boolean {
    if (!this.tokenInfo?.expiresAt) return true;
    return Date.now() > this.tokenInfo.expiresAt - this.tokenSafetyMargin;
  }

  public revokeToken(): void {
    // Only drop the access token. Clearing `refreshing` mid-flight would let a
    // second refresh start with the same grant → invalid_grant.
    this.tokenInfo = null;
  }

  /**
   * Force a refresh_token grant so Klarna keeps the session alive while the
   * server is up (idle access tokens alone are not enough).
   */
  public async keepalive(): Promise<{ ok: true } | { ok: false; error: string }> {
    if (!resolveKlarnaRefreshToken()) {
      return { ok: false, error: "no refresh token" };
    }
    if (this.refreshing) {
      try {
        await this.refreshing;
        return { ok: true };
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        return { ok: false, error };
      }
    }
    this.tokenInfo = null;
    return this.ensureReady();
  }

  /**
   * Periodic refresh while the Node process stays up.
   * Default every 12h — enough to exercise the refresh grant without rate limits.
   * Override with KLARNA_KEEPALIVE_MS (0 disables).
   */
  public startKeepalive(intervalMs?: number): void {
    if (this.keepaliveTimer) return;
    const raw = process.env.KLARNA_KEEPALIVE_MS;
    const ms =
      intervalMs ??
      (raw != null && raw !== "" ? Number(raw) : 12 * 60 * 60 * 1000);
    if (!Number.isFinite(ms) || ms <= 0) {
      console.log("[klarna] keepalive disabled");
      return;
    }

    const tick = async () => {
      if (!resolveKlarnaRefreshToken()) return;
      const result = await this.keepalive();
      if (result.ok) {
        console.log("[klarna] keepalive ok");
        return;
      }
      console.warn(`[klarna] keepalive failed: ${result.error}`);
      const waitMatch = result.error.match(/"wait"\s*:\s*(\d+)/);
      const waitSec = waitMatch ? Number(waitMatch[1]) : 0;
      if (waitSec > 0 && !this.keepaliveBackoffTimer) {
        this.keepaliveBackoffTimer = setTimeout(() => {
          this.keepaliveBackoffTimer = null;
          void tick();
        }, waitSec * 1000);
        this.keepaliveBackoffTimer.unref?.();
      }
    };

    this.keepaliveTimer = setInterval(() => void tick(), ms);
    this.keepaliveTimer.unref?.();
    console.log(
      `[klarna] keepalive every ${Math.round(ms / 3_600_000)}h (while process is up)`,
    );
  }

  public async getToken(_region: Region = this.defaultRegion): Promise<string> {
    if (this.tokenInfo && !this.isTokenExpired()) {
      return this.tokenInfo.access_token;
    }
    if (this.refreshing) return this.refreshing;

    this.refreshing = this.refreshAccessToken();
    try {
      return await this.refreshing;
    } finally {
      this.refreshing = null;
    }
  }

  private async refreshAccessToken(): Promise<string> {
    const refreshToken = resolveRefreshToken();
    const clientId = KLARNA_CLIENT_ID;
    const redirectUri = KLARNA_REDIRECT_URI;

    console.log("[klarna] refreshing access token…");
    // Never retry a refresh_token grant: Klarna may rotate on first use, and a
    // second attempt with the old token returns invalid_grant.
    const response = await fetch(`${KLARNA_API_BASE}/fr/api/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json;charset=utf-8",
        ...defaultKlarnaHeaders(),
      },
      body: JSON.stringify({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: clientId,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      this.revokeToken();
      if (response.status === 400 && text.includes("invalid_grant")) {
        // Stop hammering Klarna with a dead token on every status poll.
        clearKlarnaRefreshToken();
      }
      throw new Error(
        `Klarna refresh failed ${response.status}: ${text.slice(0, 200)}. ` +
          `Si invalid_grant → reconnecte Klarna depuis le menu ⋯.`,
      );
    }

    const data = (await response.json()) as TokenData;
    if (data.expires_in) {
      data.expiresAt = Date.now() + data.expires_in * 1000;
    }
    const nextRefresh = data.refresh_token || refreshToken;
    data.refresh_token = nextRefresh;

    this.tokenInfo = data;
    // Always rewrite the file: rotation + mtime proof of last successful grant.
    persistKlarnaRefreshToken(nextRefresh);
    if (nextRefresh !== refreshToken) {
      console.log("[klarna] refresh_token rotated → persisted /config");
    }
    console.log("[klarna] access token ok");
    return data.access_token;
  }

  /** Warm auth at server boot — fails fast with a clear message. */
  public async ensureReady(): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
      await this.getToken();
      return { ok: true };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      return { ok: false, error };
    }
  }

  public async request<T>(
    uri: string,
    options: RequestInit = {},
    region: Region = this.defaultRegion,
    market = "FR",
  ): Promise<T> {
    const path = uri.startsWith("/") ? uri : `/${uri}`;

    // At most one retry after a 401/403 (fresh access token). More would
    // burn refresh grants on a permanent API error.
    return retry(async () => {
      // Resolve the token inside the retry so a 401 can refresh then retry once.
      const token = await this.getToken(region);
      const headers: Record<string, string> = {
        ...defaultKlarnaHeaders(market),
        ...(options.headers as Record<string, string> | undefined),
        Authorization: `Bearer ${token}`,
      };

      const response = await fetch(`${KLARNA_API_BASE}${path}`, {
        ...options,
        headers,
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          this.revokeToken();
        }
        const text = await response.text();
        throw new Error(
          `Klarna API ${response.status} ${path}: ${text.slice(0, 200)}`,
        );
      }

      if (response.status === 204) {
        return undefined as T;
      }
      return (await response.json()) as T;
    }, 2);
  }

  public setDefaultRegion(region: Region): void {
    this.defaultRegion = region;
  }
}

export const klarnaSession = new KlarnaSession();
