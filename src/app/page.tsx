"use client";

import { toast } from "sonner";
import { useCallback, useEffect, useMemo, useState } from "react";
import { signOut } from "next-auth/react";
import {
  GalleryVerticalEnd,
  Plus,
  Ellipsis,
  Download,
  Upload,
  LogOut,
  Settings,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { FormModal } from "@/components/modals/FormModal";
import { ExportModal } from "@/components/modals/ExportModal";
import { ImportModal } from "@/components/modals/ImportModal";
import { ConnectionsModal } from "@/components/modals/ConnectionsModal";
import { Cards } from "@/components/Cards";

import { useCards } from "@/lib/useCards";

import type { Card } from "@prisma/client";

const SKIP_CONNECTIONS_KEY = "pockett-skip-connections";

export default function Home() {
  const [isModalOpen, setIsModalOpen] = useState<
    "new" | "edit" | "import" | "export" | "connections"
  >();
  const [editingCard, setEditingCard] = useState<Card | undefined>(undefined);
  const [exportCards, setExportCards] = useState<Card[] | undefined>(undefined);

  const { cards, getCard, addNewCard, deleteCard, patchCard } = useCards();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        if (params.get("klarna") === "connected") {
          toast.success("Compte lié");
          window.history.replaceState({}, "", "/");
        }
        if (params.get("error")) {
          toast.error(params.get("error")!);
          window.history.replaceState({}, "", "/");
        }

        const res = await fetch("/api/klarna/setup");
        if (!res.ok) return;
        const data = (await res.json()) as { needsSetup: boolean };
        if (cancelled) return;
        const skipped =
          sessionStorage.getItem(SKIP_CONNECTIONS_KEY) === "1" ||
          sessionStorage.getItem("pockett-skip-klarna-setup") === "1";
        const force =
          params.get("connections") === "1" ||
          params.get("klarna") === "setup";
        if ((data.needsSetup && !skipped) || force) {
          setIsModalOpen("connections");
          if (force) window.history.replaceState({}, "", "/");
        }
      } catch {
        /* ignore — home still usable */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const isApple = useMemo(() => {
    if (typeof window === "undefined") return false;
    const ua = window.navigator.userAgent.toLowerCase();
    return /iphone|ipad|ipod|macintosh/.test(ua);
  }, []);

  const addToWallet = useCallback(
    (id: Card["id"]) => {
      const card = getCard(id);
      if (card) {
        fetch("/api/pass/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            platform: isApple ? "apple" : "google",
            ...card,
          }),
        })
          .then((response) => {
            if (!response.ok) {
              return response.json().then((err) => {
                throw new Error(err.error || "Failed to generate pass");
              });
            }
            return response.json();
          })
          .then((data) => {
            const { cardUrl } = data;
            window.location.href = cardUrl;
            toast.success(`${card.name} card pass generated successfully`);
          })
          .catch((error) => {
            console.error("Error generating pass:", error);
            toast.error("Failed to generate pass");
          });
      }
    },
    [getCard, isApple],
  );

  const handleImport = useCallback(
    async (cards: Card[]) => {
      let successCount = 0;

      for (const card of cards) {
        try {
          await addNewCard(card);
          successCount++;
          toast.success(`Card ${card.name || "Unknown"} imported successfully`);
        } catch (error) {
          console.error("Error importing card:", card, error);
          toast.error(`Failed to import card: ${card.name || "Unknown"}`);
        }
      }

      if (successCount > 0) {
        toast.success(
          `${successCount} card${successCount > 1 ? "s" : ""} imported successfully`,
        );
      }

      if (successCount < cards.length) {
        toast.error(
          `Some cards failed to import (${cards.length - successCount} / ${cards.length})`,
        );
      }
    },
    [addNewCard],
  );

  const handleShareCard = useCallback(
    (id: Card["id"]) => {
      const card = getCard(id);

      if (card) {
        setExportCards([card]);
        setIsModalOpen("export");
      }
    },
    [getCard],
  );

  const handleModalClose = useCallback(() => {
    setEditingCard(undefined);
    setIsModalOpen(undefined);
    setExportCards(undefined);
  }, []);

  const handleEditCard = useCallback((card: Card) => {
    setEditingCard(card);
    setIsModalOpen("edit");
  }, []);

  return (
    <div
      className="flex flex-col h-screen bg-background text-foreground"
      data-pockett-app="1"
    >
      <header className="flex items-center justify-between p-4 border-b bg-background shadow-sm">
        <div className="flex items-center gap-2">
          <GalleryVerticalEnd className="size-6 text-foreground" />
          <h1 className="text-lg font-semibold text-foreground">Pockett</h1>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary">
                <Ellipsis />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsModalOpen("connections")}>
                <Settings />
                Comptes liés
              </DropdownMenuItem>

              <DropdownMenuItem onClick={() => setIsModalOpen("import")}>
                <Upload />
                Import cards
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => {
                  setIsModalOpen("export");
                  setExportCards(cards);
                }}
              >
                <Download />
                Share cards
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                <LogOut />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="default"
            onClick={() => {
              setIsModalOpen("new");
            }}
          >
            <Plus />
            Add card
          </Button>
        </div>
      </header>

      <FormModal
        isOpen={isModalOpen == "new" || isModalOpen == "edit"}
        onClose={handleModalClose}
        onAddCard={addNewCard}
        onEditCard={patchCard}
        card={editingCard}
      />

      <ExportModal
        isOpen={isModalOpen == "export"}
        onClose={handleModalClose}
        cards={exportCards}
      />

      <ImportModal
        isOpen={isModalOpen == "import"}
        onClose={handleModalClose}
        onImport={handleImport}
      />

      <ConnectionsModal
        isOpen={isModalOpen == "connections"}
        onClose={handleModalClose}
      />

      <Cards
        cards={cards}
        onDeleteCard={deleteCard}
        onEditCard={handleEditCard}
        onAddToWallet={addToWallet}
        onShareCard={handleShareCard}
      />
    </div>
  );
}
