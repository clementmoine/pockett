/**
 * Lidl Plus OAuth (PKCE) used by the browser connector.
 * The password form lives on accounts.lidl.com — this module only builds
 * the authorize URL and exchanges the code the extension captures.
 * Server-only.
 */

import { createHash, randomBytes } from "node:crypto";

const AUTH = "https://accounts.lidl.com";
const CLIENT_ID = "LidlPlusNativeClient";
const REDIRECT = "com.lidlplus.app://callback";

export type LidlTokens = { refreshToken: string; accessToken: string };

function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

async function authorizationUrl(
  country: string,
  language: string,
  verifier: string,
): Promise<string> {
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  let endpoint = `${AUTH}/connect/authorize`;
  try {
    const res = await fetch(`${AUTH}/.well-known/openid-configuration`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) {
      const cfg = (await res.json()) as { authorization_endpoint?: string };
      if (cfg.authorization_endpoint) endpoint = cfg.authorization_endpoint;
    }
  } catch {
    /* well-known fallback */
  }
  const q = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    scope: "openid profile offline_access lpprofile lpapis",
    redirect_uri: REDIRECT,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state: randomToken(16),
    nonce: randomToken(16),
    Country: country,
    language: `${language}-${country}`,
  });
  return `${endpoint}?${q.toString()}`;
}

/** PKCE authorize URL opened in the user's browser. Verifier stays on the server. */
export async function createLidlPkceLogin(
  country: string,
  language: string,
): Promise<{ url: string; verifier: string }> {
  const verifier = randomToken(64);
  const url = await authorizationUrl(country, language, verifier);
  return { url, verifier };
}

async function tokenRequest(body: URLSearchParams): Promise<LidlTokens> {
  const basic = Buffer.from(`${CLIENT_ID}:secret`).toString("base64");
  const res = await fetch(`${AUTH}/connect/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json().catch(() => null)) as {
    access_token?: string;
    refresh_token?: string;
    error_description?: string;
  } | null;
  if (!res.ok || !data?.access_token || !data.refresh_token) {
    throw new Error(
      data?.error_description || `Login Lidl refusé (${res.status})`,
    );
  }
  return { accessToken: data.access_token, refreshToken: data.refresh_token };
}

export async function exchangeLidlAuthCode(
  code: string,
  verifier: string,
): Promise<LidlTokens> {
  return tokenRequest(
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT,
      code_verifier: verifier,
    }),
  );
}

export async function refreshLidlTokens(
  refreshToken: string,
): Promise<LidlTokens> {
  const basic = Buffer.from(`${CLIENT_ID}:secret`).toString("base64");
  const res = await fetch(`${AUTH}/connect/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json().catch(() => null)) as {
    access_token?: string;
    refresh_token?: string;
    error_description?: string;
  } | null;
  if (!res.ok || !data?.access_token) {
    throw new Error(
      data?.error_description || "Session Lidl expirée — reconnecte le compte",
    );
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
  };
}
