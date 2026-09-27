"use client";

import { Link2 } from "lucide-react";

import { KlarnaConnection } from "@/components/connections/KlarnaConnection";
import { CONNECTION_SERVICES } from "@/lib/connections";
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
  const skip = () => {
    sessionStorage.setItem(SKIP_KEY, "1");
    // legacy key used by older sessions
    sessionStorage.setItem("pockett-skip-klarna-setup", "1");
    onClose();
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
            return null;
          })}

          <Button variant="ghost" className="w-full" onClick={skip}>
            Plus tard
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
