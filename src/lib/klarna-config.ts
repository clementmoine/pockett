import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

/**
 * Klarna local state: refresh token + one-shot bridge nonce.
 * Prefer /config (Docker volume); falls back to cwd.
 */

const BRIDGE_TTL_MS = 15 * 60 * 1000;

export function configDir(): string {
  if (process.env.POCKETT_CONFIG_DIR) return process.env.POCKETT_CONFIG_DIR;
  if (fs.existsSync("/config")) return "/config";
  return process.cwd();
}

export function klarnaTokenPath(): string {
  return path.join(configDir(), "klarna-refresh-token");
}

function bridgePath(): string {
  return path.join(configDir(), "klarna-bridge-pending.json");
}

export function resolveKlarnaRefreshToken(): string | null {
  try {
    const fromFile = fs.readFileSync(klarnaTokenPath(), "utf8").trim();
    if (fromFile) {
      process.env.KLARNA_REFRESH_TOKEN = fromFile;
      return fromFile;
    }
  } catch {
    /* absent */
  }
  return process.env.KLARNA_REFRESH_TOKEN?.trim() || null;
}

export function hasKlarnaRefreshToken(): boolean {
  return Boolean(resolveKlarnaRefreshToken());
}

export function persistKlarnaRefreshToken(refreshToken: string): void {
  const token = refreshToken.trim();
  if (!token) throw new Error("refresh token vide");
  fs.mkdirSync(configDir(), { recursive: true });
  fs.writeFileSync(klarnaTokenPath(), `${token}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  process.env.KLARNA_REFRESH_TOKEN = token;
}

export function clearKlarnaRefreshToken(): void {
  try {
    fs.unlinkSync(klarnaTokenPath());
  } catch {
    /* absent */
  }
  delete process.env.KLARNA_REFRESH_TOKEN;
}

type BridgePending = {
  nonce: string;
  createdAt: number;
  expiresAt: number;
};

function readPending(): BridgePending | null {
  try {
    const data = JSON.parse(
      fs.readFileSync(bridgePath(), "utf8"),
    ) as BridgePending;
    if (!data?.nonce || !data.expiresAt) return null;
    if (Date.now() > data.expiresAt) {
      clearPending();
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function clearPending(): void {
  try {
    fs.unlinkSync(bridgePath());
  } catch {
    /* absent */
  }
}

export function createBridgeSession(): BridgePending {
  const now = Date.now();
  const data: BridgePending = {
    nonce: crypto.randomBytes(24).toString("base64url"),
    createdAt: now,
    expiresAt: now + BRIDGE_TTL_MS,
  };
  fs.mkdirSync(configDir(), { recursive: true });
  fs.writeFileSync(bridgePath(), JSON.stringify(data), {
    encoding: "utf8",
    mode: 0o600,
  });
  return data;
}

export function consumeBridgeNonce(nonce: string | undefined | null): boolean {
  if (!nonce) return false;
  const pending = readPending();
  if (!pending || pending.nonce !== nonce) return false;
  clearPending();
  return true;
}

export function klarnaLoginUrl(nonce: string): string {
  return `https://app.klarna.com/login#pockett=${encodeURIComponent(nonce)}`;
}
