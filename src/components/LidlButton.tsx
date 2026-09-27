"use client";

import Image from "next/image";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import Lidl from "@/images/lidl.svg";
import { cn } from "@/lib/utils";

type LidlButtonProps = {
  children?: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  variant?: "connect" | "unlink";
};

const YELLOW = { backgroundColor: "#fff000", color: "#0E0E0F" } as const;

/**
 * Social-auth style Lidl control — “Se connecter avec” + wordmark.
 */
export function LidlButton({
  children,
  onClick,
  type = "button",
  disabled,
  loading,
  className,
  variant = "connect",
}: LidlButtonProps) {
  const isUnlink = variant === "unlink";

  return (
    <Button
      type={type}
      variant={isUnlink ? "outline" : "secondary"}
      onClick={onClick}
      disabled={disabled || loading}
      style={isUnlink ? undefined : YELLOW}
      className={cn(
        "gap-1.5 justify-center disabled:opacity-100",
        className,
      )}
    >
      {loading && <Loader2 className="size-4 animate-spin shrink-0" />}
      {!isUnlink && (children ?? "Se connecter avec")}
      {isUnlink && (children ?? "Dissocier")}
      <Image src={Lidl} alt="" className="h-3 w-fit shrink-0" aria-hidden />
    </Button>
  );
}
