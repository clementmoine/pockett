"use client";

import { useCallback, useMemo, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { createHash } from "crypto";
import { GalleryVerticalEnd, Import, Plus, Share } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FormModal } from "@/components/modals/FormModal";
import { ExportModal } from "@/components/modals/ExportModal";
import { ImportModal } from "@/components/modals/ImportModal";
import { Cards } from "@/components/Cards";

import { useCardStorage } from "@/lib/useCardStorage";
import { Card } from "@/lib/types";

const generateNumericId = () => {
  const uuid = uuidv4();
  const hash = createHash("sha256").update(uuid).digest("hex");
  return parseInt(hash.slice(0, 12), 16);
};

export default function Home() {
  const [isModalOpen, setIsModalOpen] = useState<
    "new" | "edit" | "import" | "export"
  >();
  const [editingCard, setEditingCard] = useState<Card | undefined>(undefined);
  const [exportCards, setExportCards] = useState<Card[] | undefined>(undefined);

  const { cards, getCard, addNewCard, deleteCard, patchCard } =
    useCardStorage();

  const isApple = useMemo(() => {
    if (typeof window === "undefined") return false;
    const ua = window.navigator.userAgent.toLowerCase();
    return /iphone|ipad|ipod|macintosh/.test(ua);
  }, []);

  const addToWallet = useCallback(
    (id: Card["id"]) => {
      getCard(id).then((card) => {
        if (card) {
          fetch("/api/generate", {
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
            })
            .catch((error) => {
              console.error("Error generating pass:", error);
              alert(`Error: ${error.message}`);
            });
        }
      });
    },
    [getCard, isApple],
  );

  const handleImport = useCallback(
    async (cards: Card[]) => {
      try {
        for (const card of cards) {
          await addNewCard({ ...card, id: generateNumericId() });
        }
      } catch (error) {
        console.error("Error importing cards:", error);
      }
    },
    [addNewCard],
  );

  const handleShareCard = useCallback(
    (id: Card["id"]) => {
      getCard(id).then((card) => {
        if (card) {
          // Open the sharing modal instead
          setExportCards([card]);
          setIsModalOpen("export");
        }
      });
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
          <GalleryVerticalEnd className="h-6 w-6 text-foreground" />
          <h1 className="text-lg font-semibold text-foreground">Pockett</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setIsModalOpen("export");
              setExportCards(cards);
            }}
          >
            <Share />
          </Button>

          <Button
            variant="secondary"
            onClick={() => {
              setIsModalOpen("import");
            }}
          >
            <Import />
          </Button>

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
