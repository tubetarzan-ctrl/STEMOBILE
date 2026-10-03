import { requirePermission } from "@/lib/auth/permissions";
import { supabaseServer } from "@/lib/supabase/server";
import { PageHead } from "@/components/panel/ui";
import { FaqEditor } from "./FaqEditor";

export default async function FaqPage() {
  await requirePermission("content.edit", "redirect");
  const sb = await supabaseServer();
  const { data } = await sb.from("faqs").select("id, q_en, q_ur, a_en, a_ur, sort, visible").eq("page_slug", "").order("sort");
  return (
    <div className="max-w-4xl">
      <PageHead title="FAQ Manager" sub="Feeds the FAQ section, FAQ schema, and the WhatsApp/AI assistant's answer bank." />
      <FaqEditor faqs={data ?? []} />
    </div>
  );
}
