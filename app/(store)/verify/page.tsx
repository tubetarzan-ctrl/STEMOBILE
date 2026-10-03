import { CheckCircle2, ScanLine, ShieldCheck } from "lucide-react";
import { VerifyTools } from "@/components/verify/VerifyTools";
import { getBusiness } from "@/lib/data/store";

export const metadata = {
  title: "Verify a part — Genuine Proof",
  description: "Scan a StarTech part's QR to confirm its grade and warranty, check your phone's IMEI, and learn how to check an iPhone's Parts and Service History.",
};

export default async function VerifyPage() {
  const biz = await getBusiness();
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
      <div className="mx-auto max-w-2xl text-center">
        <ScanLine className="mx-auto size-10 text-accent" />
        <h1 className="mt-4 font-display text-3xl font-semibold sm:text-4xl">Verify a part</h1>
        <p className="mt-3 text-ink-2">Every serialized StarTech part carries a Genuine Proof QR. Scan it to see the grade, sale date and warranty — instantly, right here.</p>
      </div>

      <div className="mt-10 grid gap-5 md:grid-cols-2">
        <VerifyTools whatsapp={biz.whatsapp} />
      </div>

      <section className="mt-14 grid gap-5 md:grid-cols-2">
        <div className="card p-5 sm:p-6">
          <h2 className="flex items-center gap-2 font-display text-xl font-semibold"><ShieldCheck className="size-5 text-trust" />Check an iPhone yourself</h2>
          <p className="mt-1 text-sm text-ink-2">iPhones (XS and newer, iOS 15.2 or later) show whether parts are genuine Apple parts:</p>
          <ol className="mt-4 space-y-2.5 text-sm">
            {["Open Settings", "Tap General → About", "Scroll to Parts and Service History", "“Genuine Apple Part” = original · “Unknown Part” = not an Apple part (or not verified)"].map((s, i) => (
              <li key={s} className="flex gap-3"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-surface-2 font-mono text-xs text-accent">{i + 1}</span><span>{s}</span></li>
            ))}
          </ol>
          <p className="mt-4 text-xs text-ink-3">The section only appears if a part has been replaced. Which parts are listed depends on the model (battery, display, camera).</p>
        </div>
        <div className="card p-5 sm:p-6">
          <h2 className="font-display text-xl font-semibold">Spotting a copy screen</h2>
          <ul className="mt-4 space-y-2.5 text-sm text-ink-2">
            {[
              "Colours look washed out or blue-ish compared with before",
              "Thicker black border around the display",
              "Touch feels laggy or misses taps near the edges",
              "Brightness can't reach the same maximum",
              "True Tone / Face ID warnings after a repair",
            ].map((s) => <li key={s} className="flex gap-2.5"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent" />{s}</li>)}
          </ul>
          <p className="mt-4 text-xs text-ink-3">At StarTech the grade is printed on your invoice and QR, so you always know what was fitted — even when it&apos;s a budget grade by choice.</p>
        </div>
      </section>

      <p className="mx-auto mt-10 max-w-2xl text-center text-xs text-ink-3">
        Note: no public worldwide database verifies individual phone parts — manufacturers keep that data for their authorised centres. Genuine Proof is StarTech&apos;s own guarantee, backed by our warranty.
      </p>
    </div>
  );
}
