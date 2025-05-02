"use client";

import { z } from "zod";
import { toast } from "sonner";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { ClipboardCopy } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";

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
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  Form,
} from "@/components/ui/form";

import type { Card as CardType } from "@/types/card";

const importSchema = z.object({
  json: z
    .string()
    .trim()
    .min(1, { message: "JSON data is required" })
    .refine(
      (data) => {
        try {
          const parsed = JSON.parse(data);
          return Array.isArray(parsed);
        } catch {
          return false;
        }
      },
      {
        message: "Invalid JSON format or not an array of cards",
      },
    ),
});

type FormValues = z.infer<typeof importSchema>;

export function ExportModal({
  cards,
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
  cards?: CardType[];
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(importSchema),
    defaultValues: {
      json: "",
    },
  });

  const { reset, getValues } = form;

  const handleClose = () => {
    reset();
    onClose();
  };

  const copyToClipboard = async (textToCopy: string) => {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(textToCopy);
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = textToCopy;
      textArea.style.position = "absolute";
      textArea.style.left = "-999999px";
      document.body.prepend(textArea);
      textArea.select();

      try {
        document.execCommand("copy");
      } catch (error) {
        console.error("Failed to copy text: ", error);
      } finally {
        textArea.remove();
      }
    }
  };

  const handleCopyToClipboard = async () => {
    const json = getValues("json");
    try {
      await copyToClipboard(json);
      toast.success(
        `${cards?.length ?? 0} card${(cards?.length ?? 0) > 1 ? "s" : ""} copied to clipboard`,
      );
    } catch (err) {
      console.error("Could not copy text: ", err);
      toast.error("Failed to copy to clipboard");
    }
  };

  useEffect(() => {
    if (cards) {
      const formattedCard = JSON.stringify(cards, null, 2);
      reset({ json: formattedCard });
      setTimeout(() => {
        const textarea = document.querySelector("textarea");
        if (textarea) {
          textarea.select();
        }
      }, 0);
    }
  }, [isOpen, cards, reset]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="flex flex-col p-0 overflow-hidden bg-background text-foreground gap-0 max-h-[90vh]">
        <DialogHeader className="p-4 border-b shrink-0">
          <DialogTitle className="text-foreground">Share cards</DialogTitle>
          <DialogDescription className="text-foreground">
            Copy the JSON data below and share it with your friends. They can
            import it into their own Pockett app.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form className="flex flex-col overflow-hidden">
            <div className="max-h-[60vh] overflow-auto space-y-4 p-4">
              <FormField
                name="json"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel className="text-foreground">JSON</FormLabel>
                      <Button
                        type="button"
                        onClick={handleCopyToClipboard}
                        variant="link"
                      >
                        <ClipboardCopy />
                        Copy to clipboard
                      </Button>
                    </div>
                    <FormControl>
                      <Textarea
                        placeholder="Paste card data here..."
                        className="w-full h-40 p-2 border rounded bg-background text-foreground"
                        {...field}
                        readOnly
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="p-4 border-t shrink-0">
              <Button type="button" onClick={handleClose} variant="default">
                Ok
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
