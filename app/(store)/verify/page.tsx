import { redirect } from "next/navigation";
import { ScanLine } from "lucide-react";

export const metadata = { title: "Verify a part — Genuine Proof" };

export default function VerifyPage() {
  async function go(formData: FormData) {
    "use server";
    const code = String(formData.get("code") ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (code) redirect(`/verify/${code}`);
  }
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <ScanLine className="mx-auto size-10 text-accent" />
      <h1 className="mt-4 font-display text-4xl font-semibold">Verify a part</h1>
      <p className="mt-3 text-ink-2">Scan the QR on the part&apos;s label, or type the 10-character code printed under it.</p>
      <form action={go} className="mt-8 flex gap-2">
        <label className="sr-only" htmlFor="code">Genuine Proof code</label>
        <input id="code" name="code" required className="input font-mono uppercase tracking-widest" placeholder="K7QXM2PR9D" maxLength={14} />
        <button className="btn btn-primary">Verify</button>
      </form>
    </div>
  );
}
