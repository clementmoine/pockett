"use client";

import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { CardFormModal } from "@/components/CardFormModal";
import { Carousel } from "@/components/Carousel";
import { useCardStorage } from "@/lib/useCardStorage";
import { Card } from "@/lib/types";
import { GalleryVerticalEnd } from "lucide-react";

export default function Home() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | undefined>(undefined);
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

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b bg-background shadow-sm">
        <div className="flex items-center gap-2">
          <GalleryVerticalEnd className="h-6 w-6 text-foreground" />
          <h1 className="text-lg font-semibold text-foreground">Pockett</h1>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>Add card</Button>
      </header>

      {/* Card Form Modal */}
      <CardFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingCard(undefined);
        }}
        onAddCard={addNewCard}
        onEditCard={patchCard}
        card={editingCard}
      />

      {/* Carousel */}
      <Carousel
        cards={cards}
        onDeleteCard={deleteCard}
        onEditCard={(card) => {
          setEditingCard(card);
          setIsModalOpen(true);
        }}
        onAddToWallet={addToWallet}
        onShare={(id) => console.log("Share", id)}
      />
    </div>
  );
}
