import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Notion Expenses",
    short_name: "Expenses",
    description: "Add expenses to Notion",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0d17",
    theme_color: "#0b0d17",
    orientation: "portrait",
    categories: ["finance", "productivity"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
