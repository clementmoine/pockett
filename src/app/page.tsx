"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CardFormModal } from "@/components/CardFormModal";
import { Carousel } from "@/components/Carousel";
import { useCardStorage } from "@/lib/useCardStorage";
import { Card } from "@/lib/types";

export default function Home() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | undefined>(undefined);
  const { cards, getCard, addNewCard, deleteCard, patchCard } =
    useCardStorage();

  return (
    <div className="flex overflow-hidden flex-col h-screen">
      <Button onClick={() => setIsModalOpen(true)}>Add card</Button>
      <CardFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingCard(undefined);
        }}
        onAddCard={addNewCard}
        onEditCard={patchCard} // Pass patchCard directly
        card={editingCard}
      />
      <Carousel
        cards={cards}
        onDeleteCard={deleteCard}
        onEditCard={(card) => {
          setEditingCard(card);
          setIsModalOpen(true);
        }}
        onAddToWallet={(id) => {
          getCard(id).then((card) => {
            if (card) {
              // Logic to handle adding the card to Apple Wallet
              console.log("Add to Wallet", card);
              // Call the /api/generate endpoint with the card data and open the pass
              // in Apple Wallet
              fetch("/api/generate", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(card),
              })
                .then((response) => {
                  if (!response.ok) {
                    return response.json().then((err) => {
                      throw new Error(err.error || "Failed to generate pass");
                    });
                  }
                  return response.arrayBuffer();
                })
                .then((buffer) => {
                  const url = window.URL.createObjectURL(
                    new Blob([buffer], {
                      type: "application/vnd.apple.pkpass",
                    }),
                  );
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${card.name}.pkpass`;
                  a.click();
                  URL.revokeObjectURL(url);
                })
                .catch((error) => {
                  console.error("Error generating pass:", error);
                  alert(`Error: ${error.message}`); // Display error to the user
                });
            }
          });
        }}
        onShare={(id) => console.log("Share", id)}
      />
    </div>
  );
}
