/**
 * Grand Frais / Comarch loyalty QR (`PRGF…`, 84 chars).
 *
 * Layout (confirmed against app + BFF samples):
 *   [0:4]   "PRGF"          brand
 *   [4:5]   "1"             version
 *   [5:15]  memberId        10 digits — shown under the QR in the official app
 *   [15:16] "1"             separator (constant in samples)
 *   [16:26] YYMMDDHHMM      timestamp (rotates every minute)
 *   [26:31] flag            "10001" = enhanced, "00000" = simplified
 *   [31:82] zeros           padding
 *   [82:84] check           2 digits — see grandFraisCheckDigits (customerId prefix + HH/MI)
 *
 * Note: enhanced CC = simplified CC + 2 (digitSum of flag "10001").
 */

export const GRAND_FRAIS_QR_LENGTH = 84;
export const GRAND_FRAIS_QR_PREFIX = "PRGF";

export type GrandFraisQrParts = {
  raw: string;
  version: string;
  memberId: string;
  separator: string;
  /** YYMMDDHHMM */
  timestamp: string;
  flag: string;
  enhanced: boolean;
  check: string;
};

export function isGrandFraisQr(code: string | null | undefined): boolean {
  const c = (code || "").trim();
  return c.length === GRAND_FRAIS_QR_LENGTH && c.startsWith(GRAND_FRAIS_QR_PREFIX);
}

export function parseGrandFraisQr(
  code: string | null | undefined,
): GrandFraisQrParts | null {
  const raw = (code || "").trim();
  if (!isGrandFraisQr(raw)) return null;
  const flag = raw.slice(26, 31);
  return {
    raw,
    version: raw.slice(4, 5),
    memberId: raw.slice(5, 15),
    separator: raw.slice(15, 16),
    timestamp: raw.slice(16, 26),
    flag,
    enhanced: flag === "10001",
    check: raw.slice(82, 84),
  };
}

/** Human-readable instant from YYMMDDHHMM (local wall clock, no TZ in payload). */
export function grandFraisQrTimestampLabel(ts: string): string | null {
  if (!/^\d{10}$/.test(ts)) return null;
  const yy = Number(ts.slice(0, 2));
  const mm = Number(ts.slice(2, 4));
  const dd = Number(ts.slice(4, 6));
  const hh = Number(ts.slice(6, 8));
  const mi = Number(ts.slice(8, 10));
  return `20${String(yy).padStart(2, "0")}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")} ${String(hh).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
}
