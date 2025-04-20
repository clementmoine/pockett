"use client";

import Image from "next/image";
import { useState, useEffect, useMemo } from "react";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";
import { motion } from "framer-motion";
import color from "color";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
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
import type { Card as CardType } from "@/lib/types";
import { Share, WalletCards } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CardProps extends CardType {
  onDeleteCard?: (id: CardType["id"]) => Promise<void>;
  onEditCard?: () => void;
  onAddToWallet?: (id: CardType["id"]) => void;
  onShareCard?: (id: CardType["id"]) => void;
}

export function Card({
  name,
  logo,
  color: cardColor,
  code,
  type,
  id,
  onDeleteCard,
  onEditCard,
  onAddToWallet,
  onShareCard,
}: CardProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [codeDataUrl, setCodeDataUrl] = useState<string | null>(null);

  const hasActions = onEditCard || onDeleteCard || onAddToWallet || onShareCard;

  const [isOffline, setIsOffline] = useState(!navigator.onLine);

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

  // Generate the code as a Base64 image URL
  useEffect(() => {
    const generateCode = async () => {
      const parsedCode = code.replace(/[^a-zA-Z0-9]/g, "");

      if (!parsedCode) {
        setCodeDataUrl(null);
        return;
      }

      if ((type == "auto" && parsedCode.length > 26) || type == "qr") {
        // Use QR code for larger data
        const qrCodeUrl = await QRCode.toDataURL(parsedCode, {
          width: 128,
          margin: 1,
        });
        setCodeDataUrl(qrCodeUrl);
      } else {
        // Use barcode for smaller data
        const canvas = document.createElement("canvas");
        JsBarcode(canvas, parsedCode, {
          lineColor: "#000",
          width: 2,
          height: 100,
          displayValue: false,
        });
        setCodeDataUrl(canvas.toDataURL("image/png"));
      }
    };

    generateCode();
  }, [code, type]);

  const handleDelete = async () => {
    if (!onDeleteCard) return;

    setIsDeleting(true);
    try {
      await onDeleteCard(id);
      setIsDialogOpen(false);
    } catch (error) {
      console.error("Failed to delete card:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger disabled={!hasActions}>
          <motion.div
            className="relative w-full cursor-pointer select-none"
            style={{
              aspectRatio: "1.61792 / 1",
            }}
            onClick={() => setIsFlipped(!isFlipped)} // Toggle flip state on click
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
                className="absolute inset-0 flex flex-col gap-2 items-center justify-center rounded-xl shadow-lg backface-hidden"
                style={{
                  backgroundColor: cardColor || "#FFF",
                }}
              >
                {logo ? (
                  <Image
                    src={logo}
                    width={128}
                    height={128}
                    alt="Card Logo"
                    className="h-1/2 w-1/2 object-contain"
                  />
                ) : (
                  <span className={`text-lg font-bold ${textColor}`}>
                    No Logo
                  </span>
                )}
                <span className={`text-sm text-center w-full ${textColor}`}>
                  {name.trim().length > 1 ? name : "N/A"}
                </span>
              </div>

              {/* Back Side */}
              <div
                className="absolute inset-0 flex flex-col gap-2 p-2 items-center rounded-xl shadow-lg backface-hidden transform rotate-y-180"
                style={{
                  backgroundColor: cardColor || "#FFF",
                }}
              >
                {logo ? (
                  <Image
                    src={logo}
                    width={128}
                    height={128}
                    alt="Card Logo"
                    className="h-2 w-auto shrink-0 object-contain"
                  />
                ) : (
                  <span className={`text-sm font-bold ${textColor}`}>
                    No Logo
                  </span>
                )}

                {/* Code (Barcode or QR Code) */}
                <div className="flex flex-col bg-background rounded-md p-2 overflow-hidden w-full h-full gap-2">
                  {codeDataUrl != null ? (
                    <Image
                      width={128}
                      height={64}
                      src={codeDataUrl}
                      alt="Code"
                      className={cn("w-full h-full overflow-hidden", {
                        "object-contain": type == "qr",
                      })}
                    />
                  ) : (
                    <div className="h-16 w-full" />
                  )}

                  {type !== "qr" && (
                    <span className="text-sm text-foreground font-mono text-center w-full shrink-0 truncate">
                      {code.trim().length > 1 ? code : "N/A"}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </ContextMenuTrigger>

        {hasActions && (
          <ContextMenuContent className="rounded-md shadow-md p-2">
            {onEditCard && (
              <ContextMenuItem onClick={onEditCard}>Edit</ContextMenuItem>
            )}
            {onDeleteCard && (
              <ContextMenuItem onClick={() => setIsDialogOpen(true)}>
                Delete
              </ContextMenuItem>
            )}

            {(onEditCard || onDeleteCard) && (onAddToWallet || onShareCard) && (
              <ContextMenuSeparator />
            )}

            {onAddToWallet && (
              <ContextMenuItem
                disabled={isOffline}
                onClick={() => onAddToWallet(id)}
              >
                <WalletCards />
                Add to Wallet
              </ContextMenuItem>
            )}
            {onShareCard && (
              <ContextMenuItem
                disabled={isOffline}
                onClick={() => onShareCard(id)}
              >
                <Share />
                Share
              </ContextMenuItem>
            )}
          </ContextMenuContent>
        )}
      </ContextMenu>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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
