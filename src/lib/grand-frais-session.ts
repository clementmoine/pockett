/**
 * Grand Frais stored session credential — safe for client + server.
 *   `GFR|<memberId10>|<shopCode>|<accessToken>|<refreshToken>[|<lastPrgf>]`
 */

import { isGrandFraisQr } from "@/lib/grand-frais-qr";
import {
  memberIdFromQr,
  normalizeMemberId,
  parseGrandFraisCredential,
} from "@/lib/grand-frais-qr-build";

export type GrandFraisSession = {
  memberId: string;
  shopCode: string;
  token: string;
  refreshToken: string;
  /** Last successful PRGF from BFF — shown instantly while refreshing. */
  lastQr?: string;
};

export function formatGrandFraisSession(session: GrandFraisSession): string {
  const base = `GFR|${session.memberId}|${session.shopCode}|${session.token}|${session.refreshToken}`;
  if (session.lastQr && isGrandFraisQr(session.lastQr)) {
    return `${base}|${session.lastQr}`;
  }
  return base;
}

export function parseGrandFraisSession(
  raw: string | null | undefined,
): GrandFraisSession | null {
  const s = (raw || "").trim();
  if (!s.startsWith("GFR|")) return null;
  const parts = s.split("|");
  // 5 = no cache, 6 = with last PRGF
  if (parts.length !== 5 && parts.length !== 6) return null;
  const [, memberId, shopCode, token, refreshToken, lastQr] = parts;
  if (!/^\d{10}$/.test(memberId)) return null;
  if (!shopCode || !token || !refreshToken) return null;
  if (lastQr && !isGrandFraisQr(lastQr)) return null;
  return {
    memberId,
    shopCode,
    token,
    refreshToken,
    lastQr: lastQr || undefined,
  };
}

export function memberIdFromGrandFraisStored(
  stored: string | null | undefined,
): string | null {
  return (
    parseGrandFraisSession(stored)?.memberId ||
    parseGrandFraisCredential(stored)?.memberId ||
    memberIdFromQr(stored || "") ||
    normalizeMemberId(stored || "")
  );
}

/** Instant display payload: cached PRGF, or raw PRGF if stored alone. */
export function readyGrandFraisPayload(
  stored: string | null | undefined,
): string | null {
  if (!stored) return null;
  if (isGrandFraisQr(stored)) return stored;
  const session = parseGrandFraisSession(stored);
  if (session?.lastQr && isGrandFraisQr(session.lastQr)) {
    return session.lastQr;
  }
  return null;
}
