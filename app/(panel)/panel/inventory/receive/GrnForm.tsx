"use client";
import { useMemo, useRef, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { receiveGrnAction } from "@/app/actions/panel";
import { allocate, formatPKR, rupeesToPaisa } from "@/lib/money";

type Line = { variant_id: string; label: string; qty: number; unit_fc: number };
type Charge = { kind: "freight" | "customs" | "clearing" | "other"; amount: number; allocate_by: "value" | "qty" };

export function GrnForm({ suppliers, locations }: { suppliers: { id: string; name: string; currency: string }[]; locations: { id: number; code: string; name: string }[] }) {
  const [supplier, setSupplier] = useState(suppliers[0]?.id ?? "");
  const currency = suppliers.find((s) => s.id === supplier)?.currency ?? "PKR";
  const [fx, setFx] = useState(currency === "PKR" ? "1" : "280");
  const [lines, setLines] = useState<Line[]>([]);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [sku, setSku] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const key = useRef(crypto.randomUUID());
  const rate = Number(fx) || 1;

  // Live landed-cost preview (same allocation as the receive_grn RPC).
  const preview = useMemo(() => {
    const base = lines.map((l) => Math.round(l.qty * l.unit_fc * rate));
    const alloc = base.map(() => 0);
    for (const c of charges) {
      const parts = allocate(c.amount, c.allocate_by === "qty" ? lines.map((l) => l.qty) : base);
      parts.forEach((p, i) => (alloc[i] += p));
    }
    return lines.map((l, i) => ({ base: base[i], alloc: alloc[i], unit: l.qty ? Math.round((base[i] + alloc[i]) / l.qty) : 0 }));
  }, [lines, charges, rate]);

  const addLine = async () => {
    const r = await fetch(`/api/panel/variant?sku=${encodeURIComponent(sku.trim())}`).then((x) => x.json());
    if (!r.id) return setMsg(`SKU ${sku} not found`);
    setLines((ls) => [...ls, { variant_id: r.id, label: `${r.products?.name ?? ""} · ${r.sku}`, qty: 1, unit_fc: 0 }]);
    setSku(""); setMsg(null);
  };

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        if (!lines.length) return setMsg("Add at least one line");
        start(async () => {
          const r = await receiveGrnAction({
            supplier_id: supplier, location_id: Number(f.get("location")), currency, fx_rate: rate, bill_no: String(f.get("bill") ?? ""),
            idempotency_key: key.current, lines: lines.map((l) => ({ variant_id: l.variant_id, qty: l.qty, unit_cost_fc: l.unit_fc })),
            charges: charges.filter((c) => c.amount > 0),
          });
          if (r.ok) { setMsg("Received ✓ — stock, average cost and the ledger are updated."); setLines([]); setCharges([]); key.current = crypto.randomUUID(); }
          else setMsg(r.error);
        });
      }}
    >
      <div className="card grid gap-4 p-5 sm:grid-cols-4">
        <label className="space-y-1"><span className="label">Supplier</span><select value={supplier} onChange={(e) => setSupplier(e.target.value)} className="input">{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.currency})</option>)}</select></label>
        <label className="space-y-1"><span className="label">Supplier bill no.</span><input name="bill" className="input" /></label>
        <label className="space-y-1"><span className="label">FX rate (PKR per 1 {currency})</span><input value={currency === "PKR" ? "1" : fx} onChange={(e) => setFx(e.target.value)} disabled={currency === "PKR"} className="input" inputMode="decimal" /></label>
        <label className="space-y-1"><span className="label">Receive into</span><select name="location" className="input" defaultValue={locations.find((l) => l.code === "BACK")?.id}>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead><tr><th>Item</th><th className="num">Qty</th><th className="num">Unit cost ({currency})</th><th className="num">Goods (PKR)</th><th className="num">+ Charges</th><th className="num">Landed / unit</th><th /></tr></thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i}>
                <td>{l.label}</td>
                <td className="num"><input type="number" min={1} value={l.qty} onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, qty: Math.max(1, Number(e.target.value)) } : x)))} className="input h-9 w-20 text-right" /></td>
                <td className="num"><input inputMode="decimal" defaultValue="" placeholder="0.00" onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, unit_fc: rupeesToPaisa(e.target.value || "0") ?? 0 } : x)))} className="input h-9 w-28 text-right" /></td>
                <td className="num">{formatPKR(preview[i]?.base ?? 0)}</td><td className="num text-ink-3">{formatPKR(preview[i]?.alloc ?? 0)}</td><td className="num font-semibold">{formatPKR(preview[i]?.unit ?? 0)}</td>
                <td><button type="button" aria-label="Remove line" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}><Trash2 className="size-4 text-ink-3" /></button></td>
              </tr>
            ))}
            <tr>
              <td colSpan={7}>
                <div className="flex gap-2"><input value={sku} onChange={(e) => setSku(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLine(); } }} className="input h-9 max-w-xs" placeholder="Scan / type SKU or barcode" /><button type="button" onClick={addLine} className="btn btn-ghost btn-sm"><Plus className="size-4" />Add line</button></div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="card space-y-3 p-5">
        <h2 className="font-medium">Landed-cost charges (PKR)</h2>
        {charges.map((c, i) => (
          <div key={i} className="flex flex-wrap gap-2">
            <select value={c.kind} onChange={(e) => setCharges((cs) => cs.map((x, j) => (j === i ? { ...x, kind: e.target.value as Charge["kind"] } : x)))} className="input h-10 w-36">{["freight", "customs", "clearing", "other"].map((k) => <option key={k}>{k}</option>)}</select>
            <input inputMode="decimal" placeholder="Rs" onChange={(e) => setCharges((cs) => cs.map((x, j) => (j === i ? { ...x, amount: rupeesToPaisa(e.target.value || "0") ?? 0 } : x)))} className="input h-10 w-40" />
            <select value={c.allocate_by} onChange={(e) => setCharges((cs) => cs.map((x, j) => (j === i ? { ...x, allocate_by: e.target.value as Charge["allocate_by"] } : x)))} className="input h-10 w-44"><option value="value">Allocate by value</option><option value="qty">Allocate by quantity</option></select>
            <button type="button" aria-label="Remove charge" onClick={() => setCharges((cs) => cs.filter((_, j) => j !== i))}><Trash2 className="size-4 text-ink-3" /></button>
          </div>
        ))}
        <button type="button" onClick={() => setCharges((cs) => [...cs, { kind: "freight", amount: 0, allocate_by: "value" }])} className="text-sm text-accent">+ Add charge</button>
      </div>

      <div className="flex items-center gap-4">
        <button className="btn btn-primary" disabled={pending}>{pending ? "Posting…" : "Receive & post"}</button>
        <p className="text-sm text-ink-3">Total landed: <span className="money font-semibold text-ink">{formatPKR(preview.reduce((a, p) => a + p.base + p.alloc, 0))}</span></p>
        {msg && <p className="text-sm">{msg}</p>}
      </div>
    </form>
  );
}
