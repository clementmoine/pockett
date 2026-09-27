/**
 * A linked account can upgrade catalog cards without changing their QR.
 * Card UI only sees provider ids; each service owns its runner.
 * Server-only.
 */

import { CONNECTION_SERVICES, type ConnectionServiceId } from "@/lib/connections";
import {
  beginLidlBrowserLogin,
  clearLidlAccount,
  finishLidlBrowserLogin,
  hasLidlAccount,
  pollLidlBrowserLogin,
  refreshLinkedLidlAccount,
} from "@/lib/lidl-auth";

type ConnectionAuth = {
  linked: () => boolean;
  disconnect: () => void;
  begin: (country?: string) => Promise<{ nonce: string; loginUrl: string }>;
  finish: (nonce: string, code: string) => Promise<void>;
  poll: (
    nonce: string,
  ) =>
    | { status: "pending" }
    | { status: "ready" }
    | { status: "error"; error: string }
    | { status: "missing" };
  /** Side effect when a card of an enhanced provider is shown. */
  onShow: () => Promise<{ note?: string }>;
};

const AUTH: Partial<Record<ConnectionServiceId, ConnectionAuth>> = {
  lidl: {
    linked: () => hasLidlAccount(),
    disconnect: () => clearLidlAccount(),
    begin: (country) => beginLidlBrowserLogin(country),
    finish: (nonce, code) => finishLidlBrowserLogin(nonce, code),
    poll: (nonce) => pollLidlBrowserLogin(nonce),
    onShow: () => refreshLinkedLidlAccount(),
  },
};

export function connectionAuth(
  id: string | null | undefined,
): ConnectionAuth | undefined {
  if (!id) return undefined;
  return AUTH[id as ConnectionServiceId];
}

/** Catalog provider ids whose cards currently run an on-show upgrade. */
export function enhancedProviderIds(): string[] {
  const ids: string[] = [];
  for (const service of CONNECTION_SERVICES) {
    const auth = AUTH[service.id];
    if (!service.enhances?.length || !auth?.linked()) continue;
    ids.push(...service.enhances);
  }
  return ids;
}

export async function runProviderEnhancement(
  providerId: string | null | undefined,
): Promise<{ note?: string }> {
  if (!providerId) return {};
  const service = CONNECTION_SERVICES.find((row) =>
    row.enhances?.includes(providerId),
  );
  if (!service) return {};
  const auth = AUTH[service.id];
  if (!auth?.linked()) return {};
  return auth.onShow();
}
