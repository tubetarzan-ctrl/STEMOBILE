import "server-only";
import { headers } from "next/headers";

// DECISION: in-memory sliding window per server instance. Good enough to stop
// casual guessing of proof codes / order refs; move to a Postgres or Redis
// counter if traffic is spread across many instances.
const buckets = new Map<string, number[]>();

export async function rateLimit(scope: string, limit: number, windowMs: number): Promise<boolean> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
  const key = `${scope}:${ip}`;
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 10_000) buckets.clear();
  return true;
}
