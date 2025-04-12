import { useState, useEffect, useCallback } from "react";
import localforage from "localforage";
import { Card } from "./types";

const CARD_STORAGE_KEY = "cards";

export function useCardStorage() {
  const [cards, setCards] = useState<Card[]>([]);

  // Fetch all cards from storage
  const fetchCards = useCallback(async () => {
    const storedCards =
      (await localforage.getItem<Card[]>(CARD_STORAGE_KEY)) || [];
    setCards(storedCards);
  }, []);

  // Add a new card
  const addNewCard = useCallback(
    async (card: Card) => {
      const storedCards =
        (await localforage.getItem<Card[]>(CARD_STORAGE_KEY)) || [];
      await localforage.setItem(CARD_STORAGE_KEY, [...storedCards, card]);
      await fetchCards(); // Refresh cards after adding
    },
    [fetchCards],
  );

  // Remove a card by ID
  const deleteCard = useCallback(
    async (cardId: Card["id"]) => {
      const storedCards =
        (await localforage.getItem<Card[]>(CARD_STORAGE_KEY)) || [];
      const updatedCards = storedCards.filter((card) => card.id !== cardId);
      await localforage.setItem(CARD_STORAGE_KEY, updatedCards);
      await fetchCards(); // Refresh cards after deleting
    },
    [fetchCards],
  );

  // Get a single card by ID
  const getCard = useCallback(
    async (cardId: Card["id"]): Promise<Card | undefined> => {
      const storedCards =
        (await localforage.getItem<Card[]>(CARD_STORAGE_KEY)) || [];
      return storedCards.find((card) => card.id === cardId);
    },
    [],
  );

  // Patch (edit) an existing card
  const patchCard = useCallback(
    async (updatedCard: Card) => {
      const storedCards =
        (await localforage.getItem<Card[]>(CARD_STORAGE_KEY)) || [];
      const updatedCards = storedCards.map((card) =>
        card.id === updatedCard.id ? updatedCard : card,
      );
      await localforage.setItem(CARD_STORAGE_KEY, updatedCards);
      await fetchCards(); // Refresh cards after editing
    },
    [fetchCards],
  );

  useEffect(() => {
    fetchCards(); // Fetch cards on mount
  }, [fetchCards]);

  return { cards, addNewCard, deleteCard, getCard, patchCard };
}
