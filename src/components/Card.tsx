"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode"; // Import QRCode library
import { motion } from "framer-motion";
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

export interface CardProps extends CardType {
  onDeleteCard?: (id: CardType["id"]) => Promise<void>;
  onEditCard?: () => void;
  onAddToWallet?: (id: CardType["id"]) => void;
  onShare?: (id: CardType["id"]) => void;
}

export function Card({
  name,
  logo,
  theme,
  code,
  id,
  onDeleteCard,
  onEditCard,
  onAddToWallet,
  onShare,
}: CardProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false); // Manage dialog open state
  const [isDeleting, setIsDeleting] = useState(false); // Manage delete action state
  const [codeDataUrl, setCodeDataUrl] = useState<string | null>(null); // Store the code as a Base64 image URL

  const hasActions = onEditCard || onDeleteCard || onAddToWallet || onShare; // Check if any actions are available

  // Generate the code as a Base64 image URL
  useEffect(() => {
    const generateCode = async () => {
      const parsedCode = code.replace(/[^a-zA-Z0-9]/g, "");

      // Check if the code is not empty
      if (!parsedCode) {
        setCodeDataUrl(null);
        return;
      }

      if (parsedCode.length > 26) {
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
  }, [code]);

  const handleDelete = async () => {
    if (!onDeleteCard) return; // If no delete function is provided, do nothing

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
            className="relative w-64 h-40 cursor-pointer"
            onClick={() => setIsFlipped(!isFlipped)} // Toggle flip state on click
          >
            {/* Card Inner */}
            <div
              className={`absolute inset-0 transition-transform duration-500`}
              style={{
                transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)", // Rotate based on flip state
                transformStyle: "preserve-3d", // Enable 3D transform
              }}
            >
              {/* Front Side */}
              <div
                className="absolute inset-0 flex flex-col gap-2 items-center justify-center rounded-lg shadow-lg backface-hidden"
                style={{
                  backgroundColor: theme,
                }}
              >
                {logo ? (
                  <Image
                    src={logo}
                    width={128}
                    height={128}
                    alt="Card Logo"
                    className="h-16 w-16 object-contain"
                  />
                ) : (
                  <span className="text-neutral-950 text-lg font-bold">
                    No Logo
                  </span>
                )}
                <span className="text-sm text-slate-950 text-center w-full">
                  {name.trim().length > 1 ? name : "N/A"}
                </span>
              </div>

              {/* Back Side */}
              <div
                className="absolute inset-0 flex flex-col gap-2 px-2 items-center justify-center rounded-lg shadow-lg backface-hidden transform rotate-y-180"
                style={{
                  backgroundColor: theme,
                }}
              >
                {logo ? (
                  <Image
                    src={logo}
                    width={128}
                    height={128}
                    alt="Card Logo"
                    className="h-6 w-6 object-contain"
                  />
                ) : (
                  <span className="text-neutral-950 text-sm font-bold">
                    No Logo
                  </span>
                )}

                {/* Code (Barcode or QR Code) */}
                <div className="flex flex-col bg-white rounded-md p-2 overflow-hidden w-full gap-2">
                  {codeDataUrl != null && (
                    <Image
                      width={128}
                      height={128}
                      src={codeDataUrl}
                      alt="Code"
                      className="h-16 w-full object-contain"
                    />
                  )}

                  <span className="text-sm text-slate-950 font-mono text-center w-full truncate">
                    {code.trim().length > 1 ? name : "N/A"}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </ContextMenuTrigger>

        {hasActions && (
          <ContextMenuContent className="bg-neutral-50 rounded-md shadow-md p-2">
            {onEditCard && (
              <ContextMenuItem onClick={onEditCard}>Edit</ContextMenuItem>
            )}
            {onDeleteCard && (
              <ContextMenuItem onClick={() => setIsDialogOpen(true)}>
                Delete
              </ContextMenuItem>
            )}

            {(onEditCard || onDeleteCard) && (onAddToWallet || onShare) && (
              <ContextMenuSeparator />
            )}

            {onAddToWallet && (
              <ContextMenuItem onClick={() => onAddToWallet(id)}>
                <WalletCards />
                Add to Apple Wallet
              </ContextMenuItem>
            )}
            {onShare && (
              <ContextMenuItem onClick={() => onShare(id)}>
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
            <AlertDialogCancel onClick={() => setIsDialogOpen(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
