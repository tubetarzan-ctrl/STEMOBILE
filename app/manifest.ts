import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "StarTech Electronics",
    short_name: "StarTech",
    description: "Genuine phone parts, repairs and the StarTech back office.",
    start_url: "/",
    display: "standalone",
    background_color: "#07080B",
    theme_color: "#07080B",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
    shortcuts: [
      { name: "POS", url: "/panel/pos" },
      { name: "Repairs", url: "/panel/repairs" },
    ],
  };
}
