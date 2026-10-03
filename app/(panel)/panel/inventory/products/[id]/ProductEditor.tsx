"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Plus, Trash2, X } from "lucide-react";
import { saveProductAction } from "../../actions";
import { compressImage, useUploadThing } from "@/lib/client/upload";
import { GRADES, gradeLabel } from "@/lib/grades";
import { rupeesToPaisa } from "@/lib/money";

type Opt = { id: string; name: string };
type V = { id?: string; sku: string; barcode: string; grade: string; sale_price: number; min_price: number; reorder_level: number; opening_qty?: number; opening_cost?: number };
export type EditorProduct = { id: string; name: string; category_id: string; brand_id: string | null; description: string; warranty_days: number; is_online: boolean; images: string[]; devices: string[]; variants: V[] };

const rs = (p: number) => (p ? String(p / 100) : "");
const toP = (s: string) => rupeesToPaisa(s || "0") ?? 0;

export function ProductEditor({ product, categories, brands, devices }: { product: EditorProduct | null; categories: Opt[]; brands: Opt[]; devices: Opt[] }) {
  const [p, setP] = useState<EditorProduct>(product ?? {
    id: "", name: "", category_id: categories[0]?.id ?? "", brand_id: null, description: "", warranty_days: 0, is_online: true, images: [], devices: [],
    variants: [{ sku: "", barcode: "", grade: "NA", sale_price: 0, min_price: 0, reorder_level: 2, opening_qty: 0, opening_cost: 0 }],
  });
  const [devQ, setDevQ] = useState("");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();
  const { startUpload, isUploading } = useUploadThing("productImage");
  const setV = (i: number, patch: Partial<V>) => setP((x) => ({ ...x, variants: x.variants.map((v, j) => (j === i ? { ...v, ...patch } : v)) }));
  const devHits = useMemo(() => {
    const s = devQ.trim().toLowerCase();
    return s.length < 2 ? [] : devices.filter((d) => d.name.toLowerCase().includes(s) && !p.devices.includes(d.id)).slice(0, 8);
  }, [devQ, devices, p.devices]);
  const devName = (id: string) => devices.find((d) => d.id === id)?.name ?? id;
  const moveImg = (i: number, d: number) => setP((x) => { const a = [...x.images]; const j = i + d; if (j < 0 || j >= a.length) return x; [a[i], a[j]] = [a[j], a[i]]; return { ...x, images: a }; });

  return (
    <form className="space-y-6" onSubmit={(e) => {
      e.preventDefault();
      start(async () => {
        const r = await saveProductAction({ ...p, id: p.id || undefined, brand_id: p.brand_id || null });
        if (!r.ok) return setMsg(r.error);
        setMsg("✓ Saved");
        if (!p.id) router.replace(`/panel/inventory/products/${r.data.id}`); else router.refresh();
      });
    }}>
      <section className="card grid gap-3 p-5 sm:grid-cols-2">
        <label className="space-y-1 sm:col-span-2"><span className="label">Product name</span><input className="input" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} required placeholder="e.g. Galaxy A54 LCD with frame" /></label>
        <label className="space-y-1"><span className="label">Category</span><select className="input" value={p.category_id} onChange={(e) => setP({ ...p, category_id: e.target.value })}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label className="space-y-1"><span className="label">Brand</span><select className="input" value={p.brand_id ?? ""} onChange={(e) => setP({ ...p, brand_id: e.target.value || null })}><option value="">—</option>{brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
        <label className="space-y-1"><span className="label">Warranty (days)</span><input className="input" inputMode="numeric" value={p.warranty_days || ""} onChange={(e) => setP({ ...p, warranty_days: parseInt(e.target.value) || 0 })} /></label>
        <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" checked={p.is_online} onChange={(e) => setP({ ...p, is_online: e.target.checked })} /> Show on website</label>
        <label className="space-y-1 sm:col-span-2"><span className="label">Description (optional)</span><textarea className="input" rows={3} value={p.description} onChange={(e) => setP({ ...p, description: e.target.value })} /></label>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-medium">Prices &amp; SKUs</h2>
        {p.variants.map((v, i) => (
          <div key={v.id ?? `n${i}`} className="grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-4">
            <label className="space-y-1"><span className="label">SKU</span><input className="input h-10 font-mono uppercase" value={v.sku} onChange={(e) => setV(i, { sku: e.target.value })} required /></label>
            <label className="space-y-1"><span className="label">Barcode</span><input className="input h-10 font-mono" value={v.barcode} onChange={(e) => setV(i, { barcode: e.target.value })} /></label>
            <label className="space-y-1"><span className="label">Grade</span><select className="input h-10" value={v.grade} onChange={(e) => setV(i, { grade: e.target.value })}>{[...Object.keys(GRADES), "NA"].map((g) => <option key={g} value={g}>{g === "NA" ? "No grade (accessory)" : gradeLabel(g)}</option>)}</select></label>
            <label className="space-y-1"><span className="label">Sale price (Rs)</span><input className="input h-10" inputMode="decimal" defaultValue={rs(v.sale_price)} onBlur={(e) => setV(i, { sale_price: toP(e.target.value) })} required /></label>
            <label className="space-y-1"><span className="label">Lowest price (Rs)</span><input className="input h-10" inputMode="decimal" defaultValue={rs(v.min_price)} onBlur={(e) => setV(i, { min_price: toP(e.target.value) })} /></label>
            <label className="space-y-1"><span className="label">Alert when stock ≤</span><input className="input h-10" inputMode="numeric" value={v.reorder_level} onChange={(e) => setV(i, { reorder_level: parseInt(e.target.value) || 0 })} /></label>
            {!v.id && <>
              <label className="space-y-1"><span className="label">Opening stock (qty)</span><input className="input h-10" inputMode="numeric" value={v.opening_qty || ""} onChange={(e) => setV(i, { opening_qty: parseInt(e.target.value) || 0 })} /></label>
              <label className="space-y-1"><span className="label">Cost per piece (Rs)</span><input className="input h-10" inputMode="decimal" defaultValue={rs(v.opening_cost ?? 0)} onBlur={(e) => setV(i, { opening_cost: toP(e.target.value) })} /></label>
            </>}
            {!v.id && p.variants.length > 1 && <button type="button" className="self-end text-sm text-danger" onClick={() => setP({ ...p, variants: p.variants.filter((_, j) => j !== i) })}><Trash2 className="inline size-4" /> Remove row</button>}
          </div>
        ))}
        <button type="button" className="text-sm text-accent" onClick={() => setP({ ...p, variants: [...p.variants, { sku: "", barcode: "", grade: "OEM", sale_price: 0, min_price: 0, reorder_level: 2, opening_qty: 0, opening_cost: 0 }] })}><Plus className="inline size-4" /> Add another grade / price</button>
        <p className="text-xs text-ink-3">Existing stock is changed through Receive goods or a stock adjustment — never by editing here, so the books stay right.</p>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-medium">Photos</h2>
        <div className="flex flex-wrap gap-3">
          {p.images.map((u, i) => (
            <div key={u} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="" className="size-24 rounded-xl object-cover" />
              <div className="absolute inset-x-1 bottom-1 flex justify-between">
                <button type="button" aria-label="Move left" className="rounded bg-black/60 p-0.5 text-white" onClick={() => moveImg(i, -1)}><ArrowLeft className="size-3" /></button>
                <button type="button" aria-label="Remove photo" className="rounded bg-black/60 p-0.5 text-white" onClick={() => setP({ ...p, images: p.images.filter((x) => x !== u) })}><X className="size-3" /></button>
                <button type="button" aria-label="Move right" className="rounded bg-black/60 p-0.5 text-white" onClick={() => moveImg(i, 1)}><ArrowRight className="size-3" /></button>
              </div>
              {i === 0 && <span className="absolute left-1 top-1 rounded bg-accent px-1 text-[10px] text-accent-ink">main</span>}
            </div>
          ))}
          <label className="grid size-24 cursor-pointer place-items-center rounded-xl border border-dashed border-line text-center text-xs text-ink-3 hover:bg-surface-2">
            {isUploading ? "Uploading…" : <span><Plus className="mx-auto size-5" />Add photos</span>}
            <input type="file" accept="image/*" multiple className="sr-only" onChange={async (e) => {
              const files = await Promise.all([...(e.target.files ?? [])].slice(0, 8).map((f) => compressImage(f)));
              const res = await startUpload(files).catch((err: Error) => { setMsg(err.message); return null; });
              if (res) setP((x) => ({ ...x, images: [...x.images, ...res.map((r) => r.ufsUrl)] }));
              e.target.value = "";
            }} />
          </label>
        </div>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-medium">Fits these phones <span className="text-sm font-normal text-ink-3">(leave empty for universal accessories)</span></h2>
        <div className="flex flex-wrap gap-2">{p.devices.map((d) => (
          <span key={d} className="badge flex items-center gap-1">{devName(d)}<button type="button" aria-label="Remove" onClick={() => setP({ ...p, devices: p.devices.filter((x) => x !== d) })}><X className="size-3" /></button></span>
        ))}</div>
        <input className="input h-10" value={devQ} onChange={(e) => setDevQ(e.target.value)} placeholder="Type a phone, e.g. A54 or iPhone 15" />
        {devHits.length > 0 && <ul className="rounded-xl border border-line">{devHits.map((d) => (
          <li key={d.id}><button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-surface-2" onClick={() => { setP({ ...p, devices: [...p.devices, d.id] }); setDevQ(""); }}>{d.name}</button></li>
        ))}</ul>}
      </section>

      <div className="flex items-center gap-3">
        <button className="btn btn-primary" disabled={pending || isUploading}>{pending ? "Saving…" : "Save product"}</button>
        {msg && <span className="text-sm">{msg}</span>}
      </div>
    </form>
  );
}
