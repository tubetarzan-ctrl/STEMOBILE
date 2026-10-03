"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CloudOff, Minus, Plus, Printer, RefreshCw, ScanBarcode, Trash2, Wifi, X } from "lucide-react";
import { posDb, type CatalogItem } from "@/lib/offline/db";
import { formatPKR, rupeesToPaisa } from "@/lib/money";
import { gradeLabel } from "@/lib/grades";
import { cn, whatsappLink } from "@/lib/utils";
import { openDrawerAction, postPosSaleAction, syncOfflineSalesAction } from "@/app/actions/panel";

type Line = { item: CatalogItem; qty: number; discount: number };
type Pay = { method: string; amount: number };
const METHODS = [["cash", "Cash"], ["card", "Card"], ["raast", "Raast QR"], ["jazzcash", "JazzCash"], ["easypaisa", "Easypaisa"], ["wallet", "Store credit"], ["khata", "Khata"]] as const;

type Receipt = { saleNo: string | number; total: number; lines: Line[]; pays: Pay[]; change: number; phone?: string; offline: boolean; at: Date };

export function PosClient({ drawers, openSessions, canDiscount, canBelowMin, cashier }: {
  drawers: { id: string; name: string }[]; openSessions: { id: string; drawer_id: string; opening_float: number }[];
  canDiscount: boolean; canBelowMin: boolean; cashier: string;
}) {
  const [online, setOnline] = useState(true);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [catalogAt, setCatalogAt] = useState<number | null>(null);
  const [queued, setQueued] = useState(0);
  const [session, setSession] = useState<string | null>(openSessions[0]?.id ?? null);
  const [q, setQ] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [phone, setPhone] = useState("");
  const [pays, setPays] = useState<Pay[]>([{ method: "cash", amount: 0 }]);
  const [tendered, setTendered] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const scan = useRef<HTMLInputElement>(null);

  // --- connectivity, service worker, catalog cache ----------------------------------
  useEffect(() => {
    setOnline(navigator.onLine);
    const up = () => setOnline(true), down = () => setOnline(false);
    addEventListener("online", up); addEventListener("offline", down);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => { removeEventListener("online", up); removeEventListener("offline", down); };
  }, []);

  const loadCatalog = useCallback(async () => {
    const db = posDb();
    try {
      const res = await fetch("/api/pos/catalog", { cache: "no-store" });
      if (!res.ok) throw new Error("catalog");
      const j = await res.json();
      await db.transaction("rw", db.catalog, db.meta, async () => {
        await db.catalog.clear();
        await db.catalog.bulkPut(j.items);
        await db.meta.put({ key: "catalog_at", value: j.at });
      });
    } catch { /* offline: use cache */ }
    setCatalog(await db.catalog.toArray());
    setCatalogAt(((await db.meta.get("catalog_at"))?.value as number) ?? null);
    setQueued(await db.queue.count());
  }, []);
  useEffect(() => { loadCatalog(); }, [loadCatalog]);
  useEffect(() => { if (session) posDb().meta.put({ key: "session", value: session }); else posDb().meta.get("session").then((m) => m?.value && setSession(m.value as string)); }, [session]);

  // --- sync queue (in order, idempotent; failures never block later sales) --------------
  const sync = useCallback(async () => {
    if (!navigator.onLine) return;
    const db = posDb();
    const batch = await db.queue.where("status").anyOf("queued", "failed").sortBy("created_at");
    if (!batch.length) return;
    const r = await syncOfflineSalesAction(batch.map((b) => b.payload)).catch(() => null);
    if (!r || !r.ok) return;
    for (const res of r.data) {
      if (res.ok) await db.queue.delete(res.idempotency_key);
      else await db.queue.update(res.idempotency_key, { status: "failed", error: res.error, attempts: (batch.find((b) => b.idempotency_key === res.idempotency_key)?.attempts ?? 0) + 1 });
    }
    setQueued(await db.queue.count());
  }, []);
  useEffect(() => {
    if (online) sync();
    const id = setInterval(sync, 15_000);
    return () => clearInterval(id);
  }, [online, sync]);

  // --- cart ---------------------------------------------------------------------------------
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 2) return [];
    const words = s.split(/\s+/);
    return catalog.filter((c) => words.every((w) => c.search.includes(w))).slice(0, 12);
  }, [q, catalog]);

  const add = (item: CatalogItem) => {
    setLines((ls) => { const f = ls.find((l) => l.item.id === item.id); return f ? ls.map((l) => (l === f ? { ...l, qty: l.qty + 1 } : l)) : [...ls, { item, qty: 1, discount: 0 }]; });
    setQ(""); setError(null); scan.current?.focus();
  };
  const onScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    const code = q.trim();
    const hit = catalog.find((c) => c.barcode === code || c.sku.toLowerCase() === code.toLowerCase());
    if (hit) add(hit); else if (results.length === 1) add(results[0]);
  };

  const subtotal = lines.reduce((a, l) => a + l.qty * l.item.price, 0);
  const discount = lines.reduce((a, l) => a + l.discount, 0);
  const total = subtotal - discount;
  const belowMin = lines.filter((l) => l.qty * l.item.price - l.discount < l.qty * l.item.min_price);
  const payTotal = pays.length === 1 ? total : pays.reduce((a, p) => a + p.amount, 0);
  const cashDue = pays.length === 1 ? (pays[0].method === "cash" ? total : 0) : pays.filter((p) => p.method === "cash").reduce((a, p) => a + p.amount, 0);
  const tenderedPaisa = rupeesToPaisa(tendered || "0") ?? 0;
  const change = Math.max(0, tenderedPaisa - cashDue);

  const complete = async () => {
    setError(null);
    if (!lines.length) return;
    if (belowMin.length && !canBelowMin) return setError(`Below minimum price: ${belowMin.map((l) => l.item.sku).join(", ")} — ask a manager.`);
    const payments = pays.length === 1 ? [{ method: pays[0].method, amount: total }] : pays.filter((p) => p.amount > 0);
    if (payments.reduce((a, p) => a + p.amount, 0) !== total) return setError("Split payments must add up to the total.");
    if (["wallet", "khata"].some((m) => payments.some((p) => p.method === m)) && !phone) return setError("Store credit / khata need the customer's phone.");

    const key = crypto.randomUUID();
    const payload = {
      idempotency_key: key, client_id: "pos-web", drawer_session_id: session, customer_phone: phone || null, sold_at: new Date().toISOString(),
      items: lines.map((l) => ({ variant_id: l.item.id, qty: l.qty, unit_price: l.item.price, discount: l.discount })),
      payments,
    };
    setBusy(true);
    let saleNo: string | number = "OFFLINE";
    let offline = false;
    try {
      if (!navigator.onLine) throw new Error("offline");
      const r = await postPosSaleAction(payload);
      if (!r.ok) { setBusy(false); return setError(r.error); }
      saleNo = r.data.sale_no;
    } catch {
      // network failure: queue it — never drop a sale
      await posDb().queue.put({ idempotency_key: key, created_at: Date.now(), payload, status: "queued", attempts: 0 });
      setQueued(await posDb().queue.count());
      offline = true;
    }
    // optimistic local stock
    await Promise.all(lines.map((l) => posDb().catalog.update(l.item.id, { on_hand: l.item.on_hand - l.qty })));
    setCatalog(await posDb().catalog.toArray());
    setReceipt({ saleNo, total, lines, pays: payments, change, phone: phone || undefined, offline, at: new Date() });
    setLines([]); setPhone(""); setPays([{ method: "cash", amount: 0 }]); setTendered(""); setBusy(false);
  };

  // --- drawer gate --------------------------------------------------------------------------
  if (!session) {
    return (
      <form className="card mx-auto max-w-md space-y-4 p-6" onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const r = await openDrawerAction(String(f.get("drawer")), rupeesToPaisa(String(f.get("float"))) ?? 0);
        if (r.ok) setSession(r.data); else setError(r.error);
      }}>
        <h1 className="font-display text-2xl font-semibold">Open cash drawer</h1>
        <label className="block space-y-1"><span className="label">Drawer</span><select name="drawer" className="input">{drawers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
        <label className="block space-y-1"><span className="label">Opening float (Rs)</span><input name="float" className="input" inputMode="decimal" defaultValue="20000" /></label>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button className="btn btn-primary w-full">Open drawer</button>
      </form>
    );
  }

  return (
    <div className="space-y-4">
      {/* Offline banner — always visible when offline */}
      <div className={cn("flex flex-wrap items-center gap-3 rounded-xl px-4 py-2 text-sm", online ? "bg-surface-1" : "bg-warn text-bg")} role="status">
        {online ? <Wifi className="size-4 text-trust" /> : <CloudOff className="size-4" />}
        <span className="font-medium">{online ? "Online" : "OFFLINE — sales are saved on this device and will sync automatically"}</span>
        <span className={online ? "text-ink-3" : ""}>· {queued} queued · catalog {catalogAt ? new Date(catalogAt).toLocaleTimeString() : "—"}</span>
        <span className="ml-auto text-ink-3">Cashier: {cashier}</span>
        <button type="button" onClick={() => { loadCatalog(); sync(); }} className="btn btn-ghost btn-sm"><RefreshCw className="size-3.5" />Refresh</button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_400px]">
        <section className="space-y-4">
          <div className="relative">
            <ScanBarcode className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-accent" />
            <input ref={scan} autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onScan} className="input h-14 pl-11 text-lg" placeholder="Scan barcode or search name / SKU" aria-label="Scan or search" />
            {results.length > 0 && (
              <ul className="absolute z-20 mt-2 max-h-96 w-full overflow-auto rounded-2xl border border-line bg-surface-1 p-1.5 shadow-2xl">
                {results.map((r) => (
                  <li key={r.id}>
                    <button type="button" onClick={() => add(r)} className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-surface-2">
                      <span className="min-w-0"><span className="block truncate">{r.name}</span><span className="font-mono text-xs text-ink-3">{r.sku}{r.grade !== "NA" && ` · ${gradeLabel(r.grade)}`}</span></span>
                      <span className="text-right"><span className="money block">{formatPKR(r.price)}</span><span className={cn("text-xs", r.on_hand > 0 ? "text-ink-3" : "text-danger")}>{r.on_hand} on hand</span></span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card overflow-x-auto">
            <table className="table">
              <thead><tr><th>Item</th><th className="num">Qty</th><th className="num">Price</th>{canDiscount && <th className="num">Discount (Rs)</th>}<th className="num">Total</th><th /></tr></thead>
              <tbody>
                {lines.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-ink-3">Scan an item to start a sale</td></tr>}
                {lines.map((l, i) => (
                  <tr key={l.item.id}>
                    <td><p>{l.item.name}</p><p className="font-mono text-xs text-ink-3">{l.item.sku}{l.item.grade !== "NA" && ` · ${gradeLabel(l.item.grade)}`}{l.item.on_hand < l.qty && <span className="text-warn"> · only {l.item.on_hand} on hand</span>}</p></td>
                    <td className="num">
                      <span className="inline-flex items-center gap-1">
                        <button type="button" aria-label="Decrease" onClick={() => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, qty: Math.max(1, x.qty - 1) } : x)))}><Minus className="size-3.5" /></button>
                        <span className="w-6 text-center">{l.qty}</span>
                        <button type="button" aria-label="Increase" onClick={() => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, qty: x.qty + 1 } : x)))}><Plus className="size-3.5" /></button>
                      </span>
                    </td>
                    <td className="num">{formatPKR(l.item.price)}</td>
                    {canDiscount && <td className="num"><input className="input h-8 w-24 text-right" inputMode="decimal" defaultValue={l.discount ? l.discount / 100 : ""} onBlur={(e) => { const v = rupeesToPaisa(e.target.value || "0") ?? 0; setLines((ls) => ls.map((x, j) => (j === i ? { ...x, discount: Math.min(v, x.qty * x.item.price) } : x))); }} /></td>}
                    <td className={cn("num font-semibold", belowMin.includes(l) && "text-danger")}>{formatPKR(l.qty * l.item.price - l.discount)}</td>
                    <td><button type="button" aria-label="Remove" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} className="text-ink-3 hover:text-danger"><Trash2 className="size-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="card h-fit space-y-4 p-5">
          <label className="block space-y-1"><span className="label">Customer phone (optional — warranty, loyalty, khata)</span><input value={phone} onChange={(e) => setPhone(e.target.value)} className="input" inputMode="tel" placeholder="03xx xxxxxxx" /></label>
          <div className="space-y-1 text-sm">
            <p className="flex justify-between"><span className="text-ink-3">Subtotal</span><span className="money">{formatPKR(subtotal)}</span></p>
            {discount > 0 && <p className="flex justify-between"><span className="text-ink-3">Discount</span><span className="money">−{formatPKR(discount)}</span></p>}
            <p className="flex justify-between pt-1 font-display text-3xl font-bold"><span>Total</span><span className="money">{formatPKR(total)}</span></p>
          </div>
          <div className="space-y-2">
            <span className="label">Payment</span>
            {pays.map((p, i) => (
              <div key={i} className="flex gap-2">
                <select value={p.method} onChange={(e) => setPays((ps) => ps.map((x, j) => (j === i ? { ...x, method: e.target.value } : x)))} className="input h-10 flex-1">
                  {METHODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
                {pays.length > 1 && <input className="input h-10 w-28 text-right" inputMode="decimal" placeholder="Rs" onChange={(e) => { const v = rupeesToPaisa(e.target.value || "0") ?? 0; setPays((ps) => ps.map((x, j) => (j === i ? { ...x, amount: v } : x))); }} />}
                {pays.length > 1 && <button type="button" aria-label="Remove payment" onClick={() => setPays((ps) => ps.filter((_, j) => j !== i))}><X className="size-4 text-ink-3" /></button>}
              </div>
            ))}
            <button type="button" className="text-sm text-accent" onClick={() => setPays((ps) => [...ps, { method: "card", amount: 0 }])}>+ Split payment</button>
            {pays.length > 1 && <p className={cn("text-xs", payTotal === total ? "text-trust" : "text-warn")}>Allocated {formatPKR(payTotal)} of {formatPKR(total)}</p>}
          </div>
          {cashDue > 0 && (
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1"><span className="label">Cash tendered</span><input value={tendered} onChange={(e) => setTendered(e.target.value)} className="input" inputMode="decimal" /></label>
              <div className="space-y-1"><span className="label">Change</span><p className="money font-display text-2xl font-semibold text-trust">{formatPKR(change)}</p></div>
            </div>
          )}
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <button type="button" onClick={complete} disabled={busy || !lines.length} className="btn btn-primary h-14 w-full text-lg">{busy ? "Saving…" : `Charge ${formatPKR(total)}`}</button>
        </aside>
      </div>

      {receipt && <ReceiptModal r={receipt} onClose={() => { setReceipt(null); scan.current?.focus(); }} />}
    </div>
  );
}

function ReceiptModal({ r, onClose }: { r: Receipt; onClose: () => void }) {
  const text = `StarTech Electronics — Sarena Mobile Mall, Buffer Zone, Karachi\n+92 332 2142141\nReceipt #${r.saleNo}\n${r.lines.map((l) => `${l.qty} x ${l.item.name}  ${formatPKR(l.qty * l.item.price - l.discount)}`).join("\n")}\nTotal ${formatPKR(r.total)}\nThank you!`;
  return (
    <div role="dialog" aria-modal="true" aria-label="Receipt" className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 print:static print:bg-white">
      <div className="w-full max-w-sm space-y-4 rounded-2xl bg-surface-1 p-5 print:max-w-[80mm] print:rounded-none print:bg-white print:p-0 print:text-black">
        <div id="receipt" className="space-y-2 font-mono text-xs">
          <p className="text-center text-sm font-bold">StarTech Electronics</p>
          <p className="text-center">Shop # 1F, Sarena Mobile Mall, Buffer Zone, Karachi</p>
          <p className="text-center">+92 332 2142141</p>
          <p className="text-center">#{r.saleNo} · {r.at.toLocaleString("en-PK")}{r.offline && " · OFFLINE (will sync)"}</p>
          <hr className="border-dashed border-line" />
          {r.lines.map((l) => (
            <div key={l.item.id}><p>{l.item.name}{l.item.grade !== "NA" && ` [${gradeLabel(l.item.grade)}]`}</p><p className="flex justify-between"><span>{l.qty} × {formatPKR(l.item.price)}{l.discount ? ` −${formatPKR(l.discount)}` : ""}</span><span>{formatPKR(l.qty * l.item.price - l.discount)}</span></p></div>
          ))}
          <hr className="border-dashed border-line" />
          <p className="flex justify-between text-sm font-bold"><span>TOTAL</span><span>{formatPKR(r.total)}</span></p>
          {r.pays.map((p, i) => <p key={i} className="flex justify-between"><span className="capitalize">{p.method}</span><span>{formatPKR(p.amount)}</span></p>)}
          {r.change > 0 && <p className="flex justify-between"><span>Change</span><span>{formatPKR(r.change)}</span></p>}
          <p className="pt-2 text-center">Warranty saved on your phone number.<br />Verify parts: startech.pk/verify</p>
        </div>
        <div className="flex gap-2 print:hidden">
          <button type="button" onClick={() => window.print()} className="btn btn-ghost flex-1"><Printer className="size-4" />Print 80mm</button>
          {r.phone && <a href={whatsappLink(r.phone, text)} target="_blank" rel="noopener" className="btn btn-ghost flex-1">WhatsApp</a>}
          <button type="button" onClick={onClose} className="btn btn-primary flex-1">Next sale</button>
        </div>
      </div>
    </div>
  );
}
