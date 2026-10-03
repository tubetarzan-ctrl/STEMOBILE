import { TradeForm } from "./TradeForm";

export const metadata = { title: "Technician Pro — trade accounts for repair shops" };

export default function TradeApplyPage() {
  return (
    <div className="mx-auto grid max-w-6xl gap-12 px-4 py-14 lg:grid-cols-2">
      <div>
        <p className="eyebrow mb-3">Technician Pro</p>
        <h1 className="font-display text-4xl font-semibold sm:text-5xl">Stock your bench with parts you can stand behind.</h1>
        <ul className="mt-8 space-y-4 text-ink-2">
          <li><strong className="text-ink">Tiered trade pricing</strong> — Trade and Trade Gold tiers across every graded part.</li>
          <li><strong className="text-ink">Credit line + digital khata</strong> — running statement, aging and WhatsApp reminders; pay by Raast link.</li>
          <li><strong className="text-ink">Genuine Proof on serialized parts</strong> — your customers can verify what you fitted.</li>
          <li><strong className="text-ink">Quick reorder</strong> — bulk add by SKU, order history and statement downloads.</li>
          <li><strong className="text-ink">Broken screen buyback</strong> — sell us your broken LCD/OLEDs for khata credit.</li>
        </ul>
      </div>
      <TradeForm />
    </div>
  );
}
