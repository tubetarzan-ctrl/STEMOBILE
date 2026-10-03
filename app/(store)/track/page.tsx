import { redirect } from "next/navigation";
import { PackageSearch } from "lucide-react";

export const metadata = { title: "Track an order or repair" };

export default function TrackPage() {
  async function go(formData: FormData) {
    "use server";
    const ref = String(formData.get("ref") ?? "").trim().toUpperCase();
    const token = String(formData.get("token") ?? "").trim();
    if (ref) redirect(`/track/${encodeURIComponent(ref)}${token ? `?t=${encodeURIComponent(token)}` : ""}`);
  }
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <PackageSearch className="mx-auto size-10 text-accent" />
      <h1 className="mt-4 font-display text-4xl font-semibold">Track</h1>
      <p className="mt-3 text-ink-2">Enter your repair tracking code, or open the link from your WhatsApp order confirmation.</p>
      <form action={go} className="mt-8 flex gap-2">
        <label className="sr-only" htmlFor="ref">Tracking code</label>
        <input id="ref" name="ref" required className="input font-mono uppercase" placeholder="e.g. 3FA9C1B2D4 or ST-000123" />
        <button className="btn btn-primary">Track</button>
      </form>
    </div>
  );
}
