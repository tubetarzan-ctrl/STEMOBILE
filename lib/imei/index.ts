import "server-only";
import { isValidImei } from "./luhn";

// IMEI lookup (paid, per check) behind one interface — checks the PHONE
// (model, blacklist / lost-stolen, carrier lock, warranty), not individual
// parts; no public service can verify parts.
// DECISION: imeicheck.net-style REST adapter; confirm the endpoint, service id
// and response fields against the provider's docs when the account is opened.
// Without IMEI_CHECK_API_KEY the feature reports "not active" — never fake data.

export type ImeiResult = {
  imei: string;
  model?: string;
  brand?: string;
  blacklist?: "clean" | "blacklisted" | "unknown";
  simLock?: string;
  warranty?: string;
  extra?: Record<string, string>;
};

export const imeiConfigured = () => !!process.env.IMEI_CHECK_API_KEY;

const cache = new Map<string, { at: number; r: ImeiResult }>();

export async function checkImei(raw: string): Promise<ImeiResult> {
  const imei = raw.replace(/\D/g, "");
  if (!isValidImei(imei)) throw new Error("invalid_imei");
  const hit = cache.get(imei);
  if (hit && Date.now() - hit.at < 24 * 3600e3) return hit.r; // one paid lookup per IMEI per day

  const res = await fetch(process.env.IMEI_CHECK_API_URL || "https://api.imeicheck.net/v1/checks", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.IMEI_CHECK_API_KEY}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ deviceId: imei, serviceId: Number(process.env.IMEI_CHECK_SERVICE_ID || 1) }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`imei_provider_${res.status}`);
  const j = await res.json();
  const p: Record<string, unknown> = j.properties ?? j.result ?? j;
  const s = (k: string) => (p[k] == null ? undefined : String(p[k]));
  const bl = (s("blacklistStatus") ?? s("gsmaBlacklisted") ?? "").toLowerCase();
  const r: ImeiResult = {
    imei,
    model: s("deviceName") ?? s("modelName") ?? s("model"),
    brand: s("brand") ?? s("manufacturer"),
    blacklist: /clean|false|no/.test(bl) ? "clean" : /black|true|yes|lost|stolen/.test(bl) ? "blacklisted" : "unknown",
    simLock: s("simLock") ?? s("carrier"),
    warranty: s("warrantyStatus") ?? s("estPurchaseDate"),
  };
  cache.set(imei, { at: Date.now(), r });
  return r;
}
