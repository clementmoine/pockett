/**
 * Runs on Pockett pages (marker data-pockett-app / meta).
 * Waits for React hydration — marker may appear after document_idle.
 */
(() => {
  let started = false;

  function isPockettApp() {
    return Boolean(
      document.querySelector("[data-pockett-app]") ||
        document.querySelector('meta[name="pockett-app"]'),
    );
  }

  function announce() {
    window.postMessage(
      {
        source: "pockett-connector",
        type: "ready",
        version: "0.1.0",
        extensionId: chrome.runtime.id,
      },
      "*",
    );
  }

  function start() {
    if (started || !isPockettApp()) return;
    started = true;

    announce();
    setTimeout(announce, 300);
    setTimeout(announce, 1000);

    chrome.runtime.sendMessage({
      type: "pockett.pair",
      origin: location.origin,
    }).catch(() => {});

    window.addEventListener("message", (event) => {
      if (event.source !== window) return;
      const data = event.data;
      if (!data || data.source !== "pockett-app") return;

      if (data.type === "start-capture") {
        chrome.runtime
          .sendMessage({
            type: "pockett.startCapture",
            providerId: data.providerId || "klarna",
            nonce: data.nonce,
            loginUrl: data.loginUrl,
          })
          .catch(() => {});
      }

      if (data.type === "ping") {
        window.postMessage(
          {
            source: "pockett-connector",
            type: "pong",
            version: "0.1.2",
            extensionId: chrome.runtime.id,
          },
          "*",
        );
      }
    });
  }

  start();
  if (started) return;

  const observer = new MutationObserver(() => {
    start();
    if (started) observer.disconnect();
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["data-pockett-app"],
  });
  // Safety: stop watching after a while if this isn't a Pockett page.
  setTimeout(() => observer.disconnect(), 60_000);
})();
