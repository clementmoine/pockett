"use client";

import Image from "next/image";
import React, { useState, useEffect, useMemo } from "react";
import JsBarcode from "jsbarcode";
import { toast } from "sonner";
import QRCode from "qrcode";
import {
  Share,
  WalletCards,
  Fullscreen,
  PenSquare,
  Trash2,
  Ellipsis,
  Loader2,
} from "lucide-react";
import { motion } from "framer-motion";
import color from "color";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

import type { Card as CardType } from "@prisma/client";

import { cn } from "@/lib/utils";
import {
  getProviderCodeHandler,
  providerHasDynamicCode,
} from "@/lib/provider-code";

export interface CardProps
  extends Omit<CardType, "updatedAt" | "createdAt" | "country" | "providerId"> {
  providerId?: string | null;
  onDeleteCard?: (id: CardType["id"]) => void;
  onEditCard?: () => void;
  onAddToWallet?: (id: CardType["id"]) => void;
  onShareCard?: (id: CardType["id"]) => void;
  flipped?: boolean;
  initialFlipped?: boolean;
  onFlip?: (flipped: boolean) => void;
  /** When true (fullscreen embed), never open another fullscreen dialog. */
  suppressFullscreen?: boolean;
}

/** Payload to encode: QR keeps raw text; barcodes stay alphanumeric-safe. */
function payloadForEncode(
  raw: string,
  cardType: CardType["type"],
): { value: string; asQr: boolean } {
  const trimmed = (raw || "").trim();
  if (!trimmed) return { value: "", asQr: false };

  const looksRich = /[^a-zA-Z0-9]/.test(trimmed);
  const asQr =
    cardType === "qr" ||
    (cardType === "auto" && (looksRich || trimmed.length > 26));

  if (asQr) return { value: trimmed, asQr: true };

  const alphanumeric = trimmed.replace(/[^a-zA-Z0-9]/g, "");
  return { value: alphanumeric, asQr: false };
}

type Action = {
  type: "action";
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
};

type Separator = { type: "separator" };

type ActionItem = Action | Separator;

export function Card({
  name,
  logo,
  color: cardColor,
  code,
  type,
  tag,
  id,
  providerId,
  flipped: externalFlipped,
  initialFlipped = false,
  onDeleteCard,
  onEditCard,
  onAddToWallet,
  onShareCard,
  onFlip,
  suppressFullscreen = false,
}: CardProps) {
  const [isFlipped, setIsFlipped] = useState(initialFlipped);
  const [liveCode, setLiveCode] = useState(() => {
    const handler = getProviderCodeHandler(providerId);
    if (handler?.remoteCode) {
      return handler.readyPayload?.(code) || "";
    }
    return handler?.liveCode?.(code) || code;
  });
  const [remoteLoading, setRemoteLoading] = useState(false);

  useEffect(() => {
    const handler = getProviderCodeHandler(providerId);
    if (handler?.remoteCode) {
      // Never encode the member id / session as a placeholder QR
      const ready = handler.readyPayload?.(code) || "";
      setLiveCode(ready);
      return;
    }
    const live = handler?.liveCode?.(code);
    setLiveCode(live || code);
  }, [code, providerId]);

  useEffect(() => {
    if (externalFlipped !== undefined) {
      setIsFlipped(externalFlipped);
    }
  }, [externalFlipped]);

  const handleFlip = () => {
    const newFlippedState = !isFlipped;
    if (externalFlipped === undefined) {
      setIsFlipped(newFlippedState);
    }
    onFlip?.(newFlippedState); // Ensure onFlip is called with the new state
  };

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false); // Separate state for delete dialog
  const [isFullScreenDialogOpen, setIsFullScreenDialogOpen] = useState(false); // Separate state for full-screen dialog
  const [isDeleting, setIsDeleting] = useState(false);
  const [codeDataUrl, setCodeDataUrl] = useState<string | null>(null);

  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // Dynamic codes: local regen and/or remote fetch while the card is shown
  useEffect(() => {
    if (!providerHasDynamicCode(providerId)) return;
    if (!isFlipped && !isFullScreenDialogOpen) return;

    const handler = getProviderCodeHandler(providerId);

    if (handler?.liveCode) {
      const tick = () => {
        const fresh = handler.liveCode?.(code);
        if (fresh) setLiveCode(fresh);
      };
      tick();
      const interval = window.setInterval(tick, 15_000);
      return () => window.clearInterval(interval);
    }

    if (!handler?.remoteCode || !id || id === "-1") return;

    let cancelled = false;
    const tick = async (isInitial: boolean) => {
      if (!navigator.onLine) {
        if (isInitial) setRemoteLoading(false);
        return;
      }
      if (isInitial && !handler.readyPayload?.(code)) {
        setRemoteLoading(true);
      }
      try {
        const res = await fetch(`/api/cards/${id}/code`);
        const data = (await res.json()) as {
          code?: string;
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok || !data.code) {
          toast.error(data.error || "Impossible de rafraîchir le QR");
          return;
        }
        setLiveCode(data.code);
      } catch {
        if (!cancelled) toast.error("Impossible de rafraîchir le QR");
      } finally {
        if (!cancelled) setRemoteLoading(false);
      }
    };
    void tick(true);
    const interval = window.setInterval(() => void tick(false), 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [code, providerId, id, isFlipped, isFullScreenDialogOpen]);

  const actions: ActionItem[] | undefined = useMemo(() => {
    if (!id || id == "-1") return undefined;
    if (suppressFullscreen) return undefined;

    const actionItems = [
      {
        type: "action",
        label: "Open",
        icon: <Fullscreen className="mr-2 size-4" />,
        onClick: () => setIsFullScreenDialogOpen(true),
        disabled: false,
      },
      { type: "separator" },
      onEditCard && {
        type: "action",
        label: "Edit",
        icon: <PenSquare className="mr-2 size-4" />,
        onClick: onEditCard,
        disabled: false,
      },
      onDeleteCard && {
        type: "action",
        label: "Delete",
        icon: <Trash2 className="mr-2 size-4" />,
        onClick: () => setIsDeleteDialogOpen(true),
        disabled: false,
      },
      { type: "separator" },
      onAddToWallet && {
        type: "action",
        label: "Add to Wallet",
        icon: <WalletCards className="mr-2 size-4" />,
        onClick: () => onAddToWallet(id),
        disabled: isOffline,
      },
      onShareCard && {
        type: "action",
        label: "Share",
        icon: <Share className="mr-2 size-4" />,
        onClick: () => onShareCard(id),
        disabled: isOffline,
      },
    ].filter(Boolean) as ActionItem[];

    return actionItems;
  }, [
    onEditCard,
    onDeleteCard,
    onAddToWallet,
    onShareCard,
    id,
    isOffline,
    suppressFullscreen,
  ]);

  useEffect(() => {
    const updateOnlineStatus = () => setIsOffline(!navigator.onLine);
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);
    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, []);

  // Calculate the highest contrast color (black or white) based on the background color
  const textColor = useMemo(() => {
    try {
      return color(cardColor || "#FFF").isLight() ? "text-black" : "text-white";
    } catch {
      return "text-black"; // Fallback to black if the color is invalid
    }
  }, [cardColor]);

  // Calculate the tag color
  const tagColor = useMemo(() => {
    return color(cardColor || "#FFF").isLight()
      ? "bg-black text-white"
      : "bg-white text-black";
  }, [cardColor]);

  // Generate the code as a Base64 image URL (QR = raw payload, no strip)
  useEffect(() => {
    const generateCode = async () => {
      const { value, asQr } = payloadForEncode(liveCode, type);

      if (!value) {
        setCodeDataUrl(null);
        return;
      }

      if (asQr) {
        const qrCodeUrl = await QRCode.toDataURL(value, {
          width: 256,
          margin: 1,
          errorCorrectionLevel: "M",
        });
        setCodeDataUrl(qrCodeUrl);
      } else {
        const canvas = document.createElement("canvas");
        JsBarcode(canvas, value, {
          lineColor: "#000",
          width: 2,
          height: 1,
          margin: 0,
          displayValue: false,
        });
        setCodeDataUrl(canvas.toDataURL("image/png"));
      }
    };

    void generateCode();
  }, [liveCode, type]);

  const handleDelete = async () => {
    if (!onDeleteCard) return;

    setIsDeleting(true);
    try {
      await onDeleteCard(id);
      setIsDeleteDialogOpen(false);
      toast.success(`${name} card deleted successfully`);
    } catch (error) {
      console.error("Failed to delete card:", error);
      toast.error("Failed to delete card");
    } finally {
      setIsDeleting(false);
    }
  };

  function splitCode(
    code: string,
    chunkSize?: number,
    separator: string = "\u00A0",
  ): string {
    if (!code || typeof code !== "string") {
      return "";
    }

    function determineOptimalChunkSize(code: string): number {
      if (code.length <= 9) {
        return 3;
      }

      return 4;
    }

    const cleanCode = code.replace(/\s/g, "");

    if (chunkSize === undefined) {
      chunkSize = determineOptimalChunkSize(cleanCode);
    }

    const remainder = cleanCode.length % chunkSize;

    if (remainder > 0) {
      const firstChunk = cleanCode.substring(0, remainder);
      const rest = cleanCode.substring(remainder);

      const chunks = [firstChunk];
      for (let i = 0; i < rest.length; i += chunkSize) {
        chunks.push(rest.substring(i, i + chunkSize));
      }

      return chunks.join(separator);
    } else {
      const chunks = [];
      for (let i = 0; i < cleanCode.length; i += chunkSize) {
        chunks.push(cleanCode.substring(i, i + chunkSize));
      }

      return chunks.join(separator);
    }
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger disabled={!actions}>
          <motion.div
            className="relative w-full select-none"
            style={{
              aspectRatio: "1.61792 / 1",
            }}
            onClick={handleFlip}
          >
            {/* Card Inner */}
            <div
              className={`absolute inset-0 transition-transform duration-500`}
              style={{
                transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
                transformStyle: "preserve-3d",
              }}
            >
              {/* Front Side */}
              <div
                className="absolute inset-0 flex flex-col gap-2 items-center justify-center overflow-hidden rounded-xl shadow-lg backface-hidden"
                style={{
                  backgroundColor: cardColor || "#FFF",
                }}
              >
                {logo ? (
                  <Image
                    src={logo}
                    width={128}
                    height={128}
                    alt={tag ? `${name} (${tag}) logo` : `${name} logo`}
                    unoptimized
                    className="size-1/2 object-contain select-none"
                    draggable={false}
                  />
                ) : (
                  <>
                    <span className={`text-lg font-bold ${textColor}`}>
                      No Logo
                    </span>
                    <span
                      className={`text-sm text-center w-full ${textColor} line-clamp-2 px-2`}
                    >
                      {name.trim().length > 1 ? name : "N/A"}
                    </span>
                  </>
                )}

                <Badge variant="default" className={`empty:hidden ${tagColor}`}>
                  {tag}
                </Badge>
              </div>

              {/* Back Side */}
              <div
                className="absolute inset-0 flex flex-col gap-2 p-2 items-center rounded-xl shadow-lg backface-hidden transform rotate-y-180 overflow-hidden"
                style={{
                  backgroundColor: cardColor || "#FFF",
                }}
              >
                <p
                  className={`text-sm text-center w-full whitespace-nowrap text-ellipsis overflow-hidden px-8 ${textColor}`}
                >
                  {name.trim().length > 1 ? name : "N/A"}
                </p>

                {actions && (
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="secondary"
                        className="absolute top-1 right-1 !p-0 !size-7 rounded-xl shadow"
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                      >
                        <Ellipsis />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      {actions?.map((action, index) =>
                        action.type === "separator" ? (
                          <DropdownMenuSeparator key={`separator-${index}`} />
                        ) : (
                          <DropdownMenuItem
                            key={index}
                            onClick={(e) => {
                              e.stopPropagation();
                              action.onClick();
                            }}
                            disabled={action.disabled}
                          >
                            {action.icon}
                            {action.label}
                          </DropdownMenuItem>
                        ),
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                {/* Code (Barcode or QR Code) */}
                <Button
                  disabled={!actions && !suppressFullscreen}
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (suppressFullscreen) {
                      handleFlip();
                      return;
                    }
                    setIsFullScreenDialogOpen(true);
                  }}
                  className="flex flex-1 !opacity-100 flex-col bg-white hover:!bg-white/90 rounded-md !px-[5%] !py-[5%] overflow-hidden w-full h-full gap-[10%]"
                >
                  <div className="flex flex-1 overflow-hidden size-full justify-center items-center">
                    {remoteLoading && !codeDataUrl ? (
                      <Loader2 className="size-8 animate-spin text-black/40" />
                    ) : null}
                    {codeDataUrl != null && (
                      <Image
                        width={128}
                        height={64}
                        src={codeDataUrl}
                        alt="Code"
                        className={cn(
                          "w-full h-full overflow-hidden select-none",
                          {
                            "object-contain":
                              payloadForEncode(liveCode, type).asQr,
                          },
                        )}
                        style={{
                          imageRendering: "pixelated",
                        }}
                        draggable={false}
                      />
                    )}
                  </div>

                  {(() => {
                    const caption = getProviderCodeHandler(providerId)?.caption?.(
                      code,
                      liveCode,
                    );
                    const asQr = payloadForEncode(liveCode, type).asQr;
                    if (caption) {
                      return (
                        <p className="text-sm leading-none text-black font-mono text-center w-full shrink-0 tracking-wider">
                          {caption}
                        </p>
                      );
                    }
                    if (!asQr) {
                      return (
                        <p className="text-sm leading-none text-black font-mono text-center w-full shrink-0 truncate">
                          {liveCode.trim().length > 1
                            ? splitCode(liveCode)
                            : "N/A"}
                        </p>
                      );
                    }
                    return null;
                  })()}
                </Button>
              </div>
            </div>
          </motion.div>
        </ContextMenuTrigger>

        {actions && (
          <ContextMenuContent className="rounded-md shadow-md p-2">
            {actions.map((action, index) =>
              action.type === "separator" ? (
                <ContextMenuSeparator key={`separator-${index}`} />
              ) : (
                <ContextMenuItem
                  key={index}
                  onClick={action.onClick}
                  disabled={action.disabled}
                >
                  {action.icon}
                  {action.label}
                </ContextMenuItem>
              ),
            )}
          </ContextMenuContent>
        )}
      </ContextMenu>

      {/* Full-Screen Dialog — nested card must not open another fullscreen */}
      {!suppressFullscreen ? (
        <Dialog
          open={isFullScreenDialogOpen}
          onOpenChange={setIsFullScreenDialogOpen}
        >
          <DialogContent
            showClose={false}
            className="p-0 rounded-xl bg-transparent border-none shadow-none outline-none"
          >
            <VisuallyHidden>
              <DialogHeader>
                <DialogTitle>{name}</DialogTitle>
              </DialogHeader>
            </VisuallyHidden>
            <Card
              id={id}
              name={name}
              logo={logo}
              color={cardColor}
              code={liveCode}
              type={type}
              tag={tag}
              providerId={providerId}
              initialFlipped={true}
              suppressFullscreen
            />
          </DialogContent>
        </Dialog>
      ) : null}

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this card? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-500 dark:bg-red-600 hover:bg-red-600 dark:hover:bg-red-800 text-white"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
