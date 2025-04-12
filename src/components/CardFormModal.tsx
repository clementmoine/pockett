"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import type { Card as CardType } from "@/lib/types";
import { Card } from "@/components/Card";
import { convertToBase64 } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { v4 as uuidv4 } from "uuid";
import { createHash } from "crypto"; // Import crypto for hashing

const cardSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .refine((value) => value.trim().length > 0, "Name cannot be empty spaces"),
  code: z
    .string()
    .trim()
    .min(1, "Code is required")
    .refine((value) => value.trim().length > 0, "Code cannot be empty spaces"),
  logo: z
    .any()
    .refine(
      (file) => file instanceof File || file === null,
      "Invalid file type",
    ),
  theme: z
    .string()
    .trim()
    .min(1, "Theme is required")
    .refine((value) => value.trim().length > 0, "Theme cannot be empty spaces"),
});

type CardFormValues = z.infer<typeof cardSchema>;

const generateNumericId = () => {
  const uuid = uuidv4(); // Generate a UUID
  const hash = createHash("sha256").update(uuid).digest("hex"); // Hash the UUID
  return parseInt(hash.slice(0, 12), 16); // Convert a portion of the hash to a number
};

export function CardFormModal({
  isOpen,
  onClose,
  onAddCard,
  onEditCard,
  card,
}: {
  isOpen: boolean;
  onClose: () => void;
  onAddCard: (card: CardType) => Promise<void>;
  onEditCard?: (card: CardType) => Promise<void>; // Optional for editing
  card?: CardType; // Optional card to edit
}) {
  const [logoPreview, setLogoPreview] = useState<string | null>(
    card?.logo || null,
  );

  const form = useForm<CardFormValues>({
    resolver: zodResolver(cardSchema),
    defaultValues: {
      name: "",
      code: "",
      logo: null,
      theme: "",
    },
  });

  const { reset } = form;

  // Update form values and logo preview when the `card` prop changes
  useEffect(() => {
    if (card) {
      reset({
        name: card.name || "",
        code: card.code || "",
        logo: null, // File inputs cannot be pre-filled
        theme: card.theme || "",
      });
      setLogoPreview(card.logo || null);
    } else {
      reset({
        name: "",
        code: "",
        logo: null,
        theme: "",
      });
      setLogoPreview(null);
    }
  }, [card, reset]);

  const handleLogoChange = (file: File | null) => {
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setLogoPreview(null);
    }
  };

  const handleSubmit = async (values: CardFormValues) => {
    const logoBase64 = values.logo
      ? await convertToBase64(values.logo) // Convert the file to Base64
      : card?.logo || null;

    const updatedCard: CardType = {
      id: card ? card.id : generateNumericId(), // Generate a numeric ID if not editing
      name: values.name,
      code: values.code, // Use `code` instead of `id`
      logo: logoBase64, // Store as Base64
      theme: values.theme,
    };

    if (card && onEditCard) {
      // Editing an existing card
      await onEditCard(updatedCard);
    } else {
      // Adding a new card
      await onAddCard(updatedCard);
    }

    handleClose();
  };

  const handleClose = () => {
    reset(); // Reset the form when the modal is closed
    setLogoPreview(null); // Clear the logo preview
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="p-0 overflow-hidden">
        <DialogHeader className="p-4 border-b">
          <DialogTitle>{card ? "Edit Card" : "Add a New Card"}</DialogTitle>
          <DialogDescription>
            {card
              ? "Edit the details of your card."
              : "Fill in the details to create a new card."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="flex flex-col"
          >
            <ScrollArea className="max-h-[60vh] flex-grow">
              <div className="space-y-4 p-4">
                {/* Add spacing between fields */}
                {/* Title for preview section */}
                <h2 className="text-sm font-semibold">Card Preview</h2>
                {/* Card preview */}
                <div className="flex justify-center">
                  <Card
                    id={-1}
                    name={form.watch("name")}
                    theme={form.watch("theme")}
                    logo={logoPreview || null}
                    code={form.watch("code")} // Display the code
                  />
                </div>
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter card name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Code</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter card code" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="logo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Logo</FormLabel>
                      <FormControl>
                        <Input
                          type="file"
                          onChange={(e) => {
                            const file = e.target.files?.[0] || null;
                            field.onChange(file);
                            handleLogoChange(file);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="theme"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Theme</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter card theme" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </ScrollArea>

            <DialogFooter className="p-4 border-t">
              <Button type="button" onClick={handleClose} variant="secondary">
                Cancel
              </Button>
              <Button type="submit">
                {card ? "Save Changes" : "Add Card"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
