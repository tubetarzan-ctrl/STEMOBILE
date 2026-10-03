import Link from "next/link";
import { requirePermission } from "@/lib/auth/permissions";
import { supabaseAdmin } from "@/lib/supabase/server";
import { PageHead } from "@/components/panel/ui";
import { BulkPhotos, ImportSheet } from "./ImportClient";

export const metadata = { title: "Import products" };

export default async function ImportPage() {
  await requirePermission("inventory.edit", "redirect");
  const { data: cats } = await supabaseAdmin().from("categories").select("name, slug").eq("is_active", true).order("sort");
  return (
    <div className="space-y-8">
      <Link href="/panel/inventory/products" className="text-sm text-accent">← Products</Link>
      <PageHead title="Import products & opening stock" sub="Type into the sheet, paste from Excel, or upload an Excel / CSV / notepad file. Quantity + cost become your opening stock (posted to the books automatically)." />
      <ImportSheet categories={(cats ?? []).map((c) => c.name)} />
      <BulkPhotos />
    </div>
  );
}
