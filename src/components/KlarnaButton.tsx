"use client";

import Image from "next/image";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import Klarna from "@/images/klarna.svg";
import { cn } from "@/lib/utils";

type KlarnaButtonProps = {
  children?: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  href?: string;
  /** Social-login style: connect (pink) or unlink (outline). */
  variant?: "connect" | "unlink";
};

const PINK = { backgroundColor: "#ffa8cd", color: "#0E0E0F" } as const;

/**
 * Social-auth style Klarna control — “Continue with Klarna” / “Unlink Klarna”.
 */
export function KlarnaButton({
  children,
  onClick,
  type = "button",
  disabled,
  loading,
  className,
  href,
  variant = "connect",
}: KlarnaButtonProps) {
  const isUnlink = variant === "unlink";

  const content = (
    <>
      {loading && <Loader2 className="size-4 animate-spin shrink-0" />}
      {!isUnlink && (children ?? "Se connecter avec")}
      {isUnlink && (children ?? "Dissocier")}
      <Image
        src={Klarna}
        alt=""
        className="h-3 w-fit shrink-0"
        aria-hidden
      />
    </>
  );

  if (href) {
    return (
      <Button
        asChild
        type="button"
        variant={isUnlink ? "outline" : "secondary"}
        disabled={disabled || loading}
        style={isUnlink ? undefined : PINK}
        className={cn("gap-1.5 justify-center", className)}
      >
        <a href={href} target="_blank" rel="noreferrer">
          {content}
        </a>
      </Button>
    );
  }

  return (
    <Button
      type={type}
      variant={isUnlink ? "outline" : "secondary"}
      onClick={onClick}
      disabled={disabled || loading}
      style={isUnlink ? undefined : PINK}
      className={cn("gap-1.5 justify-center", className)}
    >
      {content}
    </Button>
  );
}
