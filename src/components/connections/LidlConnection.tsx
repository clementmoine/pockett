"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Loader2, Puzzle } from "lucide-react";
import { toast } from "sonner";

import { LidlButton } from "@/components/LidlButton";
import { CONNECTION_SERVICES } from "@/lib/connections";
import LidlLogo from "@/images/lidl.svg";
import {
  pingPockettExtension,
  startPockettCapture,
} from "@/lib/extension-client";

const LIDL = CONNECTION_SERVICES.find((service) => service.id === "lidl");

/**
 * Lidl row in Comptes liés. Linking does not create a card: it turns on
 * coupon activation for the existing Lidl QR.
 */
export function LidlConnection({ active }: { active: boolean }) {
  const [linked, setLinked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [extReady, setExtReady] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [busy, setBusy] = useState(false);
  const nonceRef = useRef<string | null>(null);

  const refreshStatus = useCallback(async () => {
    const data = (await (await fetch("/api/connections")).json()) as {
      services?: Array<{ id: string; linked?: boolean }>;
    };
    const row = data.services?.find((service) => service.id === "lidl");
    setLinked(Boolean(row?.linked));
    return Boolean(row?.linked);
  }, []);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        await refreshStatus();
        if (!cancelled) setExtReady(await pingPockettExtension());
      } catch {
        if (!cancelled) toast.error("Impossible de lire le compte Lidl");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active, refreshStatus]);

  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => {
      void pingPockettExtension().then(setExtReady);
    }, 1500);
    return () => window.clearInterval(id);
  }, [active]);

  const markLinked = useCallback(() => {
    nonceRef.current = null;
    setWaiting(false);
    setLinked(true);
    toast.success(
      "Lidl lié — les coupons s'activent quand tu retournes la carte",
    );
  }, []);

  useEffect(() => {
    if (!active || !waiting) return;
    const nonce = nonceRef.current;
    if (!nonce) return;
    let cancelled = false;
    const id = window.setInterval(async () => {
      try {
        const res = await fetch(
          `/api/connections/bridge?connectionId=lidl&nonce=${encodeURIComponent(nonce)}`,
        );
        const data = (await res.json()) as { status?: string; error?: string };
        if (cancelled) return;
        if (data.status === "ready") {
          const ok = await refreshStatus();
          if (ok) markLinked();
          return;
        }
        if (data.status === "error") {
          setWaiting(false);
          toast.error(data.error || "Connexion Lidl refusée");
        }
      } catch {
        /* keep polling */
      }
    }, 1500);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [active, waiting, refreshStatus, markLinked]);

  useEffect(() => {
    const onMsg = (event: MessageEvent) => {
      if (event.source !== window) return;
      const data = event.data;
      if (data?.source !== "pockett-connector" || data.type !== "auth-code") {
        return;
      }
      if (!nonceRef.current || data.nonce !== nonceRef.current) return;
      void (async () => {
        const res = await fetch("/api/connections/bridge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "complete",
            connectionId: "lidl",
            nonce: data.nonce,
            code: data.code,
          }),
        });
        const body = (await res.json()) as { error?: string };
        if (!res.ok) {
          setWaiting(false);
          toast.error(body.error || "Connexion Lidl refusée");
          return;
        }
        markLinked();
      })();
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [markLinked]);

  const connect = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/connections/bridge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          connectionId: "lidl",
          country: "FR",
        }),
      });
      const data = (await res.json()) as {
        nonce?: string;
        loginUrl?: string;
        error?: string;
      };
      if (!res.ok || !data.nonce || !data.loginUrl) {
        toast.error(data.error || "Connexion impossible");
        return;
      }
      nonceRef.current = data.nonce;
      setWaiting(true);
      startPockettCapture({
        providerId: "lidl",
        connectionId: "lidl",
        nonce: data.nonce,
        loginUrl: data.loginUrl,
        redirectPrefix: LIDL?.oauthRedirect,
      });
      toast.message("Connecte-toi à Lidl dans l'onglet ouvert");
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setBusy(false);
    }
  };

  const unlink = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "lidl", action: "disconnect" }),
      });
      if (!res.ok) {
        toast.error("Dissociation impossible");
        return;
      }
      setLinked(false);
      setWaiting(false);
      toast.success("Lidl dissocié — la carte redevient un simple QR");
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
          style={{ backgroundColor: "#fff000" }}
        >
          <Image src={LidlLogo} alt="" className="h-3 w-fit" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm">Lidl</p>
          <p className="text-xs text-muted-foreground">
            {linked
              ? "Lié · les coupons s'activent au verso"
              : "Sans compte, la carte Lidl reste un simple QR"}
          </p>
        </div>
        {linked && (
          <span className="text-[10px] uppercase tracking-wide text-emerald-600 shrink-0">
            Connecté
          </span>
        )}
      </div>

      {linked ? (
        <LidlButton
          variant="unlink"
          className="w-full"
          loading={busy}
          disabled={busy}
          onClick={() => void unlink()}
        />
      ) : (
        <>
          {!extReady && (
            <p className="text-xs text-muted-foreground flex items-start gap-2">
              <Puzzle className="size-3.5 mt-0.5 shrink-0" />
              Le même connecteur que Klarna est requis.
            </p>
          )}
          <LidlButton
            className="w-full"
            loading={busy || waiting}
            disabled={busy || waiting || !extReady}
            onClick={() => void connect()}
          />
          {waiting && (
            <p className="text-xs text-muted-foreground">
              Termine la connexion dans l'onglet Lidl, code SMS compris.
            </p>
          )}
        </>
      )}
    </div>
  );
}
