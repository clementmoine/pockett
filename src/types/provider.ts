export interface Provider {
  provider_id: string;
  provider_name: string;
  markets: string[];
  input_type: "BARCODE_SCANNER" | "MANUAL";
  expected_manual_input_character_set: "NO_RESTRICTIONS" | "NUMERIC";
  search_terms: string[];
  visual: {
    logo_url?: string;
    color: string;
  };
  default_barcode_format:
    | "CODABAR"
    | "CODE_128"
    | "EAN_13"
    | "CODE_39"
    | "QR_CODE"
    | "ITF"
    | "UPC_A"
    | "DATA_MATRIX"
    | "PDF_417";
}
