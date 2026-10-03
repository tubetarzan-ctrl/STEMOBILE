import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { HoloProofCard } from "@/components/home/HoloProofCard";
import { hasSupabase, supabasePublic } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { gradeLabel } from "@/lib/grades";
import { formatDate } from "@/lib/time";

export const metadata = { title: "Genuine Proof verification", robots: { index: false } };
export const dynamic = "force-dynamic";

type Proof = { valid: boolean; code?: string; product?: string; grade?: string; status?: string; sold_at?: string | null; warranty_ends?: string | null; warranty_active?: boolean };

export default async function VerifyCodePage({ params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 14);
  if (!(await rateLimit("verify", 20, 60_000))) {
    return <div className="mx-auto max-w-xl px-4 py-20 text-center"><p>Too many lookups — please wait a minute.</p></div>;
  }
  let proof: Proof = { valid: false };
  if (hasSupabase) {
    const { data } = await supabasePublic().rpc("verify_proof_code", { p_code: code });
    proof = (data as Proof) ?? { valid: false };
  } else if (code === "DEMO000000") {
    proof = { valid: true, code, product: "iPhone 13 Display Assembly", grade: "ORIG_NEW", status: "sold", sold_at: new Date().toISOString(), warranty_ends: new Date(Date.now() + 150 * 864e5).toISOString().slice(0, 10), warranty_active: true };
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      {proof.valid ? (
        <div className="space-y-10 text-center">
          <HoloProofCard data={{
            product: proof.product!, grade: gradeLabel(proof.grade), code: proof.code!, valid: true,
            sold: proof.sold_at ? `Sold ${formatDate(proof.sold_at)}` : "In stock at StarTech",
            warrantyEnds: proof.warranty_ends ? `${proof.warranty_active ? "Warranty to" : "Warranty ended"} ${formatDate(proof.warranty_ends)}` : "",
          }} />
          <div>
            <h1 className="font-display text-3xl font-semibold">Genuine StarTech part</h1>
            <p className="mt-2 text-ink-2">Sold by StarTech Electronics, Sarena Mobile Mall, Karachi. Grade: <strong>{gradeLabel(proof.grade)}</strong>.</p>
            {proof.warranty_active && <Link href="/warranty" className="btn btn-ghost mt-6">Claim warranty</Link>}
          </div>
        </div>
      ) : (
        <div className="card grid place-items-center gap-3 p-12 text-center">
          <ShieldAlert className="size-10 text-danger" />
          <h1 className="font-display text-2xl font-semibold">We can&apos;t verify this code</h1>
          <p className="text-ink-2">The code <span className="font-mono">{code}</span> isn&apos;t in our records. Check for typos, or message us a photo of the label.</p>
          <Link href="/verify" className="btn btn-ghost mt-2">Try again</Link>
        </div>
      )}
    </div>
  );
}
