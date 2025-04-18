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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { v4 as uuidv4 } from "uuid";
import { createHash } from "crypto";
import color from "color";
import { ColorPicker } from "./ColorPicker";

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
      (file) =>
        file instanceof File ||
        file === null ||
        (typeof file === "string" &&
          /^data:image\/[a-zA-Z]+;base64,[^\s]+$/.test(file)),
      "Invalid file type",
    ),
  theme: z
    .string()
    .trim()
    .min(1, "Theme is required")
    .refine((value) => {
      try {
        color(value);
        return true;
      } catch {
        return false;
      }
    }, "Invalid color format"),
  barcodeType: z.enum(["auto", "qr", "barcode"]).default("auto"),
});

type CardFormValues = z.infer<typeof cardSchema>;

const generateNumericId = () => {
  const uuid = uuidv4();
  const hash = createHash("sha256").update(uuid).digest("hex");
  return parseInt(hash.slice(0, 12), 16);
};

const convertFileToBase64 = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
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
  onEditCard?: (card: CardType) => Promise<void>;
  card?: CardType;
}) {
  const [logoPreview, setLogoPreview] = useState<string | null>(
    card?.logo || null,
  );

  const form = useForm({
    resolver: zodResolver(cardSchema),
    defaultValues: {
      name: "",
      code: "",
      logo: null,
      theme: "",
      barcodeType: "auto",
    },
  });

  const { reset } = form;

  // Update form values and logo preview when the `card` prop changes
  useEffect(() => {
    if (card) {
      reset({
        name: card.name || "",
        code: card.code || "",
        logo: card.logo || null,
        theme: card.theme || "",
        barcodeType: card.barcodeType || "",
      });
      setLogoPreview(card.logo || null);
    } else {
      reset({
        name: "",
        code: "",
        logo: null,
        theme: "",
        barcodeType: "auto",
      });
      setLogoPreview(null);
    }
  }, [card, reset]);

  const handleLogoChange = async (file: File | null) => {
    if (file) {
      try {
        const base64 = await convertFileToBase64(file);
        setLogoPreview(base64);
      } catch (error) {
        console.error("Error converting file to base64:", error);
        setLogoPreview(null);
      }
    } else {
      setLogoPreview(null);
    }
  };

  const handleSubmit = async (values: CardFormValues) => {
    let logo: string | null = values.logo;
    if (values.logo && values.logo instanceof File) {
      logo = await convertFileToBase64(values.logo);
    }

    const updatedCard: CardType = {
      barcodeType: values.barcodeType,
      id: card ? card.id : generateNumericId(),
      name: values.name,
      code: values.code,
      logo: logo,
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
    reset();
    setLogoPreview(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="p-0 overflow-hidden bg-background text-foreground gap-0">
        <DialogHeader className="p-4 border-b">
          <DialogTitle className="text-foreground">
            {card ? "Edit Card" : "Add a New Card"}
          </DialogTitle>
          <DialogDescription className="text-foreground">
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
                {/* Card preview */}
                <div className="flex justify-center">
                  <Tabs
                    value={form.watch("barcodeType")}
                    defaultValue={form.watch("barcodeType")}
                    onValueChange={(value) =>
                      form.setValue(
                        "barcodeType",
                        value as "auto" | "qr" | "barcode",
                      )
                    }
                  >
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="auto">Auto</TabsTrigger>
                      <TabsTrigger value="qr">QR Code</TabsTrigger>
                      <TabsTrigger value="barcode">Barcode</TabsTrigger>
                    </TabsList>
                    <TabsContent value="auto">
                      <Card
                        id={-1}
                        barcodeType="auto"
                        name={form.watch("name")}
                        theme={form.watch("theme")}
                        logo={logoPreview || null}
                        code={form.watch("code")}
                      />
                    </TabsContent>
                    <TabsContent value="qr">
                      <Card
                        id={-1}
                        barcodeType="qr"
                        name={form.watch("name")}
                        theme={form.watch("theme")}
                        logo={logoPreview || null}
                        code={form.watch("code")}
                      />
                    </TabsContent>
                    <TabsContent value="barcode">
                      <Card
                        id={-1}
                        barcodeType="barcode"
                        name={form.watch("name")}
                        theme={form.watch("theme")}
                        logo={logoPreview || null}
                        code={form.watch("code")}
                      />
                    </TabsContent>
                  </Tabs>
                </div>

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground">Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter card name"
                          className="bg-background text-foreground"
                          {...field}
                        />
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
                      <FormLabel className="text-foreground">Logo</FormLabel>
                      <FormControl>
                        <Input
                          type="file"
                          className="bg-background text-foreground"
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
                      <FormLabel className="text-foreground">Theme</FormLabel>
                      <FormControl>
                        <ColorPicker
                          placeholder="Choose a color"
                          className="bg-background text-foreground"
                          {...field}
                        />
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
                      <FormLabel className="text-foreground">Code</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter card code"
                          className="bg-background text-foreground"
                          {...field}
                        />
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
              <Button variant="default">
                {card ? "Save Changes" : "Add Card"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
