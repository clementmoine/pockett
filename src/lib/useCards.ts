import { useQuery, useMutation } from "@tanstack/react-query";
import { useCallback } from "react";
import { Card, Prisma } from "@prisma/client";

const CARDS_QUERY_KEY = ["cards"];

// API functions - à adapter selon ton endpoint
const cardsApi = {
  getAll: async (): Promise<Card[]> => {
    const response = await fetch("/api/cards");
    if (!response.ok) return Promise.reject("Failed to fetch cards");
    return response.json();
  },

  create: async (
    card: Omit<Card, "createdAt" | "updatedAt">,
  ): Promise<Card> => {
    const response = await fetch("/api/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(card),
    });
    if (!response.ok) return Promise.reject("Failed to create card");
    return response.json();
  },

  update: async (card: Prisma.CardUpdateInput): Promise<Card> => {
    const response = await fetch(`/api/cards?id=${card.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(card),
    });
    if (!response.ok) return Promise.reject("Failed to update card");
    return response.json();
  },

  delete: async (cardId: Card["id"]): Promise<void> => {
    const response = await fetch(`/api/cards?id=${cardId}`, {
      method: "DELETE",
    });
    if (!response.ok) return Promise.reject("Failed to delete card");
  },
};

export function useCards() {
  const {
    data: cards = [],
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: CARDS_QUERY_KEY,
    queryFn: cardsApi.getAll,
  });

  const addCardMutation = useMutation({
    mutationFn: cardsApi.create,
    onSuccess: () => {
      // Optionnel : refetch les cartes après une modification
      refetch();
    },
  });

  // Mutation pour supprimer une carte
  const deleteCardMutation = useMutation({
    mutationFn: cardsApi.delete,
    onSuccess: () => {
      // Optionnel : refetch les cartes après une modification
      refetch();
    },
  });

  // Mutation pour modifier une carte
  const patchCardMutation = useMutation({
    mutationFn: cardsApi.update,
    onSuccess: () => {
      // Optionnel : refetch les cartes après une modification
      refetch();
    },
  });

  // Get card by ID
  const getCard = useCallback(
    (cardId: Card["id"]): Card | undefined => {
      return cards.find((card) => card.id === cardId);
    },
    [cards],
  );

  // Sync with server
  const syncWithServer = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return {
    // Data
    cards,
    isLoading,
    isFetching,
    error,

    // Actions
    addNewCard: (card: Omit<Card, "createdAt" | "updatedAt">) =>
      addCardMutation.mutateAsync(card),
    deleteCard: (cardId: Card["id"]) => deleteCardMutation.mutateAsync(cardId),
    patchCard: (card: Prisma.CardUpdateInput) =>
      patchCardMutation.mutateAsync(card),
    getCard,

    // Utilities
    syncWithServer,

    // State management
    isAddingCard: addCardMutation.isPending,
    isDeletingCard: deleteCardMutation.isPending,
    isPatchingCard: patchCardMutation.isPending,

    // Errors
    addCardError: addCardMutation.error,
    deleteCardError: deleteCardMutation.error,
    patchCardError: patchCardMutation.error,
  };
}
