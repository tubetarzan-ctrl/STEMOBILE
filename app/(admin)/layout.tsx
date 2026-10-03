import { StaffShell } from "@/components/panel/StaffShell";

export const metadata = { title: "Super Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <StaffShell>{children}</StaffShell>;
}
