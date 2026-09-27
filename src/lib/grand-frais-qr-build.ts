/**
 * Offline PRGF builder + card credential.
 *
 * Credential stored on the card (`code` field):
 *   `GF|<memberId10>|<prefix2>`
 * e.g. `GF|1267824163|24`
 *
 * Checksum (simplified):
 *   C  = (-8 * HH + prefix) mod 100
 *   CC = (2 * (MI % 5) + floor((MI + 5) / 10) + C) mod 100
 * `prefix` = first 2 digits of Comarch `customerId` (per member, not enseigne-wide:
 * samples 2405071 → 24, and another account → 36).
 * Enhanced: CC + 2.
 *
 * Bootstrap: live `PRGF…` (infers prefix) or `memberId customerId`.
 */

import {
  GRAND_FRAIS_QR_LENGTH,
  GRAND_FRAIS_QR_PREFIX,
  type GrandFraisQrParts,
  isGrandFraisQr,
  parseGrandFraisQr,
} from "@/lib/grand-frais-qr";

export type GrandFraisCredential = {
  memberId: string;
  /** 0–99 checksum seed (customerId first 2 digits). */
  customerPrefix: number;
};

export type BuildQrInput = {
  memberId: string;
  customerId?: string | number;
  customerPrefix?: number;
  at?: Date;
  enhanced?: boolean;
};

const CRED_RE = /^GF\|(\d{10})\|(\d{1,2})$/i;

/** @deprecated Not enseigne-wide — kept only as historical sample (account #1). */
export const GRAND_FRAIS_DEFAULT_CUSTOMER_PREFIX = 24;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Local YYMMDDHHMM — same clock basis as the official app samples. */
export function formatGrandFraisTimestamp(at: Date = new Date()): string {
  const yy = at.getFullYear() % 100;
  return (
    pad2(yy) +
    pad2(at.getMonth() + 1) +
    pad2(at.getDate()) +
    pad2(at.getHours()) +
    pad2(at.getMinutes())
  );
}

export function normalizeMemberId(memberId: string): string | null {
  const digits = memberId.replace(/\D/g, "");
  if (digits.length !== 10) return null;
  return digits;
}

export function customerIdPrefix(
  customerId: string | number | null | undefined,
): number | null {
  const digits = String(customerId ?? "").replace(/\D/g, "");
  if (digits.length < 2) return null;
  return Number(digits.slice(0, 2));
}

export function formatGrandFraisCredential(
  cred: GrandFraisCredential,
): string {
  return `GF|${cred.memberId}|${pad2(cred.customerPrefix % 100)}`;
}

export function parseGrandFraisCredential(
  raw: string | null | undefined,
): GrandFraisCredential | null {
  const s = (raw || "").trim();
  const m = CRED_RE.exec(s);
  if (!m) return null;
  return { memberId: m[1], customerPrefix: Number(m[2]) % 100 };
}

/**
 * Recover checksum prefix from a live PRGF sample.
 * `prefix = (CC_simplified + 8*HH - 2*(MI%5) - floor((MI+5)/10)) mod 100`
 */
export function inferCustomerPrefixFromQr(code: string): number | null {
  const parts = parseGrandFraisQr(code);
  if (!parts) return null;
  const hh = Number(parts.timestamp.slice(6, 8));
  const mi = Number(parts.timestamp.slice(8, 10));
  let cc = Number(parts.check);
  if (parts.enhanced) cc = (cc - 2 + 100) % 100;
  const prefix =
    (((cc - 2 * (mi % 5) - Math.floor((mi + 5) / 10) + 8 * hh) % 100) + 100) %
    100;
  return prefix;
}

export type NormalizeGrandFraisOptions = {
  /**
   * Existing card credential. If the user re-saves the same member id,
   * keep its prefix (avoids resetting a scanned non-default prefix to 24).
   */
  preferCredential?: string | null;
};

/**
 * Normalize user input into a stored credential:
 * - `GF|member|prefix`
 * - live `PRGF…` (infers prefix)
 * - `memberId|customerId` or `memberId customerId`
 * - 10-digit member alone only if `preferCredential` has the same member
 */
export function normalizeGrandFraisCardCode(
  raw: string,
  opts?: NormalizeGrandFraisOptions,
): { credential: string; memberId: string } | { error: string } {
  const s = raw.trim();
  if (!s) return { error: "Identifiant requis" };

  const existing = parseGrandFraisCredential(s);
  if (existing) {
    return {
      credential: formatGrandFraisCredential(existing),
      memberId: existing.memberId,
    };
  }

  if (isGrandFraisQr(s)) {
    const parts = parseGrandFraisQr(s)!;
    const prefix = inferCustomerPrefixFromQr(s);
    if (prefix == null) return { error: "Impossible d’extraire le checksum" };
    const cred = {
      memberId: parts.memberId,
      customerPrefix: prefix,
    };
    return {
      credential: formatGrandFraisCredential(cred),
      memberId: cred.memberId,
    };
  }

  // memberId + customerId separated by | , space, or newline
  const chunks = s.split(/[\s|,;]+/).filter(Boolean);
  if (chunks.length >= 2) {
    const member = normalizeMemberId(chunks[0]);
    const prefix = customerIdPrefix(chunks[1]);
    if (member && prefix != null) {
      const cred = { memberId: member, customerPrefix: prefix };
      return {
        credential: formatGrandFraisCredential(cred),
        memberId: member,
      };
    }
  }

  const onlyMember = normalizeMemberId(s);
  if (onlyMember) {
    const preferred = parseGrandFraisCredential(opts?.preferCredential);
    if (preferred && preferred.memberId === onlyMember) {
      return {
        credential: formatGrandFraisCredential(preferred),
        memberId: onlyMember,
      };
    }
    return {
      error:
        "Colle un QR Grand Frais (PRGF…) ou saisis n° membre + ID client",
    };
  }

  return {
    error:
      "Colle un QR Grand Frais (PRGF…) ou saisis n° membre + ID client",
  };
}

export function grandFraisCheckDigits(
  hh: number,
  mi: number,
  customerPrefix: number,
  enhanced = false,
): string {
  const C = (((-8 * hh + customerPrefix) % 100) + 100) % 100;
  let cc = (2 * (mi % 5) + Math.floor((mi + 5) / 10) + C) % 100;
  if (enhanced) cc = (cc + 2) % 100;
  return pad2(cc);
}

export function grandFraisCheckDigitsFromTimestamp(
  ts: string,
  customerPrefix: number,
  enhanced = false,
): string | null {
  if (!/^\d{10}$/.test(ts)) return null;
  const hh = Number(ts.slice(6, 8));
  const mi = Number(ts.slice(8, 10));
  return grandFraisCheckDigits(hh, mi, customerPrefix, enhanced);
}

export function buildGrandFraisQrBody(input: BuildQrInput): string | null {
  const member = normalizeMemberId(input.memberId);
  if (!member) return null;
  const ts = formatGrandFraisTimestamp(input.at);
  const flag = input.enhanced === false ? "00000" : "10001";
  const body =
    GRAND_FRAIS_QR_PREFIX +
    "1" +
    member +
    "1" +
    ts +
    flag +
    "0".repeat(51);
  if (body.length !== 82) return null;
  return body;
}

function resolvePrefix(input: BuildQrInput): number | null {
  if (
    typeof input.customerPrefix === "number" &&
    Number.isFinite(input.customerPrefix)
  ) {
    return ((input.customerPrefix % 100) + 100) % 100;
  }
  return customerIdPrefix(input.customerId);
}

export function buildGrandFraisQr(
  input: BuildQrInput & { checkDigits?: string },
): { qr: string; complete: boolean; parts: GrandFraisQrParts | null } | null {
  const body = buildGrandFraisQrBody(input);
  if (!body) return null;

  let cc = input.checkDigits?.replace(/\D/g, "");
  if (!cc || cc.length !== 2) {
    const prefix = resolvePrefix(input);
    const ts = body.slice(16, 26);
    const enhanced = input.enhanced !== false;
    cc =
      prefix != null
        ? (grandFraisCheckDigitsFromTimestamp(ts, prefix, enhanced) ??
          undefined)
        : undefined;
  }

  const complete = Boolean(cc && cc.length === 2);
  const qr = complete ? body + cc : body + "00";
  if (qr.length !== GRAND_FRAIS_QR_LENGTH) return null;
  return {
    qr,
    complete,
    parts: parseGrandFraisQr(complete ? qr : null),
  };
}

/** Build a live enhanced QR from a stored credential (or legacy PRGF / GF|…). */
export function liveGrandFraisQrFromCardCode(
  cardCode: string,
  at: Date = new Date(),
): string | null {
  let cred = parseGrandFraisCredential(cardCode);
  if (!cred && isGrandFraisQr(cardCode)) {
    const parts = parseGrandFraisQr(cardCode);
    const prefix = inferCustomerPrefixFromQr(cardCode);
    if (parts && prefix != null) {
      cred = { memberId: parts.memberId, customerPrefix: prefix };
    }
  }
  if (!cred) return null;
  const built = buildGrandFraisQr({
    memberId: cred.memberId,
    customerPrefix: cred.customerPrefix,
    at,
    enhanced: true,
  });
  return built?.complete ? built.qr : null;
}

export function memberIdFromQr(code: string): string | null {
  return parseGrandFraisQr(code)?.memberId ?? null;
}

export function memberIdFromCardCode(cardCode: string): string | null {
  return (
    parseGrandFraisCredential(cardCode)?.memberId ||
    memberIdFromQr(cardCode) ||
    normalizeMemberId(cardCode)
  );
}
