/**
 * Server-only provider bootstrap + remote live code.
 */

import { GRAND_FRAIS_PROVIDER_ID } from "@/lib/custom-provider-ids";
import {
  bootstrapGrandFraisCredential,
  fetchGrandFraisLiveQr,
} from "@/lib/grand-frais-auth";

export type ProviderBootstrapInput = {
  providerId: string;
  email?: string;
  password?: string;
  [key: string]: unknown;
};

export type ProviderBootstrapResult = {
  code: string;
  memberId?: string;
  sampleQr?: string | null;
};

export type ProviderRemoteCodeResult = {
  code: string;
  /** Updated stored credential when tokens rotate */
  credential?: string;
  caption?: string | null;
};

type BootstrapRunner = (
  input: ProviderBootstrapInput,
) => Promise<ProviderBootstrapResult>;

type RemoteCodeRunner = (stored: string) => Promise<ProviderRemoteCodeResult>;

const BOOTSTRAP: Record<string, BootstrapRunner> = {
  [GRAND_FRAIS_PROVIDER_ID]: async (input) => {
    const result = await bootstrapGrandFraisCredential({
      email: String(input.email ?? ""),
      password: String(input.password ?? ""),
    });
    return {
      code: result.credential,
      memberId: result.memberId,
      sampleQr: result.sampleQr,
    };
  },
};

const REMOTE: Record<string, RemoteCodeRunner> = {
  [GRAND_FRAIS_PROVIDER_ID]: async (stored) => {
    const result = await fetchGrandFraisLiveQr(stored);
    return {
      code: result.qr,
      credential: result.credential,
      caption: result.memberId,
    };
  },
};

export function getProviderBootstrapRunner(
  providerId: string | null | undefined,
): BootstrapRunner | undefined {
  if (!providerId) return undefined;
  return BOOTSTRAP[providerId];
}

export function getProviderRemoteCodeRunner(
  providerId: string | null | undefined,
): RemoteCodeRunner | undefined {
  if (!providerId) return undefined;
  return REMOTE[providerId];
}
