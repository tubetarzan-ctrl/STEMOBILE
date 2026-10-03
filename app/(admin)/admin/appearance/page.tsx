import { requirePermission } from "@/lib/auth/permissions";
import { getFontKey, getThemes } from "@/lib/data/store";
import { FontPicker } from "./FontPicker";
import { PageHead } from "@/components/panel/ui";
import { ThemeGrid } from "./ThemeGrid";

export default async function AppearancePage() {
  await requirePermission("appearance.manage", "redirect");
  const [themes, fontKey] = await Promise.all([getThemes(), getFontKey()]);
  return (
    <div>
      <PageHead title="Appearance" sub="Switch the whole storefront's look. Applied server-side, so there's no flash of the old theme." />
      <div className="space-y-8">
        <FontPicker current={fontKey} />
        <ThemeGrid themes={themes} />
      </div>
    </div>
  );
}
