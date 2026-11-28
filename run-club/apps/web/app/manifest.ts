import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Higround Coffee & Run Club",
    short_name: "Higround",
    description: "Nongkrong di dunia pixel Higround Harapan Indah, kumpulin Brew Stamps & Free Drinks, lalu lari bareng komunitas!",
    start_url: "/world",
    display: "standalone",
    background_color: "#FFF8EA",
    theme_color: "#FF5F0E",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
