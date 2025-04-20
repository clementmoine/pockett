"use client";

import { Card } from "@/components/Card";
import type { Card as CardType } from "@/lib/types";
import { GalleryVerticalEnd } from "lucide-react";
import { useMemo } from "react";

export function Cards({
  cards = [],
  onDeleteCard,
  onEditCard,
  onAddToWallet,
  onShareCard,
}: {
  cards: CardType[];
  onDeleteCard: (id: CardType["id"]) => Promise<void>;
  onEditCard: (card: CardType) => void;
  onAddToWallet: (id: CardType["id"]) => void;
  onShareCard: (id: CardType["id"]) => void;
}) {
  const sortedCards = useMemo(
    () =>
      [...cards].sort((a, b) => {
        const nameA = a.name.toLowerCase();
        const nameB = b.name.toLowerCase();
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
        return 0;
      }),
    [cards],
  );

  return (
    <div className="flex flex-col gap-4 p-4">
      <h2 className="text-foreground text-lg font-semibold mb-4">
        Your Cards ({cards.length})
      </h2>

      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">
        {sortedCards.map((card, index) => (
          <Card
            key={`${card.id}-${index}`}
            {...card}
            onDeleteCard={onDeleteCard}
            onEditCard={() => onEditCard(card)}
            onAddToWallet={() => onAddToWallet(card.id)}
            onShareCard={() => onShareCard(card.id)}
          />
        ))}
      </div>

      {/* Empty state */}
      {cards.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full">
          <GalleryVerticalEnd className="h-16 w-16 text-foreground/50 mb-5" />
          <p className="text-foreground text-center">No cards available</p>
          <p className="text-foreground text-center">
            Add a new card to get started
          </p>
        </div>
      )}
    </div>
  );
}
