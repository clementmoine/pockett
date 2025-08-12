"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import color from "color";

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
import { Card } from "@/components/Card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ColorPicker } from "@/components/ColorPicker";
import { CountryPicker } from "@/components/CountryPicker";
import { ProviderPicker } from "@/components/ProviderPicker";

import { Card as CardType, Country } from "@prisma/client";
import type { ProviderWithVisual as ProviderType } from "@/types/provider";

import { cn } from "@/lib/utils";
import { getImgBackgroundColor } from "@/lib/getImgBackgroundColor";

const zodEnumFromPrisma = <T extends Record<string, string>>(prismaEnum: T) =>
  z.enum([...Object.values(prismaEnum)] as [T[keyof T], ...T[keyof T][]]);

const cardSchema = z.object({
  country: zodEnumFromPrisma(Country).optional(),
  providerId: z.string().trim().optional(),
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
        (typeof file === "string" &&
          /^data:image\/[a-zA-Z+]+;base64,[^\s]+$/.test(file)),
      "Invalid file type",
    ),
  color: z
    .string()
    .trim()
    .min(1, "Color is required")
    .refine((value) => {
      try {
        color(value);
        return true;
      } catch {
        return false;
      }
    }, "Invalid color format"),
  type: z.enum(["auto", "qr", "barcode"]).default("auto"),
  tag: z.string().trim().optional(),
});

type FormValues = z.infer<typeof cardSchema>;

const convertFileToBase64 = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};

const fetchLogoFromUrl = async (url: string): Promise<string | null> => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return await convertFileToBase64(
      new File([blob], "logo.png", { type: blob.type }),
    );
  } catch (error) {
    console.error("Error fetching logo from URL:", error);
    return null;
  }
};

const defaultValues: FormValues = {
  providerId: "",
  name: "",
  code: "",
  logo: null,
  color: "",
  country: "FR",
  type: "auto",
  tag: "",
};

export function FormModal({
  isOpen,
  onClose,
  onAddCard,
  onEditCard,
  card,
}: {
  isOpen: boolean;
  onClose: () => void;
  onAddCard: (card: Omit<CardType, "createdAt" | "updatedAt">) => void;
  onEditCard?: (card: Omit<CardType, "createdAt" | "updatedAt">) => void;
  card?: CardType;
}) {
  const [logoPreview, setLogoPreview] = useState<string | null>(
    card?.logo || null,
  );

  const form = useForm({
    resolver: zodResolver(cardSchema),
    defaultValues,
  });

  const { reset } = form;

  useEffect(() => {
    if (card) {
      reset({
        country: card.country || defaultValues.country,
        providerId: card.providerId || defaultValues.providerId,
        name: card.name || defaultValues.name,
        code: card.code || defaultValues.code,
        logo: card.logo || defaultValues.logo,
        color: card.color || defaultValues.color,
        type: card.type || defaultValues.type,
        tag: card.tag || defaultValues.tag,
      });
      setLogoPreview(card.logo || null);
    } else {
      reset(defaultValues);
      setLogoPreview(null);
    }
  }, [card, reset]);

  const handleProviderChange = async (provider: ProviderType) => {
    if (provider.visual?.logoUrl) {
      const base64 = await fetchLogoFromUrl(provider.visual.logoUrl);
      form.setValue("logo", base64);
      setLogoPreview(base64);
    }

    if (
      !form.getFieldState("name").isTouched ||
      form.watch("name").length < 1
    ) {
      form.setValue("name", provider.name);
    }

    form.setValue("color", provider.visual?.color || "#000000");
    form.setValue(
      "type",
      provider.defaultBarcodeFormat === "QR_CODE" ? "qr" : "barcode",
    );
  };

  const handleLogoChange = async (file: File | string | null) => {
    if (file != null) {
      if (file instanceof File) {
        if (!file.type.startsWith("image/")) {
          toast.error("Please upload a valid image file.");
          setLogoPreview(null);
          return;
        }

        try {
          const base64 = await convertFileToBase64(file);
          const color = await getImgBackgroundColor(base64);
          form.setValue("color", color);
          setLogoPreview(base64);
        } catch (error) {
          console.error("Error converting file to base64:", error);
          setLogoPreview(null);
        }
      } else {
        setLogoPreview(file);
      }
    } else {
      setLogoPreview(null);
    }
  };

  const handleSubmit = async (values: FormValues) => {
    let logo: string | null = values.logo;
    if (values.logo && values.logo instanceof File) {
      logo = await convertFileToBase64(values.logo);
    }

    const updatedCard: Omit<CardType, "createdAt" | "updatedAt"> = {
      providerId: values.providerId || null,
      type: values.type,
      id: card ? card.id : "-1",
      name: values.name,
      code: values.code,
      logo: logo,
      color: values.color,
      country: values.country || null,
      tag: values.tag || null,
    };

    if (card && onEditCard) {
      // Editing an existing card
      await onEditCard(updatedCard);
      toast.success(`${card.name} card updated successfully`);
    } else {
      // Adding a new card
      await onAddCard(updatedCard);
      toast.success(`${updatedCard.name} card added successfully`);
    }

    handleClose();
  };

  const handleClose = () => {
    setLogoPreview(null);
    reset();
    onClose();
    setIsFlipped(false);
  };

  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="flex flex-col p-0 overflow-hidden bg-background text-foreground gap-0 max-h-[90vh]">
        <DialogHeader className="p-4 border-b shrink-0">
          <DialogTitle className="text-foreground">
            {card ? "Edit card" : "Add a new card"}
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
            className="flex flex-col overflow-hidden"
          >
            <div className="overflow-x-hidden overflow-y-auto flex flex-col space-y-4 p-4 max-h-[60vh]">
              {/* Card preview */}
              <div className="flex justify-center">
                <Tabs
                  value={form.watch("type")}
                  defaultValue={form.watch("type")}
                  onValueChange={(value) => {
                    form.setValue("type", value as "auto" | "qr" | "barcode");
                  }}
                >
                  <TabsContent
                    value="auto"
                    forceMount
                    className={cn({
                      hidden: form.watch("type") !== "auto",
                    })}
                  >
                    <Card
                      id="-1"
                      type="auto"
                      tag={form.watch("tag") ?? null}
                      name={form.watch("name")}
                      color={form.watch("color")}
                      logo={logoPreview || null}
                      code={form.watch("code")}
                      flipped={isFlipped}
                      onFlip={setIsFlipped}
                    />
                  </TabsContent>
                  <TabsContent
                    value="qr"
                    forceMount
                    className={cn({
                      hidden: form.watch("type") !== "qr",
                    })}
                  >
                    <Card
                      id="-1"
                      type="qr"
                      tag={form.watch("tag") ?? null}
                      name={form.watch("name")}
                      color={form.watch("color")}
                      logo={logoPreview || null}
                      code={form.watch("code")}
                      flipped={isFlipped}
                      onFlip={setIsFlipped}
                    />
                  </TabsContent>

                  <TabsContent
                    value="barcode"
                    forceMount
                    className={cn({
                      hidden: form.watch("type") !== "barcode",
                    })}
                  >
                    <Card
                      id="-1"
                      type="barcode"
                      tag={form.watch("tag") ?? null}
                      name={form.watch("name")}
                      color={form.watch("color")}
                      logo={logoPreview || null}
                      code={form.watch("code")}
                      flipped={isFlipped}
                      onFlip={setIsFlipped}
                    />
                  </TabsContent>
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="auto">Auto</TabsTrigger>
                    <TabsTrigger value="qr">QR Code</TabsTrigger>
                    <TabsTrigger value="barcode">Barcode</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div className="flex gap-2">
                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem className="w-1/3">
                      <FormLabel className="text-foreground">Country</FormLabel>
                      <FormControl>
                        <CountryPicker {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="providerId"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel className="text-foreground">
                        Provider
                      </FormLabel>
                      <FormControl>
                        <ProviderPicker
                          countryCode={form.watch("country")}
                          suggestFrom={form.watch("name")}
                          {...field}
                          onChange={(
                            id: ProviderType["id"],
                            provider: ProviderType,
                          ) => {
                            field.onChange(id);
                            handleProviderChange(provider);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                name="tag"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">Tag</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Mom, Work, Personal"
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
                        accept="image/*"
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
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">Color</FormLabel>
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

            <DialogFooter className="p-4 border-t shrink-0">
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
