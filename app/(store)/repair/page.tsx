import type { Metadata } from "next";
import { getDevices } from "@/lib/data/store";
import { RepairZonePicker } from "@/components/home/RepairZonePicker";
import { QuickInquiry } from "@/components/home/QuickInquiry";
import { BookingForm } from "./BookingForm";

export const metadata: Metadata = {
  title: "Phone repair in Karachi — instant quote & live tracking",
  description: "Screen, battery and charging port repairs with graded parts, a fixed price per grade, live repair tracking and a digital warranty.",
};

export default async function RepairPage({ searchParams }: { searchParams: Promise<{ device?: string; issue?: string; grade?: string }> }) {
  const sp = await searchParams;
  const devices = await getDevices();
  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <p className="eyebrow mb-3">Repairs</p>
      <h1 className="max-w-3xl font-display text-4xl font-semibold sm:text-5xl">A fixed price before you visit. A live tracker while we work.</h1>
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
