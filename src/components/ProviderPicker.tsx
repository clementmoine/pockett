"use client";

import leven from "leven";
import { toast } from "sonner";
import Image from "next/image";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

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

import type { Provider } from "@/types/provider";

import { cn } from "@/lib/utils";

export function ProviderPicker({
  value,
  onChange,
  suggestFrom,
  countryCode = "FR",
}: {
  value?: Provider["provider_id"];
  suggestFrom?: string;
  onChange: (id: Provider["provider_id"], provider: Provider) => void;
  countryCode?: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [providers, setProviders] = useState<Provider[]>([]);

  const suggestedProviders = useMemo<Provider[]>(() => {
    if (!suggestFrom || value) return [];

    const normalizedSuggest = suggestFrom
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/\s+/g, " ")
      .replace(/[\u0300-\u036f]/g, "");

    return providers
      .map((provider) => {
        const normalizedName = provider.provider_name
          .trim()
          .toLowerCase()
          .normalize("NFD")
          .replace(/\s+/g, " ")
          .replace(/[\u0300-\u036f]/g, "");

        const normalizedTerms = (provider.search_terms || []).map((term) =>
          term
            .trim()
            .toLowerCase()
            .normalize("NFD")
            .replace(/\s+/g, " ")
            .replace(/[\u0300-\u036f]/g, ""),
        );

        const startsWith =
          normalizedName.startsWith(normalizedSuggest) ||
          normalizedTerms.some((term) => term.startsWith(normalizedSuggest));

        const includes =
          !startsWith &&
          (normalizedName.includes(normalizedSuggest) ||
            normalizedTerms.some((term) => term.includes(normalizedSuggest)));

        const distance = Math.min(
          leven(normalizedName, normalizedSuggest),
          ...normalizedTerms.map((term) => leven(term, normalizedSuggest)),
        );

        return {
          ...provider,
          _distance: distance,
          _startsWith: startsWith,
          _includes: includes,
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
    (provider: Provider) => (
      <span
        className="flex rounded w-8 items-center justify-center p-1 border overflow-hidden"
        style={{
          aspectRatio: "1.61792 / 1",
          backgroundColor: provider.visual.color,
        }}
      >
        {provider.visual.logo_url && (
          <Image
            src={provider.visual.logo_url}
            alt={provider.provider_name}
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
    (provider: Provider) => (
      <CommandItem
        key={provider.provider_id}
        value={provider.provider_id}
        onSelect={(currentValue) => {
          const provider = providers.find(
            (p) => p.provider_id === currentValue,
          );
          onChange(currentValue, provider!);
          setOpen(false);
        }}
      >
        {renderProviderCard(provider)}

        <span>{provider.provider_name}</span>

        <Check
          className={cn(
            "ml-auto",
            value === provider.provider_id ? "opacity-100" : "opacity-0",
          )}
        />
      </CommandItem>
    ),
    [onChange, providers, renderProviderCard, value],
  );

  const currentProvider = useMemo(() => {
    return providers.find((provider) => provider.provider_id === value);
  }, [providers, value]);

  useEffect(() => {
    setLoading(true);

    // Fetch the list of providers (generated from the API)
    fetch(`/api/klarna/providers?country=${countryCode}`)
      .then((response) => {
        if (!response.ok) {
          return response.json().then((err) => {
            throw new Error(err.error || "Failed to fetch providers");
          });
        }
        return response.json();
      })
      .then((data) => data as Provider[])
      .then((providers) =>
        providers
          .filter((provider) => provider.markets.includes(countryCode))
          .sort((a, b) => a.provider_name.localeCompare(b.provider_name)),
      )
      .then((providers) => {
        setProviders(providers);
      })
      .catch((error) => {
        console.error("Error generating pass:", error);
        toast.error("Failed to fetch providers");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [countryCode]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          disabled={loading}
          aria-expanded="false"
          className={cn("w-full justify-between", {
            "!text-muted-foreground": !currentProvider,
          })}
        >
          <span className="flex items-center gap-2">
            {loading && <Loader2 className=" animate-spin" />}
            {currentProvider && renderProviderCard(currentProvider)}

            <span className="text-ellipsis overflow-hidden">
              {currentProvider?.provider_name || "Select a provider"}
            </span>
          </span>

          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="p-0 overflow-hidden"
        style={{
          width: "var(--radix-popover-trigger-width)",
        }}
      >
        <Command
          filter={(id, search) => {
            if (!search) {
              return 1;
            }

            const provider = providers.find(
              (provider) => provider.provider_id === id,
            ) as Provider;

            const normalizedValue = provider.provider_name
              .trim()
              .toLowerCase()
              .normalize("NFD")
              .replace(/\s+/g, " ")
              .replace(/[\u0300-\u036f]/g, "");
            const normalizedSearch = search
              .trim()
              .toLowerCase()
              .normalize("NFD")
              .replace(/\s+/g, " ")
              .replace(/[\u0300-\u036f]/g, "");

            return normalizedValue.includes(normalizedSearch) ? 1 : 0;
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
