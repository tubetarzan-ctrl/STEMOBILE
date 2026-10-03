// Single source of truth for the shop's public details. The live site reads
// these from the database (content_blocks business.*, editable in Super Admin);
// these values are the fallback / demo defaults and the seed values.
export const SHOP = {
  name: "StarTech Electronics",
  tagline: "Genuine parts. Honest repairs. Since 2003.",
  address: "Shop # 1F, Sarena Family Market and Mobile Mall, Roundabout, Sakhi Hassan, Sector 15-A-1, Buffer Zone, Karachi",
  phone: "+923322142141",
  whatsapp: "+923322142141",
  email: "",
  hours: "Mon–Sat 1:00 PM – 12:00 AM · Sun closed",
  openingHoursSchema: "Mo-Sa 13:00-24:00",
  services: "iPhone and Android repairs, screen replacements, and complex hardware troubleshooting such as Wi-Fi IC repairs",
  years: 22,
  map_url: "https://www.google.com/maps/search/?api=1&query=Sarena+Family+Market+and+Mobile+Mall+Sakhi+Hassan+Buffer+Zone+Karachi",
} as const;
