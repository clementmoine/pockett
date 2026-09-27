"use client";

import { useEffect, useState } from "react";
import { Download, Link2 } from "lucide-react";
import { toast } from "sonner";

import { KlarnaConnection } from "@/components/connections/KlarnaConnection";
import { LidlConnection } from "@/components/connections/LidlConnection";
import { CONNECTION_SERVICES } from "@/lib/connections";
import { pingPockettExtension } from "@/lib/extension-client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const SKIP_KEY = "pockett-skip-connections";

export function ConnectionsModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [extReady, setExtReady] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const tick = () => {
      void pingPockettExtension().then((ok) => {
        if (!cancelled) setExtReady(ok);
      });
    };
    tick();
    const id = window.setInterval(tick, 1500);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [isOpen]);

  const skip = () => {
    sessionStorage.setItem(SKIP_KEY, "1");
    // legacy key used by older sessions
    sessionStorage.setItem("pockett-skip-klarna-setup", "1");
    onClose();
  };

  const installExtension = async () => {
    const a = document.createElement("a");
    a.href = "/api/extension/zip";
    a.download = "pockett-connector.zip";
    document.body.appendChild(a);
    a.click();
    a.remove();
    try {
      await navigator.clipboard.writeText("chrome://extensions");
      toast.success(
        "Connecteur téléchargé — chrome://extensions copié, colle-le dans la barre d’adresse",
      );
    } catch {
      toast.message(
        "Connecteur téléchargé — ouvre chrome://extensions pour l’ajouter",
      );
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="flex flex-col p-0 overflow-hidden bg-background text-foreground gap-0 max-h-[90vh] sm:max-w-md">
        <DialogHeader className="p-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="size-4" />
            Comptes liés
          </DialogTitle>
          <DialogDescription>
            Connecte des services pour importer cartes et catalogues.
          </DialogDescription>
        </DialogHeader>

        <div className="p-4 space-y-3 overflow-auto">
          {CONNECTION_SERVICES.map((service) => {
            if (service.id === "klarna") {
              return (
                <KlarnaConnection
                  key={service.id}
                  active={isOpen}
                />
              );
            }
            if (service.id === "lidl") {
              return <LidlConnection key={service.id} active={isOpen} />;
            }
            return null;
          })}

          <div className="flex items-center gap-2">
            {extReady && (
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-500/15 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-emerald-600">
                <span className="size-2 rounded-full bg-emerald-500" aria-hidden />
                Détecté
              </span>
            )}
            <Button
              type="button"
              variant="secondary"
              className="min-w-0 flex-1"
              onClick={() => void installExtension()}
            >
              <Download className="size-4 mr-1.5" />
              {extReady ? "Réinstaller" : "Installer le connecteur"}
            </Button>
          </div>

          <Button variant="ghost" className="w-full" onClick={skip}>
            Plus tard
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
