"use client";

import React, { useMemo } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/button";
import type { Card as CardType } from "@/lib/types";
import { cn } from "@/lib/utils";

export function Carousel({
  cards,
  onDeleteCard,
  onEditCard,
}: {
  cards: CardType[];
  onDeleteCard: (id: string) => Promise<void>;
  onEditCard: (card: CardType) => void;
}) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true, // Enable looping
    align: "center", // Center the active card
    containScroll: "trimSnaps", // Ensure the visible area is respected
  });

  // Clone the first and last cards for seamless looping
  const clonedCards = useMemo(() => {
    if (cards.length > 1) {
      return [cards[cards.length - 1], ...cards, cards[0]];
    }
    return cards; // No need to clone if there's only one card
  }, [cards]);

  const scrollPrev = () => {
    if (emblaApi) emblaApi.scrollPrev();
  };

  const scrollNext = () => {
    if (emblaApi) emblaApi.scrollNext();
  };

  return (
    <>
      <div ref={emblaRef} className="relative h-full flex-1 overflow-hidden">
        {/* If there is only one card center that */}
        <div
          className={cn("flex relative items-center h-full gap-4 px-4", {
            "justify-center": cards.length === 1,
          })}
        >
          {clonedCards.map((card, index) => (
            <div
              key={`${card.id}-${index}`}
              className="flex w-[70%] flex-shrink-0 items-center justify-center"
            >
              <Card
                {...card}
                onDeleteCard={onDeleteCard}
                onEditCard={() => onEditCard(card)}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-2 mt-4">
        <Button onClick={scrollPrev}>Previous</Button>
        <Button onClick={scrollNext}>Next</Button>
      </div>
    </>
  );
}
