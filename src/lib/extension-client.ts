import { POCKETT_CONNECTOR_EXTENSION_ID } from "@/lib/extension-id";

type ChromeRuntime = {
  sendMessage: (
    extensionId: string,
    message: unknown,
    responseCallback?: (response: unknown) => void,
  ) => void;
  lastError?: { message?: string };
};

function chromeRuntime(): ChromeRuntime | undefined {
  return (window as Window & { chrome?: { runtime?: ChromeRuntime } }).chrome
    ?.runtime;
}

export function pingPockettExtension(): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      resolve(ok);
    };
    const runtime = chromeRuntime();
    try {
      runtime?.sendMessage?.(
        POCKETT_CONNECTOR_EXTENSION_ID,
        { type: "pockett.ping" },
        (response) => {
          if (runtime.lastError) return;
          if ((response as { ok?: boolean } | undefined)?.ok) finish(true);
        },
      );
    } catch {
      /* ignore */
    }
    const onMsg = (event: MessageEvent) => {
      if (event.source !== window) return;
      const data = event.data;
      if (
        data?.source === "pockett-connector" &&
        (data.type === "pong" || data.type === "ready")
      ) {
        window.removeEventListener("message", onMsg);
        finish(true);
      }
    };
    window.addEventListener("message", onMsg);
    window.postMessage({ source: "pockett-app", type: "ping" }, "*");
    window.setTimeout(() => {
      window.removeEventListener("message", onMsg);
      finish(false);
    }, 600);
  });
}

export function startPockettCapture(message: {
  providerId: string;
  nonce: string;
  loginUrl: string;
  redirectPrefix?: string;
  connectionId?: string;
}) {
  const payload = {
    type: "pockett.startCapture",
    providerId: message.providerId,
    nonce: message.nonce,
    loginUrl: message.loginUrl,
    redirectPrefix: message.redirectPrefix,
    connectionId: message.connectionId,
  };
  chromeRuntime()?.sendMessage?.(POCKETT_CONNECTOR_EXTENSION_ID, payload);
  window.postMessage({ source: "pockett-app", ...payload }, "*");
}
