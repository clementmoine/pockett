import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    theme_color: "#000000",
    background_color: "#ffffff",
    icons: [
      {
        src: "/web-app-manifest-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/web-app-manifest-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/web-app-manifest-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    screenshots: [
      {
        src: "/screenshots/narrow/home.png",
        sizes: "750x1334",
        type: "image/png",
        form_factor: "narrow",
      },
      {
        src: "/screenshots/narrow/modal.png",
        sizes: "750x1334",
        type: "image/png",
        form_factor: "narrow",
      },
      {
        src: "/screenshots/wide/home.png",
        sizes: "2048x1536",
        type: "image/png",
        form_factor: "wide",
      },
      {
        src: "/screenshots/wide/modal.png",
        sizes: "2048x1536",
        type: "image/png",
        form_factor: "wide",
      },
    ],
    id: "/",
    start_url: "/",
    orientation: "portrait",
    display: "standalone",
    dir: "auto",
    lang: "en",
    name: "Pockett - Loyalty Cards",
    short_name: "Pockett",
    description: "All your loyalty cards, always in your pocket.",
  };
}
