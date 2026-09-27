"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Download, Loader2, Puzzle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { KlarnaButton } from "@/components/KlarnaButton";
import { POCKETT_CONNECTOR_EXTENSION_ID } from "@/lib/extension-id";
import KlarnaLogo from "@/images/klarna.svg";

type SetupStatus = {
  needsSetup: boolean;
  authError?: string;
  providerCount: number;
};

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

function pingExtension(): Promise<boolean> {
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
      const d = event.data;
      if (
        d?.source === "pockett-connector" &&
        (d.type === "pong" || d.type === "ready")
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

/** Klarna row inside ConnectionsModal — own auth + extension bridge. */
export function KlarnaConnection({ active }: { active: boolean }) {
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [waiting, setWaiting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [extReady, setExtReady] = useState(false);
  const [installStep, setInstallStep] = useState(0);
  const [busy, setBusy] = useState(false);

  const linked = Boolean(status && !status.needsSetup);

  const refreshStatus = useCallback(async () => {
    const data = (await (
      await fetch("/api/klarna/setup")
    ).json()) as SetupStatus;
    setStatus(data);
    return data;
  }, []);

  const refreshExt = useCallback(async () => {
    const ok = await pingExtension();
    setExtReady(ok);
    if (ok) setInstallStep(2);
    return ok;
  }, []);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        await refreshStatus();
        await refreshExt();
      } catch {
        if (!cancelled) toast.error("Impossible de lire le statut du service");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active, refreshStatus, refreshExt]);

  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => void refreshExt(), 1500);
    const onVis = () => {
      if (document.visibilityState === "visible") void refreshExt();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, [active, refreshExt]);

  useEffect(() => {
    if (!active || !extReady) return;
    chromeRuntime()?.sendMessage?.(POCKETT_CONNECTOR_EXTENSION_ID, {
      type: "pockett.pair",
      origin: window.location.origin,
    });
  }, [active, extReady]);

  useEffect(() => {
    if (!active || !waiting) return;
    let cancelled = false;
    const id = setInterval(async () => {
      try {
        const data = await refreshStatus();
        if (cancelled || data.needsSetup) return;
        setWaiting(false);
        toast.success(`Klarna lié — ${data.providerCount} providers`);
      } catch {
        /* keep polling */
      }
    }, 1500);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [active, waiting, refreshStatus]);

  const copyExtensionsUrl = async () => {
    try {
      await navigator.clipboard.writeText("chrome://extensions");
      toast.success("chrome://extensions copié — colle dans la barre d’adresse");
    } catch {
      toast.message("Ouvre chrome://extensions manuellement");
    }
  };

  const installExtension = async () => {
    setBusy(true);
    try {
      const a = document.createElement("a");
      a.href = "/api/extension/zip";
      a.download = "pockett-connector.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      await copyExtensionsUrl();
      setInstallStep(1);
    } finally {
      setBusy(false);
    }
  };

  const connect = async () => {
    setStarting(true);
    try {
      const res = await fetch("/api/klarna/bridge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      const data = (await res.json()) as {
        nonce?: string;
        klarnaLoginUrl?: string;
        error?: string;
      };
      if (!res.ok || !data.nonce || !data.klarnaLoginUrl) {
        toast.error(data.error || "Connexion impossible");
        return;
      }
      setWaiting(true);
      const runtime = chromeRuntime();
      if (extReady && runtime?.sendMessage) {
        runtime.sendMessage(POCKETT_CONNECTOR_EXTENSION_ID, {
          type: "pockett.startCapture",
          providerId: "klarna",
          nonce: data.nonce,
          loginUrl: data.klarnaLoginUrl,
        });
        runtime.sendMessage(POCKETT_CONNECTOR_EXTENSION_ID, {
          type: "pockett.pair",
          origin: window.location.origin,
        });
        window.postMessage(
          {
            source: "pockett-app",
            type: "start-capture",
            providerId: "klarna",
            nonce: data.nonce,
            loginUrl: data.klarnaLoginUrl,
          },
          "*",
        );
        toast.message("Connecte-toi sur Klarna dans l’onglet ouvert");
      } else {
        window.open(data.klarnaLoginUrl, "_blank", "noopener,noreferrer");
        toast.message("Installe d’abord le connecteur");
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setStarting(false);
    }
  };

  const unlink = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/klarna/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disconnect" }),
      });
      const data = (await res.json()) as SetupStatus & { error?: string };
      if (!res.ok) {
        toast.error(data.error || "Dissociation impossible");
        return;
      }
      setStatus(data);
      setWaiting(false);
      toast.success("Klarna dissocié");
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex items-center gap-3">
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-md"
          style={{ backgroundColor: "#ffa8cd" }}
        >
          <Image src={KlarnaLogo} alt="" className="h-3 w-fit" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm">Klarna</p>
          <p className="text-xs text-muted-foreground">
            {linked
              ? `Lié · ${status?.providerCount ?? 0} providers`
              : "Cartes et programmes fidélité"}
          </p>
        </div>
        {linked && (
          <span className="text-[10px] uppercase tracking-wide text-emerald-600 shrink-0">
            Connecté
          </span>
        )}
      </div>

      {status?.authError && (
        <p className="text-xs text-destructive">{status.authError}</p>
      )}

      {linked ? (
        <>
          <KlarnaButton
            variant="unlink"
            className="w-full"
            loading={busy}
            disabled={busy}
            onClick={() => void unlink()}
          />
          <button
            type="button"
            className="w-full text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
            disabled={starting}
            onClick={() => void connect()}
          >
            Relier un autre compte
          </button>
        </>
      ) : (
        <>
          {!extReady && (
            <div className="space-y-2 text-sm">
              <p className="text-xs text-muted-foreground flex items-start gap-2">
                <Puzzle className="size-3.5 mt-0.5 shrink-0" />
                Le connecteur navigateur est requis pour lier ce service.
              </p>
              {installStep === 0 ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void installExtension()}
                >
                  {busy ? (
                    <Loader2 className="size-4 mr-1.5 animate-spin" />
                  ) : (
                    <Puzzle className="size-4 mr-1.5" />
                  )}
                  Installer le connecteur
                </Button>
              ) : (
                <div className="space-y-2">
                  <ol className="list-decimal list-inside text-muted-foreground text-xs space-y-1">
                    <li>
                      Dézippe <code>pockett-connector.zip</code>
                    </li>
                    <li>
                      Ouvre{" "}
                      <button
                        type="button"
                        className="underline text-foreground font-medium"
                        onClick={() => void copyExtensionsUrl()}
                      >
                        chrome://extensions
                      </button>{" "}
                      → Mode développeur
                    </li>
                    <li>Glisse-dépose le dossier</li>
                  </ol>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild variant="secondary" size="sm">
                      <a href="/api/extension/zip">
                        <Download className="size-3.5 mr-1.5" />
                        Zip
                      </a>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => void refreshExt()}
                    >
                      Revérifier
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          <KlarnaButton
            className="w-full"
            loading={starting}
            disabled={starting || !extReady}
            onClick={() => void connect()}
          />

          {waiting && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin shrink-0" />
              Connexion en cours…
            </div>
          )}
        </>
      )}
    </div>
  );
}
