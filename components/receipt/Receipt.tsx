import { SHOP } from "@/lib/data/shop";
import { formatPKR } from "@/lib/money";
import { formatPhonePK } from "@/lib/utils";

// One receipt layout for counter sales, reprints and repair drop-off / handover.
// Prints on 80mm thermal paper (globals.css prints only #receipt) and looks the
// same on screen. Plain component, so it works from server and client pages.

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "stemobilepk.vercel.app").replace(/^https?:\/\//, "");

export type ReceiptLine = { name: string; note?: string; qty: number; unit: number; discount?: number };
export type ReceiptProps = {
  title: string;                         // "SALES RECEIPT", "REPAIR RECEIPT"…
  number: string;                        // #1042, RJ-000018
  at: Date | string;
  customer?: { name?: string | null; phone?: string | null };
  meta?: [string, string][];             // extra rows: device, IMEI, promised…
  lines?: ReceiptLine[];
  totals?: [string, number, boolean?][]; // [label, paisa, bold]
  payments?: { method: string; amount: number }[];
  change?: number;
  note?: string;                         // terms / warranty message
  trackUrl?: string;
  footnote?: string;                     // e.g. "OFFLINE — will sync"
};

export function Receipt(r: ReceiptProps) {
  const at = typeof r.at === "string" ? new Date(r.at) : r.at;
  return (
    <div id="receipt" className="mx-auto w-full max-w-[80mm] space-y-2 bg-white p-3 font-mono text-[11px] leading-snug text-black">
      <header className="flex items-start justify-between gap-2 border-b-2 border-black pb-2">
        <div>
          <p className="text-[12px] font-bold tracking-wide">{r.title}</p>
          <p className="font-bold">{r.number}</p>
          <p>{at.toLocaleString("en-PK", { dateStyle: "medium", timeStyle: "short" })}</p>
        </div>
        <div className="text-right">
          <p className="font-sans text-[15px] font-black leading-none tracking-tight">STARTECH</p>
          <p className="font-sans text-[9px] font-semibold tracking-[0.25em]">ELECTRONICS</p>
          <p className="mt-0.5 text-[8px]">Since 2003</p>
        </div>
      </header>

      {(r.customer?.name || r.customer?.phone) && (
        <p>Customer: {r.customer.name ?? ""}{r.customer.phone ? ` · ${formatPhonePK(r.customer.phone)}` : ""}</p>
      )}
      {r.meta?.map(([k, v]) => <p key={k} className="flex justify-between gap-2"><span>{k}</span><span className="text-right">{v}</span></p>)}

      {r.lines && r.lines.length > 0 && (
        <div className="space-y-1 border-y border-dashed border-black py-1.5">
          {r.lines.map((l, i) => (
            <div key={i}>
              <p>{l.name}{l.note ? ` [${l.note}]` : ""}</p>
              <p className="flex justify-between">
                <span>{l.qty} × {formatPKR(l.unit)}{l.discount ? ` −${formatPKR(l.discount)}` : ""}</span>
                <span>{formatPKR(l.qty * l.unit - (l.discount ?? 0))}</span>
              </p>
            </div>
          ))}
        </div>
      )}

      {r.totals?.map(([k, v, bold]) => (
        <p key={k} className={bold ? "flex justify-between text-[13px] font-bold" : "flex justify-between"}><span>{k}</span><span>{formatPKR(v)}</span></p>
      ))}
      {r.payments?.map((p, i) => <p key={i} className="flex justify-between"><span className="capitalize">Paid · {p.method.replace(/_/g, " ")}</span><span>{formatPKR(p.amount)}</span></p>)}
      {!!r.change && r.change > 0 && <p className="flex justify-between"><span>Change</span><span>{formatPKR(r.change)}</span></p>}

      {r.note && <p className="border-t border-dashed border-black pt-1.5">{r.note}</p>}
      {r.trackUrl && <p>Track: {r.trackUrl}</p>}
      {r.footnote && <p className="font-bold">{r.footnote}</p>}

      <footer className="space-y-0.5 border-t-2 border-black pt-2 text-center text-[9.5px]">
        <p className="font-bold">{SHOP.name}</p>
        <p>{SHOP.address}</p>
        <p>Call / WhatsApp: {formatPhonePK(SHOP.phone)}</p>
        <p>{SHOP.hours}</p>
        <p>Verify parts &amp; track repairs: {SITE}</p>
        <p className="pt-1">Thank you for choosing StarTech!</p>
      </footer>
    </div>
  );
}
