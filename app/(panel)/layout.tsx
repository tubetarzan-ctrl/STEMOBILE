import { StaffShell } from "@/components/panel/StaffShell";

export const metadata = { title: "Back office", robots: { index: false } };
export const dynamic = "force-dynamic";

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return <StaffShell>{children}</StaffShell>;
}
