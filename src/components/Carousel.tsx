"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { Card } from "@/components/Card";
import type { Card as CardType } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
  PaginationLink,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import { GalleryVerticalEnd } from "lucide-react";

export function Carousel({
  cards,
  onDeleteCard,
  onEditCard,
  onAddToWallet,
  onShare,
}: {
  cards: CardType[];
  onDeleteCard: (id: CardType["id"]) => Promise<void>;
  onEditCard: (card: CardType) => void;
  onAddToWallet: (id: CardType["id"]) => void;
  onShare: (id: CardType["id"]) => void;
}) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true, // Enable looping
    align: "center", // Center the active card
    containScroll: "trimSnaps", // Ensure the visible area is respected
  });

  const [selectedIndex, setSelectedIndex] = useState(0);

  const getRealIndex = (clonedIndex: number) => {
    if (clonedCards.length <= 1) return 0;
    if (clonedIndex === cards.length) return 0;
    if (clonedIndex === cards.length + 1) return cards.length - 1;
    return clonedIndex;
  };

  // Update the selected index when the carousel scrolls
  const onSelect = useCallback(() => {
    if (emblaApi) {
      setSelectedIndex(emblaApi.selectedScrollSnap());
    }
  }, [emblaApi]);

  // Attach the `onSelect` callback to the carousel
  useEffect(() => {
    if (emblaApi) {
      emblaApi.on("select", onSelect);
    }
  }, [emblaApi, onSelect]);

  // Clone the first and last cards for seamless looping
  const clonedCards = useMemo(() => {
    if (cards.length > 1) {
      return [...cards, cards[0], cards[cards.length - 1]];
    }
    return cards; // No need to clone if there's only one card
  }, [cards]);

  const scrollTo = (index: number) => {
    if (emblaApi) emblaApi.scrollTo(index);
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
                onAddToWallet={() => onAddToWallet(card.id)}
                onShare={() => onShare(card.id)}
              />
            </div>
          ))}
        </div>
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

      {/* Pagination */}
      {cards.length > 1 && (
        <div className="flex justify-center m-4">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={() => emblaApi?.scrollPrev()}
                />
              </PaginationItem>

              {cards.map((_, index) => {
                const isSelected = index === getRealIndex(selectedIndex);

                return (
                  <PaginationItem key={index}>
                    <PaginationLink
                      onClick={() => scrollTo(index)}
                      isActive={isSelected}
                    >
                      {index + 1}
                    </PaginationLink>
                  </PaginationItem>
                );
              })}

              {cards.length > 5 && <PaginationEllipsis />}

              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={() => emblaApi?.scrollNext()}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </>
  );
}
