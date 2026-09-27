/**
 * Klarna (app.klarna.com) — refresh token from klapp web SPA localStorage.
 * Loaded as a classic script before content/capture.js (no import).
 */
(() => {
  const providers = (globalThis.__POCKETT_PROVIDERS__ =
    globalThis.__POCKETT_PROVIDERS__ || []);

  providers.push({
    id: "klarna",
    name: "Klarna",
    storageKey: "@KLAPP:signIn:refreshToken",
    extract() {
      try {
        return localStorage.getItem("@KLAPP:signIn:refreshToken");
      } catch {
        return null;
      }
    },
    isValid(token) {
      return typeof token === "string" && token.includes("refresh");
    },
    /** POST body builder for Pockett bridge */
    buildIngestPayload(token, nonce) {
      return {
        token,
        nonce,
        syncProviders: true,
        market: "FR",
        provider: "klarna",
      };
    },
    ingestPath: "/api/klarna/bridge",
  });
})();
