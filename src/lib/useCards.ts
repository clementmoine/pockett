import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { Card, Prisma } from "@prisma/client";

const CARDS_QUERY_KEY = ["cards"];

// API functions - à adapter selon ton endpoint
const cardsApi = {
  getAll: async (): Promise<Card[]> => {
    const response = await fetch("/api/cards");
    if (!response.ok) throw new Error("Failed to fetch cards");
    return response.json();
  },

  create: async (card: Prisma.CardCreateInput): Promise<Card> => {
    const response = await fetch("/api/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(card),
    });
    if (!response.ok) throw new Error("Failed to create card");
    return response.json();
  },

  update: async (card: Prisma.CardUpdateInput): Promise<Card> => {
    const response = await fetch(`/api/cards?id=${card.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(card),
    });
    if (!response.ok) throw new Error("Failed to update card");
    return response.json();
  },

  delete: async (cardId: Card["id"]): Promise<void> => {
    const response = await fetch(`/api/cards?id=${cardId}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to delete card");
  },
};

export function useCards() {
  const queryClient = useQueryClient();

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
    mutationFn: async ({
      card,
      ignoreExisting = false,
    }: {
      card: Omit<Card, "createdAt" | "updatedAt">;
      ignoreExisting?: boolean;
    }) => {
      if (ignoreExisting) {
        const currentCards =
          queryClient.getQueryData<Card[]>(CARDS_QUERY_KEY) || [];

        const alreadyExists = currentCards.some(
          (c) => c.code === card.code && c.providerId === card.providerId,
        );

        if (alreadyExists) return currentCards;
      }

      return await cardsApi.create(card);
    },
    onMutate: async ({ card }) => {
      await queryClient.cancelQueries({ queryKey: CARDS_QUERY_KEY });

      const previousCards =
        queryClient.getQueryData<Card[]>(CARDS_QUERY_KEY) || [];
      queryClient.setQueryData<Card[]>(CARDS_QUERY_KEY, [
        ...previousCards,
        card as Card,
      ]);

      return { previousCards };
    },
    onError: (error, variables, context) => {
      if (context?.previousCards) {
        queryClient.setQueryData(CARDS_QUERY_KEY, context.previousCards);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: CARDS_QUERY_KEY });
    },
  });

  // Mutation pour supprimer une carte
  const deleteCardMutation = useMutation({
    mutationFn: cardsApi.delete,
    onMutate: async (cardId) => {
      await queryClient.cancelQueries({ queryKey: CARDS_QUERY_KEY });

      const previousCards =
        queryClient.getQueryData<Card[]>(CARDS_QUERY_KEY) || [];
      const updatedCards = previousCards.filter((card) => card.id !== cardId);
      queryClient.setQueryData<Card[]>(CARDS_QUERY_KEY, updatedCards);

      return { previousCards };
    },
    onError: (error, variables, context) => {
      if (context?.previousCards) {
        queryClient.setQueryData(CARDS_QUERY_KEY, context.previousCards);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: CARDS_QUERY_KEY });
    },
  });

  // Mutation pour modifier une carte
  const patchCardMutation = useMutation({
    mutationFn: cardsApi.update,
    onMutate: async (updatedCard) => {
      await queryClient.cancelQueries({ queryKey: CARDS_QUERY_KEY });

      const previousCards =
        queryClient.getQueryData<Card[]>(CARDS_QUERY_KEY) || [];
      const updatedCards = previousCards.map((card) =>
        card.id === updatedCard.id
          ? ({
              ...card,
              ...updatedCard,
            } as Card)
          : card,
      );
      queryClient.setQueryData<Card[]>(CARDS_QUERY_KEY, updatedCards);

      return { previousCards };
    },
    onError: (error, variables, context) => {
      if (context?.previousCards) {
        queryClient.setQueryData(CARDS_QUERY_KEY, context.previousCards);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: CARDS_QUERY_KEY });
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
    addNewCard: (
      card: Omit<Card, "createdAt" | "updatedAt">,
      ignoreExisting?: boolean,
    ) => addCardMutation.mutateAsync({ card, ignoreExisting }),
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
