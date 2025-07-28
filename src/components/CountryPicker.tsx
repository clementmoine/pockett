"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

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

import { cn } from "@/lib/utils";
import { Country } from "@prisma/client";

export function CountryPicker({
  value,
  showLabel = true,
  onChange,
}: {
  value?: string;
  showLabel?: boolean;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const countries = useMemo(() => {
    return Object.values(Country)
      .map((code) => ({
        code,
        name: new Intl.DisplayNames(["en"], { type: "region" }).of(code)!,
        flag: `https://flagcdn.com/${code.toLowerCase()}.svg`,
      }))
      .sort((a, b) => {
        return a.name.localeCompare(b.name);
      });
  }, []);

  const currentCountry = useMemo(() => {
    return countries.find((country) => country.code === value);
  }, [countries, value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded="false"
          className={cn("flex overflow-hidden w-full justify-between", {
            "!text-muted-foreground": !currentCountry,
          })}
        >
          <span className="flex items-center gap-2 shrink-0 flex-1 overflow-hidden">
            {currentCountry?.flag && (
              <Image
                src={currentCountry.flag}
                alt={currentCountry.name}
                width={20}
                height={20}
                className="shrink-0"
              />
            )}

            {showLabel && (
              <>
                <span className="text-ellipsis overflow-hidden hidden sm:block">
                  {currentCountry?.name || "Select a country"}
                </span>
                <span className="text-ellipsis overflow-hidden block sm:hidden">
                  {currentCountry?.code || "Country"}
                </span>
              </>
            )}
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
          filter={(code, search) => {
            if (!search) return 1;

            const country = countries.find((c) => c.code === code);

            if (!country) return 0;

            const normalizedCountryCode = country?.code
              .trim()
              .toLowerCase()
              .normalize("NFD")
              .replace(/\s+/g, " ")
              .replace(/[\u0300-\u036f]/g, "");

            const normalizedCountryName = country?.name
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

            return normalizedCountryName.includes(normalizedSearch) ||
              normalizedCountryCode.includes(normalizedSearch)
              ? 1
              : 0;
          }}
        >
          <CommandInput placeholder="Search..." className="h-9" />
          <CommandList className="max-h-[30vh]">
            <CommandEmpty>No country found.</CommandEmpty>
            <CommandGroup>
              {countries.map((country) => (
                <CommandItem
                  key={country.code}
                  value={country.code}
                  onSelect={(currentValue) => {
                    onChange(currentValue);
                    setOpen(false);
                  }}
                >
                  {country.flag && (
                    <Image
                      src={country.flag}
                      alt={country.name}
                      width={20}
                      height={20}
                      className="shrink-0"
                    />
                  )}
                  {country.name}
                  <Check
                    className={cn(
                      "ml-auto",
                      value === country.code ? "opacity-100" : "opacity-0",
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
