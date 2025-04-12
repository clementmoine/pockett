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
  const { cards, addNewCard, deleteCard, patchCard } = useCardStorage();

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
      />
    </div>
  );
}
