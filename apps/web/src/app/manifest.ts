import type { MetadataRoute } from "next";

/** Permet d'ajouter Anima à l'écran d'accueil (iPhone, iPad, Android) comme une appli. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Anima",
    short_name: "Anima",
    description: "Ton journal intime et vos journaux partagés. Privé par défaut, hébergé en Europe.",
    lang: "fr",
    start_url: "/aujourdhui",
    display: "standalone",
    background_color: "#F5F3EE",
    theme_color: "#151515",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
