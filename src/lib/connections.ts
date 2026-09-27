/**
 * Linked external services. UI lives in ConnectionsModal; each service owns
 * its connect/unlink flow.
 */
export type ConnectionServiceId = "klarna" | "lidl";

export type ConnectionServiceMeta = {
  id: ConnectionServiceId;
  name: string;
  description: string;
  /**
   * Catalog provider ids this account upgrades when linked.
   * The card QR is unchanged; the upgrade is an on-show side effect.
   */
  enhances?: readonly string[];
  /** OAuth callback the Connector watches for, when login happens in the browser. */
  oauthRedirect?: string;
};

export const CONNECTION_SERVICES: ConnectionServiceMeta[] = [
  {
    id: "klarna",
    name: "Klarna",
    description: "Cartes et programmes fidélité",
  },
  {
    id: "lidl",
    name: "Lidl",
    description: "Active les coupons sur la carte Lidl",
    oauthRedirect: "com.lidlplus.app://callback",
    enhances: [
      "krn:consumer-wallet-eu:provider:6027d50c-f6b2-4304-9eb9-3ad8cc0f48df",
      "krn:consumer-wallet-eu:provider:ec21fe1e-c1d6-4b29-bba1-e4fa233174a7",
      "krn:consumer-wallet-eu:loyalty-program:044616a3-0faa-49ba-846c-536f32ce492c",
    ],
  },
];
