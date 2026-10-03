import { NextResponse, type NextRequest } from "next/server";
import { checkImei, imeiConfigured } from "@/lib/imei";
import { isValidImei } from "@/lib/imei/luhn";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Paid IMEI lookup — strict limits so it can't be abused to run up costs. */
export async function POST(req: NextRequest) {
  const { imei } = (await req.json().catch(() => ({}))) as { imei?: string };
  if (!imei || !isValidImei(imei)) return NextResponse.json({ error: "invalid_imei" }, { status: 400 });
  if (!imeiConfigured()) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  if (!(await rateLimit("imei", 3, 10 * 60_000))) return NextResponse.json({ error: "too_many" }, { status: 429 });
  try {
    return NextResponse.json(await checkImei(imei));
  } catch (e) {
    console.error("[imei]", (e as Error).message);
    return NextResponse.json({ error: "provider_error" }, { status: 502 });
  }
}
