import "server-only";
import { NextResponse, type NextRequest } from "next/server";

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. */
export function cronGuard(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV === "production" ? new NextResponse("CRON_SECRET not set", { status: 500 }) : null;
  return req.headers.get("authorization") === `Bearer ${secret}` ? null : new NextResponse("unauthorized", { status: 401 });
}
