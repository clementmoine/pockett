/**
 * Backup capture on Klarna pages. Primary path: background.js MAIN-world scan.
 */
(() => {
  const providers = globalThis.__POCKETT_PROVIDERS__ || [];
  if (!providers.length) return;

  const provider = providers[0];
  let sentFor = null;

  function nonceFromHash() {
    const m = location.hash.match(/pockett=([^&]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }

  async function resolveSession() {
    const fromHash = nonceFromHash();
    if (fromHash) {
      const capture = {
        providerId: provider.id,
        nonce: fromHash,
        expiresAt: Date.now() + 15 * 60 * 1000,
      };
      await chrome.storage.local.set({ capture });
      return capture;
    }
    const { capture } = await chrome.storage.local.get("capture");
    if (
      capture?.providerId === provider.id &&
      capture?.nonce &&
      (!capture.expiresAt || Date.now() <= capture.expiresAt)
    ) {
      return capture;
    }
    return null;
  }

  async function trySend() {
    try {
      const session = await resolveSession();
      if (!session) return;

      const token = provider.extract();
      if (!token || !provider.isValid(token)) {
        chrome.runtime.sendMessage({ type: "pockett.scanNow" }).catch(() => {});
        return;
      }
      if (sentFor === token + session.nonce) return;
      sentFor = token + session.nonce;

      const res = await chrome.runtime.sendMessage({
        type: "pockett.ingest",
        providerId: provider.id,
        token,
        nonce: session.nonce,
        ingestPath: provider.ingestPath,
        payload: provider.buildIngestPayload(token, session.nonce),
      });

      if (res?.ok) await chrome.storage.local.remove("capture");
      else {
        sentFor = null;
        console.warn("[pockett-connector]", res?.error || "ingest failed");
      }
    } catch (e) {
      sentFor = null;
      console.warn("[pockett-connector]", e);
    }
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "pockett.tryCapture") void trySend();
  });

  void trySend();
  let n = 0;
  const id = setInterval(() => {
    void trySend();
    if (++n > 240) clearInterval(id);
  }, 500);
})();
