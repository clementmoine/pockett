/**
 * Linked external services. UI lives in ConnectionsModal; each service owns
 * its connect/unlink flow.
 */
export type ConnectionServiceId = "klarna";

export type ConnectionServiceMeta = {
  id: ConnectionServiceId;
  name: string;
  description: string;
};

export const CONNECTION_SERVICES: ConnectionServiceMeta[] = [
  {
    id: "klarna",
    name: "Klarna",
    description: "Cartes et programmes fidélité",
  },
];
