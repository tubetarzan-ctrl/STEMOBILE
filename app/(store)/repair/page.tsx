import type { Metadata } from "next";
import { getDevices } from "@/lib/data/store";
import { RepairZonePicker } from "@/components/home/RepairZonePicker";
import { QuickInquiry } from "@/components/home/QuickInquiry";
import { BookingForm } from "./BookingForm";
import { stockImage } from "@/lib/data/stock";

export const metadata: Metadata = {
  title: "Phone repair in Karachi — instant quote & live tracking",
  description: "Screen, battery and charging port repairs with graded parts, a fixed price per grade, live repair tracking and a digital warranty.",
};

export default async function RepairPage({ searchParams }: { searchParams: Promise<{ device?: string; issue?: string; grade?: string }> }) {
  const sp = await searchParams;
  const devices = await getDevices();
  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <div className="relative overflow-hidden rounded-3xl border border-line">
        {stockImage("repair-hero") && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={stockImage("repair-hero")!.src} alt={stockImage("repair-hero")!.alt} className="absolute inset-0 size-full object-cover" />
        )}
        <span aria-hidden className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-black/20" />
        <div className="relative px-5 py-12 sm:px-10 sm:py-16">
          <p className="mb-3 font-mono text-xs uppercase tracking-[0.14em] text-white/75">Repairs</p>
          <h1 className="max-w-2xl font-display text-3xl font-semibold text-white sm:text-5xl">A fixed price before you visit. A live tracker while we work.</h1>
          <p className="mt-3 max-w-xl text-white/80">iPhone and Android repairs, screen replacements and complex hardware faults like Wi-Fi IC repair.</p>
        </div>
      </div>
      <section className="mt-12"><RepairZonePicker devices={devices} /></section>
      <section className="mt-20 grid gap-10 lg:grid-cols-2" id="book">
        <div>
          <h2 className="font-display text-3xl font-semibold">Book a repair</h2>
          <p className="mt-2 text-ink-2">Pick a time and drop by — your slot is held and the job card is ready when you arrive. You&apos;ll get a tracking link on WhatsApp.</p>
          <ol className="mt-6 space-y-3 text-sm text-ink-2">
            {["Check-in photos and a condition checklist, in front of you", "Diagnosis — if the price changes, you approve on WhatsApp first", "Repair with the grade you chose, then a quality check", "Handover with a digital warranty on your number"].map((s, i) => (
              <li key={s} className="flex gap-3"><span className="font-mono text-accent">0{i + 1}</span>{s}</li>
            ))}
          </ol>
        </div>
        <BookingForm devices={devices.map((d) => ({ id: d.id, name: `${d.brand} ${d.name}` }))} initial={{ device: sp.device, issue: sp.issue }} />
      </section>
      <section className="mt-20 grid gap-10 lg:grid-cols-2" id="special">
        <div>
          <h2 className="font-display text-3xl font-semibold">Can&apos;t find your part?</h2>
          <p className="mt-2 text-ink-2">We special-order from our suppliers, usually within 3–7 days. Tell us the model and part — we&apos;ll quote on WhatsApp.</p>
        </div>
        <QuickInquiry kind="special_order" title="Special-order request" />
      </section>
    </div>
  );
}
