import { requirePermission } from "@/lib/auth/permissions";
import { getThemes } from "@/lib/data/store";
import { PageHead } from "@/components/panel/ui";
import { ThemeGrid } from "./ThemeGrid";

export default async function AppearancePage() {
  await requirePermission("appearance.manage", "redirect");
  const themes = await getThemes();
  return (
    <div>
      <PageHead title="Appearance" sub="Switch the whole storefront's look. Applied server-side, so there's no flash of the old theme." />
      <ThemeGrid themes={themes} />
    </div>
  );
}
