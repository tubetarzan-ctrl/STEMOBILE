import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { answerChat } from "@/lib/chat/engine";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic"; // live stock — never cached

const Body = z.object({
  message: z.string().max(500),
  ctx: z.object({
    deviceId: z.string().max(64).optional(), deviceName: z.string().max(80).optional(), category: z.string().max(40).optional(),
    grade: z.enum(["ORIG_NEW", "ORIG_PULL", "OEM", "PREMIUM", "STANDARD", "NA"]).optional(), repair: z.boolean().optional(),
  }).optional(),
});

export async function POST(req: NextRequest) {
  if (!(await rateLimit("chat", 30, 60_000))) {
    return NextResponse.json({ text: "You're sending messages very quickly — please wait a moment.", source: "rules" }, { status: 429 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ text: "Sorry, I didn't catch that.", source: "rules" }, { status: 400 });
  try {
    return NextResponse.json(await answerChat(parsed.data.message, parsed.data.ctx ?? {}));
  } catch (e) {
    console.error("[chat]", e);
    return NextResponse.json({ text: "Something went wrong on my side — please call or WhatsApp us on +92 332 2142141.", source: "handoff" }, { status: 500 });
  }
}
