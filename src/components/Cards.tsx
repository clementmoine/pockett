"use client";

import { z } from "zod";
import { useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { GalleryVerticalEnd, Search } from "lucide-react";

import { Card } from "@/components/Card";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

import { useDebounce } from "@/lib/hooks/useDebounce";

import type { Card as CardType } from "@prisma/client";

import styles from "./Cards.module.css";

const shelfSchema = z.object({
  search: z.string(),
});

type FormValues = z.infer<typeof shelfSchema>;

export function Cards({
  cards = [],
  onDeleteCard,
  onEditCard,
  onAddToWallet,
  onShareCard,
}: {
  cards: CardType[];
  onDeleteCard: (id: CardType["id"]) => void;
  onEditCard: (card: CardType) => void;
  onAddToWallet: (id: CardType["id"]) => void;
  onShareCard: (id: CardType["id"]) => void;
}) {
  const router = useRouter();

  const debounce = useDebounce();

  const searchParams = useMemo(
    () =>
      new URLSearchParams(
        typeof window !== "undefined" ? window.location.search : "",
      ),
    [],
  );

  const initialSearch = searchParams.get("q") || "";

  const form = useForm({
    resolver: zodResolver(shelfSchema),
    defaultValues: {
      search: initialSearch,
    },
  });
  const searchValue = useWatch({ control: form.control, name: "search" });

  const sortedCards = useMemo(
    () => [...cards].sort((a, b) => a.name.localeCompare(b.name)),
    [cards],
  );
  const filteredCards = useMemo(() => {
    const searchQuery = searchValue
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "");

    return sortedCards.filter((card) =>
      card.name
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .includes(searchQuery),
    );
  }, [searchValue, sortedCards]);

  const handleSearch = async (values: FormValues) => {
    const value = values.search;

    const params = new URLSearchParams(window.location.search);
    if (value) {
      params.set("q", value);
    } else {
      params.delete("q");
    }
    router.replace(`?${params.toString()}`);
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <h2 className="text-foreground text-lg font-semibold">
        Your Cards ({filteredCards.length})
      </h2>

      <Form {...form}>
        <form
          onChange={(e) => {
            const search = (e.target as HTMLInputElement).value;

            debounce(() => handleSearch({ search }));
          }}
          onSubmit={form.handleSubmit(handleSearch)}
        >
          <FormField
            control={form.control}
            name="search"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="hidden text-foreground">Search</FormLabel>
                <FormControl>
                  <div className="flex relative items-center">
                    <Search className="absolute size-4 left-3" />

                    <Input
                      type="search"
                      className="pr-10 pl-9"
                      placeholder="Search card"
                      {...field}
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>

      <div className={styles.gridResponsive}>
        {filteredCards.map((card, index) => (
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
          <GalleryVerticalEnd className="size-16 text-foreground/50 mb-5" />
          <p className="text-foreground text-center">No cards available</p>
          <p className="text-foreground text-center">
            Add a new card to get started
          </p>
        </div>
      )}
    </div>
  );
}
