/**
 * Background service worker — storage, ingest to Pockett, open provider tabs.
 * Capture is driven from here so already-open Klarna tabs still work
 * (single-tab SPA often focuses an existing tab and drops the new one).
 */

const DEFAULT_ORIGIN = "http://localhost:3000";
const CAPTURE_TTL_MS = 15 * 60 * 1000;
const SCAN_ALARM = "pockett.scanCapture";

async function getOrigin() {
  const { pockettOrigin } = await chrome.storage.local.get("pockettOrigin");
  return (pockettOrigin || DEFAULT_ORIGIN).replace(/\/$/, "");
}

async function ensureHostPermission(origin) {
  try {
    const url = new URL(origin);
    const pattern = `${url.protocol}//${url.hostname}/*`;
    const has = await chrome.permissions.contains({ origins: [pattern] });
    if (has) return true;
    return await chrome.permissions.request({ origins: [pattern] });
  } catch {
    return false;
  }
}

async function getCapture() {
  const { capture } = await chrome.storage.local.get("capture");
  if (!capture?.nonce || !capture?.providerId) return null;
  if (capture.expiresAt && Date.now() > capture.expiresAt) {
    await chrome.storage.local.remove("capture");
    return null;
  }
  return capture;
}

async function setCapture(capture) {
  const payload = {
    ...capture,
    expiresAt: Date.now() + CAPTURE_TTL_MS,
  };
  await chrome.storage.local.set({ capture: payload });
  await scheduleScan();
  await scanKlarnaTabs();
  return payload;
}

async function scheduleScan() {
  // One-shot + reschedule — more reliable than short periodInMinutes.
  await chrome.alarms.create(SCAN_ALARM, { when: Date.now() + 2500 });
}

async function clearCapture() {
  await chrome.storage.local.remove("capture");
  await chrome.alarms.clear(SCAN_ALARM);
}

/** Read refresh token from page localStorage (MAIN world). */
async function extractTokenFromTab(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: () => {
        try {
          const key = "@KLAPP:signIn:refreshToken";
          const direct = localStorage.getItem(key);
          if (direct && direct.includes("refresh")) {
            return { token: direct, key };
          }
          // Fallback: scan keys
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (!k) continue;
            const v = localStorage.getItem(k) || "";
            if (
              (k.includes("refreshToken") || k.includes("refresh_token")) &&
              v.includes("refresh")
            ) {
              return { token: v, key: k };
            }
            if (v.startsWith("krn:login:") && v.includes(":refresh:")) {
              return { token: v, key: k };
            }
          }
          return { token: null, key: null, keys: localStorage.length };
        } catch (e) {
          return { token: null, error: String(e) };
        }
      },
    });
    return results?.[0]?.result || { token: null };
  } catch (e) {
    return { token: null, error: e instanceof Error ? e.message : String(e) };
  }
}

async function ingestToken(token, nonce, providerId = "klarna") {
  const origin = await getOrigin();
  await ensureHostPermission(origin);
  const url = origin + "/api/klarna/bridge";
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        nonce,
        syncProviders: true,
        market: "FR",
        provider: providerId,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: data.error || `HTTP ${res.status}` };
    }
    await clearCapture();
    const home = origin + "/?klarna=connected";
    const tabs = await chrome.tabs.query({ url: origin + "/*" });
    if (tabs[0]?.id) {
      await chrome.tabs.update(tabs[0].id, { url: home, active: true });
    } else {
      await chrome.tabs.create({ url: home });
    }
    try {
      await chrome.action.setBadgeText({ text: "OK" });
      await chrome.action.setBadgeBackgroundColor({ color: "#16a34a" });
      setTimeout(() => chrome.action.setBadgeText({ text: "" }), 5000);
    } catch {
      /* ignore */
    }
    return { ok: true, providerCount: data.providerCount };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

let lastAttemptKey = null;

async function scanKlarnaTabs() {
  const capture = await getCapture();
  if (!capture) {
    await chrome.alarms.clear(SCAN_ALARM);
    return { ok: false, reason: "no-capture" };
  }

  const tabs = await chrome.tabs.query({ url: "https://app.klarna.com/*" });
  if (!tabs.length) {
    return { ok: false, reason: "no-klarna-tab" };
  }

  for (const tab of tabs) {
    if (!tab.id || tab.status === "loading") continue;
    const extracted = await extractTokenFromTab(tab.id);
    if (!extracted?.token) continue;

    const attemptKey = extracted.token.slice(0, 32) + capture.nonce;
    if (attemptKey === lastAttemptKey) continue;
    lastAttemptKey = attemptKey;

    const res = await ingestToken(
      extracted.token,
      capture.nonce,
      capture.providerId,
    );
    if (res.ok) return res;
    lastAttemptKey = null;
    console.warn("[pockett-connector] ingest failed", res.error);
    return res;
  }

  return { ok: false, reason: "token-not-ready" };
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== SCAN_ALARM) return;
  void (async () => {
    await scanKlarnaTabs();
    if (await getCapture()) await scheduleScan();
  })();
});

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status !== "complete") return;
  if (!tab.url?.startsWith("https://app.klarna.com/")) return;
  void scanKlarnaTabs();
});

async function handleMessage(message) {
  if (message?.type === "pockett.ping") {
    const capture = await getCapture();
    return {
      ok: true,
      version: "0.1.1",
      name: "Pockett Connector",
      capture: Boolean(capture),
    };
  }

  if (message?.type === "pockett.pair") {
    const origin = String(message.origin || "").replace(/\/$/, "");
    if (!origin) return { ok: false, error: "missing origin" };
    await chrome.storage.local.set({ pockettOrigin: origin });
    return { ok: true, origin };
  }

  if (message?.type === "pockett.getStatus") {
    const origin = await getOrigin();
    const capture = await getCapture();
    return { ok: true, origin, capture };
  }

  if (message?.type === "pockett.setOrigin") {
    const origin = String(message.origin || "").replace(/\/$/, "");
    await chrome.storage.local.set({ pockettOrigin: origin });
    await ensureHostPermission(origin);
    return { ok: true, origin };
  }

  if (message?.type === "pockett.startCapture") {
    const providerId = message.providerId || "klarna";
    const nonce = message.nonce;
    if (!nonce) return { ok: false, error: "missing nonce" };
    lastAttemptKey = null;
    await setCapture({ providerId, nonce });

    const loginUrl =
      message.loginUrl ||
      `https://app.klarna.com/login#pockett=${encodeURIComponent(nonce)}`;

    // Prefer an existing Klarna tab (single-tab app); else open one.
    const existing = await chrome.tabs.query({
      url: "https://app.klarna.com/*",
    });
    if (existing[0]?.id) {
      await chrome.tabs.update(existing[0].id, { active: true });
      // Already logged-in home → scan immediately; else nudge to login with nonce.
      const url = existing[0].url || "";
      if (!/\/(home|single-tab-app)/.test(url)) {
        await chrome.tabs.update(existing[0].id, { url: loginUrl });
      }
    } else {
      await chrome.tabs.create({ url: loginUrl });
    }

    // Immediate pass (covers already-logged-in).
    const scanned = await scanKlarnaTabs();
    return { ok: true, scanned };
  }

  if (message?.type === "pockett.ingest") {
    return ingestToken(
      message.token || message.payload?.token,
      message.nonce || message.payload?.nonce,
      message.providerId || "klarna",
    );
  }

  if (message?.type === "pockett.scanNow") {
    return scanKlarnaTabs();
  }

  return { ok: false, error: "unknown message" };
}

function bind(listener) {
  listener.addListener((message, _sender, sendResponse) => {
    handleMessage(message).then(sendResponse);
    return true;
  });
}

bind(chrome.runtime.onMessage);
bind(chrome.runtime.onMessageExternal);

// Resume scanning after SW wake if a capture is still pending.
void getCapture().then((c) => {
  if (c) void scheduleScan();
});
