import { requirePermission } from "@/lib/auth/permissions";
import { PageHead } from "@/components/panel/ui";
import { CopilotBox } from "./CopilotBox";

export default async function CopilotPage() {
  await requirePermission("reports.financial.view", "redirect");
  return (
    <div className="max-w-3xl">
      <PageHead title="Owner Copilot" sub="Plain-language questions over read-only reports. Numbers come only from your ledger." />
      <CopilotBox />
    </div>
  );
}
