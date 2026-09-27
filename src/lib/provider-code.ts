/**
 * Per-provider code behaviour (normalize / caption / bootstrap / remote).
 * UI and core call this registry — never branch on a specific enseigne.
 */

import { GRAND_FRAIS_PROVIDER_ID } from "@/lib/custom-provider-ids";
import {
  memberIdFromGrandFraisStored,
  parseGrandFraisSession,
  readyGrandFraisPayload,
} from "@/lib/grand-frais-session";
export type NormalizeStoredCodeResult =
  | { code: string }
  | { error: string };

export type ProviderBootstrapField = {
  name: string;
  label: string;
  type: "email" | "password" | "text";
  placeholder?: string;
  autoComplete?: string;
};

export type ProviderCodeHandler = {
  /** Stored value → what the form field shows */
  displayCode?: (stored: string) => string;
  /** User input (+ optional previous stored) → value persisted on the card */
  normalizeStoredCode?: (
    raw: string,
    opts?: { previousCode?: string | null },
  ) => NormalizeStoredCodeResult;
  /**
   * Offline local payload (rare). Prefer `remoteCode` when a network fetch
   * is required for a fresh scannable code.
   */
  liveCode?: (stored: string, at?: Date) => string | null;
  /** Fresh code must be fetched via `/api/cards/[id]/code` (network). */
  remoteCode?: boolean;
  /**
   * If `stored` is already a scannable payload (e.g. nested fullscreen after
   * fetch), return it — otherwise null and the UI waits for remote fetch.
   */
  readyPayload?: (stored: string) => string | null;
  /** Caption under the barcode/QR in the card UI */
  caption?: (stored: string, live: string) => string | null;
  /**
   * One-shot auth to obtain the stored code.
   * UI shows these fields instead of Code; calls `/api/providers/bootstrap`.
   */
  bootstrap?: {
    fields: ProviderBootstrapField[];
  };
  /** True when stored code already has a usable remote session (skip re-login). */
  sessionReady?: (stored: string | null | undefined) => boolean;
};

const HANDLERS: Record<string, ProviderCodeHandler> = {
  [GRAND_FRAIS_PROVIDER_ID]: {
    displayCode: (stored) => memberIdFromGrandFraisStored(stored) || stored,
    normalizeStoredCode: (raw, opts) => {
      const previous = opts?.previousCode || null;
      const prevSession = parseGrandFraisSession(previous);
      const member = memberIdFromGrandFraisStored(raw);
      // Re-save after edit: keep session tokens when member id unchanged
      if (
        prevSession &&
        (raw.trim() === previous?.trim() ||
          raw.trim() === prevSession.memberId ||
          member === prevSession.memberId)
      ) {
        return { code: previous! };
      }
      return {
        error: "Reconnecte la carte avec email + mot de passe",
      };
    },
    remoteCode: true,
    readyPayload: (stored) => readyGrandFraisPayload(stored),
    sessionReady: (stored) => Boolean(parseGrandFraisSession(stored)),
    caption: (stored, live) =>
      memberIdFromGrandFraisStored(stored) ||
      memberIdFromGrandFraisStored(live),
    bootstrap: {
      fields: [
        {
          name: "email",
          label: "Email",
          type: "email",
          placeholder: "compte@email.com",
          autoComplete: "username",
        },
        {
          name: "password",
          label: "Mot de passe",
          type: "password",
          placeholder: "Mot de passe",
          autoComplete: "current-password",
        },
      ],
    },
  },
};

export function getProviderCodeHandler(
  providerId: string | null | undefined,
): ProviderCodeHandler | undefined {
  if (!providerId) return undefined;
  return HANDLERS[providerId];
}

/** True when the form should show bootstrap credentials (create or re-auth). */
export function providerNeedsBootstrap(
  providerId: string | null | undefined,
  storedCode?: string | null,
): boolean {
  const h = getProviderCodeHandler(providerId);
  if (!h?.bootstrap) return false;
  if (h.sessionReady) return !h.sessionReady(storedCode);
  return !storedCode;
}

export function providerHasDynamicCode(
  providerId: string | null | undefined,
): boolean {
  const h = getProviderCodeHandler(providerId);
  return Boolean(h?.liveCode || h?.remoteCode);
}
