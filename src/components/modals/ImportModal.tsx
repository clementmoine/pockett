"use client";

import { z } from "zod";
import { toast } from "sonner";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";

import Klarna from "@/images/klarna.svg";
import Image from "next/image";

import type { Card } from "@prisma/client";

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

export function ImportModal({
  isOpen,
  onClose,
  onImport,
}: {
  isOpen: boolean;
  onClose: () => void;
  onImport: (cards: Card[], ignoreExisting?: boolean) => Promise<void>;
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(importSchema),
    defaultValues: {
      json: "",
    },
  });

  const { reset } = form;

  const [loading, setLoading] = useState(false); // Manage loading state

  const handleSubmit = async (values: FormValues) => {
    const cards = JSON.parse(values.json);
    if (!Array.isArray(cards)) {
      toast.error("Invalid JSON format. Please provide an array of cards.");
      return;
    }

    onImport(cards);
    handleClose();
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const importFromKlarna = async () => {
    try {
      setLoading(true);

      const response = await fetch("/api/klarna/cards");

      if (!response.ok) {
        throw new Error("Failed to fetch cards from Klarna");
      }

      const data = await response.json();
      if (Array.isArray(data)) {
        onImport(data, true);
        handleClose();
      } else {
        toast.error("Invalid data format from Klarna");
      }
    } catch (error) {
      console.log("Error importing data from Klarna", error);
      toast.error("Error importing data from Klarna");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="flex flex-col p-0 overflow-hidden bg-background text-foreground gap-0 max-h-[90vh]">
        <DialogHeader className="p-4 border-b shrink-0">
          <DialogTitle className="text-foreground">Import cards</DialogTitle>
          <DialogDescription className="text-foreground">
            Paste the JSON data of the cards you want to import.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="flex flex-col overflow-hidden"
          >
            <div className="max-h-[60vh] overflow-auto space-y-4 p-4">
              <FormField
                control={form.control}
                name="json"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">JSON</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Paste card data here..."
                        className="w-full h-40 p-2 border rounded bg-background text-foreground"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="p-4 border-t shrink-0">
              <Button
                type="button"
                variant="secondary"
                onClick={importFromKlarna}
                style={{
                  backgroundColor: "#ffa8cd",
                  color: "#0E0E0F",
                }}
                className="sm:mr-auto"
                disabled={loading}
              >
                {loading && <Loader2 className=" animate-spin" />}
                Import from
                <Image src={Klarna} alt="Klarna" className="h-3 w-fit" />
              </Button>
              <Button type="button" onClick={handleClose} variant="secondary">
                Cancel
              </Button>

              <Button type="submit" variant="default">
                Import cards
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
