import { RenderSections } from "@/components/home/Sections";
import {
  getBusiness, getCategories, getDevices, getFaqs, getHero, getHomeSections, getProducts, getReels, getReviews, getStories,
} from "@/lib/data/store";
import { getActiveDevice } from "@/lib/device-cookie";
import { getLang } from "@/lib/i18n";
import { getGoogleReviews } from "@/lib/reviews/google";

export const revalidate = 300; // ISR; CMS publish triggers on-demand revalidation

export default async function HomePage() {
  const device = await getActiveDevice();
  const [lang, sections, devices, categories, picks, faqs, stories, reviews, google, hero, business, reels, all] = await Promise.all([
    getLang(), getHomeSections(), getDevices(), getCategories(),
    getProducts({ device: device?.id, inStock: true, limit: 8 }),
    getFaqs(), getStories(), getReviews({ limit: 9 }), getGoogleReviews(), getHero(), getBusiness(), getReels(),
    getProducts({ limit: 1000 }),
  ]);
  const counts: Record<string, number> = {};
  for (const p of all) counts[p.category_slug] = (counts[p.category_slug] ?? 0) + 1;

  return (
    <RenderSections
      sections={sections}
      ctx={{ lang, devices, categories, picks, deviceName: device?.name, faqs, stories, reviews, google, hero, business, counts, reels }}
    />
  );
}
