"use client";

import leven from "leven";
import { toast } from "sonner";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";

import type { ProviderWithVisual } from "@/types/provider";

import { cn } from "@/lib/utils";

export function ProviderPicker({
  value,
  onChange,
  suggestFrom,
  countryCode = "FR",
}: {
  value?: ProviderWithVisual["id"];
  suggestFrom?: string;
  onChange: (
    id: ProviderWithVisual["id"],
    provider: ProviderWithVisual,
  ) => void;
  countryCode?: string;
}) {
  const [open, setOpen] = useState(false);

  function getProviderScore(provider: ProviderWithVisual, search: string) {
    const normalize = (str: string) =>
      str
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/\s+/g, " ")
        .replace(/[\u0300-\u036f]/g, "");

    const normalizedSearch = normalize(search);
    const normalizedName = normalize(provider.name);
    const normalizedTerms = (
      (JSON.parse(provider.searchTerms) || []) as string[]
    ).map(normalize);

    const startsWith =
      normalizedName.startsWith(normalizedSearch) ||
      normalizedTerms.some((term) => term.startsWith(normalizedSearch));

    const includes =
      !startsWith &&
      (normalizedName.includes(normalizedSearch) ||
        normalizedTerms.some((term) => term.includes(normalizedSearch)));

    const distance = Math.min(
      leven(normalizedName, normalizedSearch),
      ...normalizedTerms.map((term) => leven(term, normalizedSearch)),
    );

    return { startsWith, includes, distance };
  }

  const { data: providers = [], isLoading: loading } = useQuery({
    queryKey: ["providers", countryCode],
    queryFn: async () => {
      const res = await fetch(`/api/klarna/providers?country=${countryCode}`);
      if (!res.ok) {
        const err = await res.json();
        toast.error("Failed to fetch providers");

        throw new Error(err.error || "Failed to fetch providers");
      }

      const allProviders = (await res.json()) as ProviderWithVisual[];

      return allProviders
        .filter((provider) =>
          JSON.parse(provider.markets).includes(countryCode),
        )
        .sort((a, b) => a.name.localeCompare(b.name));
    },
  });

  const suggestedProviders = useMemo<ProviderWithVisual[]>(() => {
    if (!suggestFrom || value) return [];

    return providers
      .map((provider) => {
        const { startsWith, includes, distance } = getProviderScore(
          provider,
          suggestFrom,
        );
        return {
          ...provider,
          _startsWith: startsWith,
          _includes: includes,
          _distance: distance,
        };
      })
      .sort((a, b) => {
        if (a._startsWith && !b._startsWith) return -1;
        if (!a._startsWith && b._startsWith) return 1;
        if (a._includes && !b._includes) return -1;
        if (!a._includes && b._includes) return 1;
        return a._distance - b._distance;
      })
      .slice(0, 5);
  }, [providers, suggestFrom, value]);

  const renderProviderCard = useCallback(
    (provider: ProviderWithVisual) => (
      <span
        className="flex rounded w-8 items-center justify-center p-1 border overflow-hidden"
        style={{
          aspectRatio: "1.61792 / 1",
          backgroundColor: provider.visual?.color,
        }}
      >
        {provider.visual?.logoUrl && (
          <Image
            src={provider.visual?.logoUrl}
            alt={provider.name}
            width={32}
            height={32}
            className="w-full h-full object-contain"
          />
        )}
      </span>
    ),
    [],
  );

  const renderProvider = useCallback(
    (provider: ProviderWithVisual) => (
      <CommandItem
        key={provider.id}
        value={provider.id}
        onSelect={(currentValue) => {
          const provider = providers.find((p) => p.id === currentValue);

          if (provider) {
            onChange(currentValue, provider);
            setOpen(false);
          }
        }}
      >
        {renderProviderCard(provider)}

        <span>{provider.name}</span>

        <Check
          className={cn(
            "ml-auto",
            value === provider.id ? "opacity-100" : "opacity-0",
          )}
        />
      </CommandItem>
    ),
    [onChange, providers, renderProviderCard, value],
  );

  const currentProvider = useMemo(() => {
    return providers.find((provider) => provider.id === value);
  }, [providers, value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          disabled={loading}
          aria-expanded="false"
          className={cn("flex overflow-hidden w-full justify-between", {
            "!text-muted-foreground": !currentProvider,
          })}
        >
          <span className="flex items-center gap-2 shrink-0 flex-1 overflow-hidden">
            {loading && <Loader2 className=" animate-spin" />}
            {currentProvider && renderProviderCard(currentProvider)}

            <span className="text-ellipsis overflow-hidden">
              {currentProvider?.name || "Select a provider"}
            </span>
          </span>

          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="p-0 overflow-hidden max-w-[50vw]"
        style={{
          minWidth: "var(--radix-popover-trigger-width)",
        }}
      >
        <Command
          filter={(id, search) => {
            if (!search) return 1;

            const provider = providers.find((p) => p.id === id);
            if (!provider) return 0;

            const { startsWith, includes } = getProviderScore(provider, search);
            return startsWith || includes ? 1 : 0;
          }}
        >
          <CommandInput placeholder="Search provider..." className="h-9" />
          <CommandList className="max-h-[30vh]">
            <CommandEmpty>No provider found.</CommandEmpty>

            {suggestedProviders.length > 0 && (
              <CommandGroup heading="Suggested providers">
                {suggestedProviders.map(renderProvider)}
              </CommandGroup>
            )}

            {providers.length > 0 && (
              <CommandGroup heading={`Providers (${providers.length})`}>
                {providers.map(renderProvider)}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
