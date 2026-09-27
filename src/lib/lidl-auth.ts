/**
 * Linked Lidl account: refresh token + coupon activation.
 * The card QR stays the Klarna code. This only runs when the account is linked.
 * Server-only.
 */

import fs from "node:fs";
import { randomBytes } from "node:crypto";

import { configDir } from "@/lib/klarna-config";
import {
  createLidlPkceLogin,
  exchangeLidlAuthCode,
  refreshLidlTokens,
} from "@/lib/lidl-login";

const APP_VERSION = "16.43.4";
const APP_ID = "com.lidl.eci.lidlplus";

const LANGUAGE_BY_COUNTRY: Record<string, string> = {
  FR: "fr",
  BE: "fr",
  LU: "fr",
  CH: "de",
  DE: "de",
  AT: "de",
  NL: "nl",
  ES: "es",
  IT: "it",
  PT: "pt",
  PL: "pl",
  CZ: "cs",
  SK: "sk",
  HU: "hu",
  SI: "sl",
  HR: "hr",
  RO: "ro",
};

function lidlLanguage(country: string): string {
  return LANGUAGE_BY_COUNTRY[country.toUpperCase()] || "en";
}

type Promotion = {
  id?: string;
  isActivated?: boolean;
  validity?: { start?: string | null; end?: string | null };
};

type PromotionList = {
  sections?: Array<{ promotions?: Promotion[] }>;
};

function apiHeaders(
  accessToken: string,
  country: string,
  language: string,
  extra?: Record<string, string>,
): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    "App-Version": APP_VERSION,
    "Operating-System": "Android",
    App: APP_ID,
    "Accept-Language": language,
    "User-Agent": "okhttp/5.4.0",
    Country: country,
    Accept: "application/json",
    ...extra,
  };
}

function inWindow(promo: Promotion, now: number): boolean {
  if (!promo.id) return false;
  const start = promo.validity?.start ? Date.parse(promo.validity.start) : NaN;
  const end = promo.validity?.end ? Date.parse(promo.validity.end) : NaN;
  if (!Number.isNaN(start) && start > now) return false;
  if (!Number.isNaN(end) && end < now) return false;
  return true;
}

function isAvailable(promo: Promotion, now: number): boolean {
  return inWindow(promo, now) && !promo.isActivated;
}

function couponNote(count: number): string {
  if (count <= 0) return "Aucun coupon activé";
  if (count === 1) return "1 coupon activé";
  return `${count} coupons activés`;
}

async function loadSegments(
  accessToken: string,
  country: string,
  language: string,
): Promise<string> {
  try {
    const res = await fetch(
      `https://segments.lidlplus.com/api/v1/usersegments/${country}`,
      {
        headers: apiHeaders(accessToken, country, language),
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!res.ok) return "";
    const data = (await res.json()) as unknown;
    if (!Array.isArray(data)) return "";
    return data.map((id) => String(id)).filter(Boolean).join(",");
  } catch {
    return "";
  }
}

async function loadPromotions(
  accessToken: string,
  country: string,
  language: string,
): Promise<Promotion[]> {
  const segments = await loadSegments(accessToken, country, language);
  const extra: Record<string, string> = {};
  if (segments) extra["Segment-ids"] = segments;

  const headers = apiHeaders(accessToken, country, language, extra);
  let res = await fetch(
    "https://coupons.lidlplus.com/app/api/v2/promotionslist",
    { headers, signal: AbortSignal.timeout(15_000) },
  );
  if (!res.ok) {
    res = await fetch("https://coupons.lidlplus.com/app/api/v4/promotionslist", {
      headers: { ...headers, "store-id": "" },
      signal: AbortSignal.timeout(15_000),
    });
  }
  if (!res.ok) {
    throw new Error(`Liste des promos Lidl indisponible (${res.status})`);
  }
  const body = (await res.json()) as PromotionList;
  const out: Promotion[] = [];
  for (const section of body.sections || []) {
    for (const promo of section.promotions || []) out.push(promo);
  }
  return out;
}

async function activateOne(
  accessToken: string,
  country: string,
  language: string,
  id: string,
): Promise<boolean> {
  const headers = apiHeaders(accessToken, country, language);
  const v1 = await fetch(
    `https://coupons.lidlplus.com/app/api/v1/promotions/${encodeURIComponent(id)}/activation`,
    { method: "POST", headers, signal: AbortSignal.timeout(15_000) },
  );
  if (v1.ok) return true;
  const v2 = await fetch(
    `https://coupons.lidlplus.com/app/api/v2/promotions/${encodeURIComponent(id)}/activation`,
    {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ articleSelection: [] }),
      signal: AbortSignal.timeout(15_000),
    },
  );
  return v2.ok;
}

/** Activate every coupon that is currently valid and not already on. */
async function activateLidlPromos(
  accessToken: string,
  country: string,
  language: string,
): Promise<{ activated: number; active: number; skipped: number }> {
  const promos = await loadPromotions(accessToken, country, language);
  const now = Date.now();
  const todo = promos.filter((p) => isAvailable(p, now));
  let activated = 0;
  for (const promo of todo) {
    if (!promo.id) continue;
    try {
      if (await activateOne(accessToken, country, language, promo.id)) {
        activated++;
      }
    } catch (err) {
      console.warn("[lidl] activation", promo.id, err);
    }
  }
  const already = promos.filter(
    (promo) => promo.isActivated && inWindow(promo, now),
  ).length;
  return {
    activated,
    active: already + activated,
    skipped: promos.length - todo.length,
  };
}

type LidlAccount = { country: string; refreshToken: string };

function lidlAccountPath(): string {
  return `${configDir()}/lidl-account`;
}

function readLidlAccount(): LidlAccount | null {
  try {
    const data = JSON.parse(fs.readFileSync(lidlAccountPath(), "utf8")) as LidlAccount;
    if (!data?.refreshToken || !data.country) return null;
    return { country: data.country.toUpperCase(), refreshToken: data.refreshToken };
  } catch {
    return null;
  }
}

export function hasLidlAccount(): boolean {
  return Boolean(readLidlAccount());
}

function writeLidlAccount(account: LidlAccount): void {
  fs.mkdirSync(configDir(), { recursive: true });
  fs.writeFileSync(lidlAccountPath(), JSON.stringify(account), {
    encoding: "utf8",
    mode: 0o600,
  });
}

export function clearLidlAccount(): void {
  try {
    fs.unlinkSync(lidlAccountPath());
  } catch {
    /* absent */
  }
}

/** Refresh the linked account and turn on current coupons. No-op if unlinked. */
export async function refreshLinkedLidlAccount(): Promise<{ note?: string }> {
  const account = readLidlAccount();
  if (!account) return {};
  const tokens = await refreshLidlTokens(account.refreshToken);
  const language = lidlLanguage(account.country);
  let note: string | undefined;
  try {
    const stats = await activateLidlPromos(
      tokens.accessToken,
      account.country,
      language,
    );
    note = couponNote(stats.active);
    console.info(
      `[lidl] ${stats.activated} promo(s) activée(s) (${account.country})`,
    );
  } catch (err) {
    console.warn("[lidl] activation", err);
  }
  if (tokens.refreshToken !== account.refreshToken) {
    writeLidlAccount({ ...account, refreshToken: tokens.refreshToken });
  }
  return note ? { note } : {};
}

const EXT_TTL_MS = 15 * 60 * 1000;

type ExtPending = {
  verifier: string;
  country: string;
  language: string;
  expires: number;
  inflight?: Promise<void>;
  done?: boolean;
  error?: string;
};

const extPending = new Map<string, ExtPending>();

function sweepExt() {
  const now = Date.now();
  for (const [id, row] of extPending) {
    if (row.expires <= now) extPending.delete(id);
  }
}

export async function beginLidlBrowserLogin(countryInput?: string): Promise<{
  nonce: string;
  loginUrl: string;
}> {
  sweepExt();
  const country = String(countryInput || "FR").toUpperCase();
  const language = lidlLanguage(country);
  const { url, verifier } = await createLidlPkceLogin(country, language);
  const nonce = randomBytes(18).toString("base64url");
  extPending.set(nonce, {
    verifier,
    country,
    language,
    expires: Date.now() + EXT_TTL_MS,
  });
  return { nonce, loginUrl: url };
}

export async function finishLidlBrowserLogin(
  nonce: string,
  code: string,
): Promise<void> {
  sweepExt();
  const row = extPending.get(nonce);
  if (!row || row.expires <= Date.now()) {
    throw new Error("Connexion Lidl expirée — relance-la");
  }
  if (row.done) return;
  if (row.inflight) return row.inflight;
  const authCode = code.trim();
  if (!authCode) throw new Error("Code Lidl manquant");
  row.inflight = (async () => {
    try {
      const tokens = await exchangeLidlAuthCode(authCode, row.verifier);
      writeLidlAccount({
        country: row.country,
        refreshToken: tokens.refreshToken,
      });
      row.done = true;
      await refreshLinkedLidlAccount();
    } catch (err) {
      row.error = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      row.inflight = undefined;
    }
  })();
  return row.inflight;
}

export function pollLidlBrowserLogin(nonce: string):
  | { status: "pending" }
  | { status: "ready" }
  | { status: "error"; error: string }
  | { status: "missing" } {
  sweepExt();
  const row = extPending.get(nonce);
  if (!row) return { status: "missing" };
  if (row.done) return { status: "ready" };
  if (row.error) return { status: "error", error: row.error };
  return { status: "pending" };
}
