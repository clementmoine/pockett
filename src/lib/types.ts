export type Card = {
  name: string;
  id: number; // Unique identifier for the card
  code: string; // Code to be displayed (could be a barcode or QR code)
  logo: string | null; // URL of the logo or Base64 string
  color: string; // Background color
  type: "barcode" | "qr" | "auto";
};
