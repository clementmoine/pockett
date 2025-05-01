"use client";

import { z } from "zod";
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

import type { Card } from "@/lib/types";

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
  onImport: (cards: Card[]) => Promise<void>;
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(importSchema),
    defaultValues: {
      json: "",
    },
  });

  const { reset } = form;

  const handleSubmit = async (values: FormValues) => {
    const cards = JSON.parse(values.json);
    if (!Array.isArray(cards)) {
      alert("Invalid JSON format. Please provide an array of cards.");
      return;
    }

    onImport(cards);
    handleClose();
  };

  const handleClose = () => {
    reset();
    onClose();
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
