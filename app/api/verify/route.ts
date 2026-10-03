import { NextResponse, type NextRequest } from "next/server";
import { hasSupabase, supabasePublic } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Genuine Proof lookup for the scanner popup. Codes are random + rate limited. */
export async function GET(req: NextRequest) {
  if (!(await rateLimit("verify", 20, 60_000))) return NextResponse.json({ valid: false, error: "too_many" }, { status: 429 });
  const code = (req.nextUrl.searchParams.get("code") ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 14);
  if (code.length < 6) return NextResponse.json({ valid: false });
  if (!hasSupabase) {
    return NextResponse.json(code === "DEMO000000"
      ? { valid: true, code, product: "iPhone 13 Display Assembly", grade: "ORIG_NEW", status: "sold", sold_at: new Date().toISOString(), warranty_ends: new Date(Date.now() + 150 * 864e5).toISOString().slice(0, 10), warranty_active: true }
      : { valid: false, code });
  }
  const { data } = await supabasePublic().rpc("verify_proof_code", { p_code: code });
  return NextResponse.json({ ...(data ?? { valid: false }), code });
}
