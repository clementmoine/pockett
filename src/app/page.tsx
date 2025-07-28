"use client";

import { toast } from "sonner";
import { useCallback, useMemo, useState } from "react";
import {
  GalleryVerticalEnd,
  Plus,
  Ellipsis,
  Download,
  Upload,
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
import { Cards } from "@/components/Cards";

import { useCards } from "@/lib/useCards";

import type { Card } from "@prisma/client";

export default function Home() {
  const [isModalOpen, setIsModalOpen] = useState<
    "new" | "edit" | "import" | "export"
  >();
  const [editingCard, setEditingCard] = useState<Card | undefined>(undefined);
  const [exportCards, setExportCards] = useState<Card[] | undefined>(undefined);

  const { cards, getCard, addNewCard, deleteCard, patchCard } = useCards();

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
    async (cards: Card[], ignoreExisting?: boolean) => {
      try {
        for (const card of cards) {
          await addNewCard(card, ignoreExisting);
        }
        toast.success(
          `${cards?.length ?? 0} card${(cards?.length ?? 0) > 1 ? "s" : ""} imported successfully`,
        );
      } catch (error) {
        console.error("Error importing cards:", error);
        toast.error("Failed to import cards");
      }
    },
    [addNewCard],
  );

  const handleShareCard = useCallback(
    (id: Card["id"]) => {
      const card = getCard(id);

      if (card) {
        // Open the sharing modal instead
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
    <div className="flex flex-col h-screen bg-background text-foreground">
      {/* Header */}
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

      {/* Cards */}
      <Cards
        cards={cards}
        onDeleteCard={deleteCard}
        onEditCard={handleEditCard} // Use the handleEditCard callback
        onAddToWallet={addToWallet}
        onShareCard={handleShareCard}
      />
    </div>
  );
}
