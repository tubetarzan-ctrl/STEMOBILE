"use client";
import { useState, useTransition } from "react";
import { Download, Plus, Upload } from "lucide-react";
import { attachPhotosAction, importProductsAction, type ImportRow } from "../actions";
import { compressImage, useUploadThing } from "@/lib/client/upload";
import { rupeesToPaisa } from "@/lib/money";

// Sheet columns. Money is typed in rupees and converted to paisa on import.
const COLS = [
  ["name", "Name *", "w-56"], ["category", "Category *", "w-36"], ["brand", "Brand", "w-28"], ["sku", "SKU", "w-32"],
  ["grade", "Grade", "w-28"], ["price", "Sale price Rs *", "w-28"], ["min_price", "Lowest Rs", "w-24"],
  ["cost", "Cost Rs", "w-24"], ["qty", "Qty", "w-20"], ["barcode", "Barcode", "w-32"],
] as const;
type Key = (typeof COLS)[number][0];
type Row = Record<Key, string>;
const GRADES = ["NA", "ORIG_NEW", "ORIG_PULL", "OEM", "PREMIUM", "STANDARD"];
const blank = (): Row => ({ name: "", category: "", brand: "", sku: "", grade: "NA", price: "", min_price: "", cost: "", qty: "", barcode: "" });

// Header aliases so most shop spreadsheets map without editing.
const ALIAS: Record<string, Key> = {
  name: "name", item: "name", product: "name", "item name": "name", description: "name",
  category: "category", cat: "category", type: "category", brand: "brand", company: "brand",
  sku: "sku", code: "sku", "item code": "sku", grade: "grade", quality: "grade",
  price: "price", "sale price": "price", "sale price rs": "price", "sale price rs *": "price", rate: "price", "selling price": "price",
  "min price": "min_price", "lowest rs": "min_price", "lowest price": "min_price", min_price: "min_price",
  cost: "cost", "cost rs": "cost", "cost price": "cost", "purchase price": "cost",
  qty: "qty", quantity: "qty", stock: "qty", "opening stock": "qty", barcode: "barcode",
};

function toRows(matrix: string[][]): Row[] {
  if (!matrix.length) return [];
  const head = matrix[0].map((h) => ALIAS[String(h ?? "").trim().toLowerCase().replace(/\s+/g, " ")]);
  const hasHeader = head.filter(Boolean).length >= 2;
  const keys: (Key | undefined)[] = hasHeader ? head : COLS.map((c) => c[0]);
  return (hasHeader ? matrix.slice(1) : matrix)
    .filter((r) => r.some((c) => String(c ?? "").trim()))
    .map((r) => { const row = blank(); keys.forEach((k, i) => { if (k && r[i] != null) row[k] = String(r[i]).trim(); }); return row; });
}

function parseText(text: string): string[][] {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim());
  const sep = lines[0]?.includes("\t") ? "\t" : lines[0]?.includes(";") && !lines[0].includes(",") ? ";" : ",";
  return lines.map((l) => {
    if (sep !== ",") return l.split(sep);
    const out: string[] = []; let cur = "", q = false;   // minimal CSV with quotes
    for (const ch of l) {
      if (ch === '"') q = !q; else if (ch === "," && !q) { out.push(cur); cur = ""; } else cur += ch;
    }
    out.push(cur);
    return out;
  });
}

export function ImportSheet({ categories }: { categories: string[] }) {
  const [rows, setRows] = useState<Row[]>(() => Array.from({ length: 8 }, blank));
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const filled = rows.filter((r) => r.name.trim());
  const set = (i: number, k: Key, v: string) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r)));

  const load = (incoming: Row[]) => {
    if (!incoming.length) return setMsg("Nothing found in that file.");
    setRows((rs) => [...rs.filter((r) => r.name.trim()), ...incoming, blank()]);
    setMsg(`Loaded ${incoming.length} rows — check them, then press Import.`);
  };

  const template = () => {
    const csv = [COLS.map((c) => c[1].replace(" *", "")).join(","), `Galaxy A54 LCD with frame,Displays,Samsung,A54-LCD-OEM,OEM,8500,8000,6200,5,`, `20W USB-C charger,Chargers,Anker,ANK-20W,NA,2500,2300,1600,12,`].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "startech-products-template.csv";
    a.click();
  };

  const submit = () => {
    const bad = filled.find((r) => !r.category || !r.price);
    if (bad) return setMsg(`"${bad.name}" needs a category and a sale price.`);
    const data: ImportRow[] = filled.map((r) => ({
      name: r.name, category: r.category, brand: r.brand || undefined, sku: r.sku || undefined, grade: (r.grade || "NA").toUpperCase(),
      price: rupeesToPaisa(r.price) ?? 0, min_price: r.min_price ? rupeesToPaisa(r.min_price) ?? 0 : undefined,
      cost: r.cost ? rupeesToPaisa(r.cost) ?? 0 : undefined, qty: parseInt(r.qty) || 0, barcode: r.barcode || undefined,
    }));
    start(async () => {
      const res = await importProductsAction(data);
      if (!res.ok) return setMsg(res.error);
      setMsg(`✓ ${res.data.created} new items, ${res.data.updated} updated, opening stock posted for ${res.data.stocked}.`);
      setRows(Array.from({ length: 8 }, blank));
    });
  };

  return (
    <section className="card space-y-4 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto font-display text-xl font-semibold">1 · Items sheet</h2>
        <button type="button" className="btn btn-ghost btn-sm" onClick={template}><Download className="size-4" />Download template</button>
        <label className="btn btn-ghost btn-sm cursor-pointer"><Upload className="size-4" />Upload Excel / CSV / TXT
          <input type="file" accept=".xlsx,.csv,.txt,.tsv" className="sr-only" onChange={async (e) => {
            const f = e.target.files?.[0]; if (!f) return;
            try {
              if (/\.xlsx$/i.test(f.name)) {
                const { default: readXlsx } = await import("read-excel-file");
                const m = await readXlsx(f);
                load(toRows(m.map((r) => r.map((c) => (c == null ? "" : String(c))))));
              } else load(toRows(parseText(await f.text())));
            } catch { setMsg("Couldn't read that file. Save it as .xlsx or .csv and try again."); }
            e.target.value = "";
          }} />
        </label>
      </div>
      <p className="text-sm text-ink-3">
        Tip: copy rows from Excel and paste into any Name cell. Categories: {categories.join(", ")}. Grades: {GRADES.join(", ")}.
        Same SKU again = update price only. Leave SKU empty to auto-create one.
      </p>
      <div className="overflow-x-auto">
        <table className="text-sm">
          <thead><tr>{COLS.map(([k, l]) => <th key={k} className="px-1 py-1 text-left font-medium text-ink-3">{l}</th>)}</tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {COLS.map(([k, , w]) => (
                  <td key={k} className="p-0.5">
                    {k === "category" ? (
                      <select className={`input h-9 ${w} text-sm`} value={r.category} onChange={(e) => set(i, k, e.target.value)}>
                        <option value="">—</option>{categories.map((c) => <option key={c}>{c}</option>)}
                        {r.category && !categories.includes(r.category) && <option>{r.category}</option>}
                      </select>
                    ) : k === "grade" ? (
                      <select className={`input h-9 ${w} text-sm`} value={r.grade} onChange={(e) => set(i, k, e.target.value)}>{GRADES.map((g) => <option key={g}>{g}</option>)}</select>
                    ) : (
                      <input className={`input h-9 ${w} text-sm`} value={r[k]} onChange={(e) => set(i, k, e.target.value)}
                        inputMode={["price", "min_price", "cost", "qty"].includes(k) ? "decimal" : undefined}
                        onPaste={k === "name" ? (e) => {
                          const t = e.clipboardData.getData("text");
                          if (!t.includes("\t") && !t.includes("\n")) return;
                          e.preventDefault();
                          load(toRows(parseText(t)));
                        } : undefined} />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRows((rs) => [...rs, ...Array.from({ length: 10 }, blank)])}><Plus className="size-4" />10 more rows</button>
        <button type="button" className="btn btn-primary" disabled={pending || !filled.length} onClick={submit}>{pending ? "Importing…" : `Import ${filled.length} items`}</button>
        {msg && <span className="text-sm">{msg}</span>}
      </div>
    </section>
  );
}

/** Many photos at once; each file name is the item's SKU. */
export function BulkPhotos() {
  const { startUpload, isUploading } = useUploadThing("productImage");
  const [msg, setMsg] = useState<string | null>(null);
  const [progress, setProgress] = useState("");
  return (
    <section className="card space-y-3 p-5">
      <h2 className="font-display text-xl font-semibold">2 · Bulk photos</h2>
      <p className="text-sm text-ink-3">Name each photo with the item&apos;s SKU, e.g. <span className="font-mono">A54-LCD-OEM.jpg</span> (extra photos: <span className="font-mono">A54-LCD-OEM-2.jpg</span>). Select them all at once — they upload to UploadThing and attach automatically. One photo per item? Use Edit on the product instead.</p>
      <label className="btn btn-primary w-fit cursor-pointer">
        <Upload className="size-4" />{isUploading ? `Uploading… ${progress}` : "Choose photos"}
        <input type="file" accept="image/*" multiple className="sr-only" disabled={isUploading} onChange={async (e) => {
          const list = [...(e.target.files ?? [])];
          if (!list.length) return;
          setMsg(null);
          const results: { name: string; url: string }[] = [];
          for (let i = 0; i < list.length; i += 8) {        // batches of 8 keep uploads reliable on shop Wi-Fi
            setProgress(`${i}/${list.length}`);
            const batch = await Promise.all(list.slice(i, i + 8).map(async (f) => ({ orig: f.name, file: await compressImage(f) })));
            const res = await startUpload(batch.map((b) => b.file)).catch((err: Error) => { setMsg(err.message); return null; });
            if (!res) break;
            res.forEach((r, k) => results.push({ name: batch[k].orig, url: r.ufsUrl }));
          }
          setProgress("");
          if (!results.length) return;
          const r = await attachPhotosAction(results);
          if (r.ok) setMsg(`✓ ${r.data.matched} photos attached.${r.data.unmatched.length ? ` No SKU match for: ${r.data.unmatched.join(", ")}` : ""}`);
          else setMsg(r.error);
          e.target.value = "";
        }} />
      </label>
      {msg && <p className="text-sm">{msg}</p>}
    </section>
  );
}
