"use client";

import { useEffect, useMemo, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import type { Card as CardType } from "@/lib/types";

export function ExportModal({
  cards,
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
  cards?: CardType[];
}) {
  const handleClose = () => {
    onClose();
  };

  const formattedCard = useMemo(() => {
    if (!cards) return "";
    return JSON.stringify(cards, null, 2);
  }, [cards]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.select();
        }
      }, 0);
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="flex flex-col p-0 overflow-hidden bg-background text-foreground gap-0 max-h-[90vh]">
        <DialogHeader className="p-4 border-b shrink-0">
          <DialogTitle className="text-foreground">Share Cards</DialogTitle>
          <DialogDescription className="text-foreground">
            Copy the JSON data below and share it with your friends. They can
            import it into their own Pockett app.
          </DialogDescription>
        </DialogHeader>

        <div className="flex overflow-auto space-y-4 p-4 h-[60vh]">
          <Textarea
            ref={textareaRef}
            className="w-full"
            readOnly
            value={formattedCard}
          />
        </div>

        <DialogFooter className="p-4 border-t shrink-0">
          <Button type="button" onClick={handleClose} variant="default">
            Ok
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
