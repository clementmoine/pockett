import {
  CharacterSet,
  Country,
  Prisma,
  Provider,
  ProviderVisual,
} from "@prisma/client";

export interface RawProvider {
  provider_id: Provider["id"];
  provider_name: Provider["name"];
  markets: Country[];
  input_type: Provider["inputType"];
  expected_manual_input_character_set: CharacterSet;
  search_terms: string[];
  visual: {
    logo_url?: ProviderVisual["logoUrl"];
    color: ProviderVisual["color"];
  };
  default_barcode_format: Provider["defaultBarcodeFormat"];
}

export type ProviderWithVisual = Prisma.ProviderGetPayload<{
  include: {
    visual: {
      select: {
        logoUrl: true;
        color: true;
      };
    };
  };
}>;
