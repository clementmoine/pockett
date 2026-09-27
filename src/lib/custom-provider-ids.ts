/**
 * Stable custom provider ids — safe for client + server bundles.
 * Server-only seed/logo helpers live in `custom-providers.ts`.
 */

export const CUSTOM_PROVIDER_PREFIX = "custom:";

export const GRAND_FRAIS_PROVIDER_ID = "custom:grand-frais";

export function isCustomProviderId(id: string | null | undefined): boolean {
  return Boolean(id?.startsWith(CUSTOM_PROVIDER_PREFIX));
}
