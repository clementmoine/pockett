/**
 * Grand Frais BFF — login bootstrap + live QR fetch (no local CC generation).
 */

import { isGrandFraisQr, parseGrandFraisQr } from "@/lib/grand-frais-qr";
import {
  formatGrandFraisSession,
  parseGrandFraisSession,
  type GrandFraisSession,
} from "@/lib/grand-frais-session";
import {
  memberIdFromQr,
  normalizeMemberId,
  parseGrandFraisCredential,
} from "@/lib/grand-frais-qr-build";

const BFF = "https://bff.grandfrais.com";
const UA = "Dart/3.0 (dart:io)";

export type GrandFraisBootstrapResult = {
  credential: string;
  memberId: string;
  sampleQr: string;
};

async function bffJson<T>(
  path: string,
  init: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, headers: extra, ...rest } = init;
  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": UA,
    ...(extra as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (rest.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(`${BFF}${path}`, { ...rest, headers });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { message: text };
  }
  if (!res.ok) {
    const msg =
      (data as { message?: string | string[] } | null)?.message ??
      res.statusText;
    const detail = Array.isArray(msg) ? msg.join(", ") : String(msg);
    const err = new Error(detail || `BFF ${res.status}`) as Error & {
      status?: number;
    };
    err.status = res.status;
    throw err;
  }
  return data as T;
}

type LoginResponse = {
  token?: string;
  accessToken?: string;
  refreshToken?: string;
};

type CustomerResponse = {
  shopCode?: string | number;
};

type QrResponse = {
  enhancedQrCode?: string;
  simplifiedQrCode?: string;
};

async function refreshSession(
  session: GrandFraisSession,
): Promise<GrandFraisSession> {
  const body = await bffJson<LoginResponse>("/v1/users/token/refresh", {
    method: "POST",
    body: JSON.stringify({
      token: session.token,
      refreshToken: session.refreshToken,
    }),
  });
  const token = body.token || body.accessToken;
  if (!token) throw new Error("Refresh OK mais token manquant");
  return {
    ...session,
    token,
    refreshToken: body.refreshToken || session.refreshToken,
  };
}

async function fetchQr(session: GrandFraisSession): Promise<string> {
  const qrPayload = await bffJson<QrResponse>(
    `/v1/customer/qrcode?comarchShopId=${encodeURIComponent(session.shopCode)}`,
    { token: session.token },
  );
  const live = qrPayload.enhancedQrCode || qrPayload.simplifiedQrCode || null;
  if (!live || !isGrandFraisQr(live)) {
    throw new Error("QR Grand Frais introuvable");
  }
  return live;
}

/** Login once → session credential + sample QR from BFF. */
export async function bootstrapGrandFraisCredential(input: {
  email: string;
  password: string;
}): Promise<GrandFraisBootstrapResult> {
  const email = input.email.trim();
  const password = input.password;
  if (!email || !password) {
    throw new Error("Email et mot de passe requis");
  }

  const login = await bffJson<LoginResponse>("/v1/users/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  const token = login.token || login.accessToken;
  const refreshToken = login.refreshToken;
  if (!token || !refreshToken) {
    throw new Error("Login OK mais tokens manquants");
  }

  const customer = await bffJson<CustomerResponse>("/v1/customer", { token });
  const shop =
    customer.shopCode != null && String(customer.shopCode).trim() !== ""
      ? String(customer.shopCode).replace(/\D/g, "")
      : "261";

  let session: GrandFraisSession = {
    memberId: "0000000000",
    shopCode: shop,
    token,
    refreshToken,
  };

  const live = await fetchQr(session);
  const memberId =
    memberIdFromQr(live) ||
    parseGrandFraisQr(live)?.memberId ||
    normalizeMemberId(live.slice(5, 15));
  if (!memberId) throw new Error("memberId introuvable dans le QR");

  session = { ...session, memberId, lastQr: live };
  return {
    credential: formatGrandFraisSession(session),
    memberId,
    sampleQr: live,
  };
}

/**
 * Fresh QR from BFF. Refreshes access token when needed.
 * Returns updated credential if tokens rotated.
 */
export async function fetchGrandFraisLiveQr(stored: string): Promise<{
  qr: string;
  credential: string;
  memberId: string;
}> {
  let session = parseGrandFraisSession(stored);
  if (!session) {
    if (parseGrandFraisCredential(stored) || isGrandFraisQr(stored)) {
      throw new Error(
        "Ancienne carte Grand Frais — reconnecte-toi (email + mot de passe)",
      );
    }
    throw new Error("Session Grand Frais invalide — ré-enregistre la carte");
  }

  const withQr = (qr: string, sess: NonNullable<typeof session>) => ({
    qr,
    credential: formatGrandFraisSession({ ...sess, lastQr: qr }),
    memberId: sess.memberId,
  });

  try {
    const qr = await fetchQr(session);
    return withQr(qr, session);
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status !== 401 && status !== 403) throw err;
  }

  const refreshed = await refreshSession(session);
  const qr = await fetchQr(refreshed);
  return withQr(qr, refreshed);
}
