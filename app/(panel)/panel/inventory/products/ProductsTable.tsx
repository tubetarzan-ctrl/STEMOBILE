"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ImageOff, Trash2 } from "lucide-react";
import { deleteProductsAction, restoreProductAction } from "../actions";
import { formatPKR } from "@/lib/money";

export type ProductRow = { id: string; name: string; online: boolean; image: string | null; category: string; brand: string; skus: string[]; variants: number; price: number; onHand: number; value: number };

export function ProductsTable({ rows, canEdit, archived }: { rows: ProductRow[]; canEdit: boolean; archived: boolean }) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();
  const all = rows.length > 0 && sel.size === rows.length;
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const remove = (ids: string[]) => {
    if (!ids.length) return;
    if (!confirm(`Remove ${ids.length} item(s)?\n\nItems never sold or stocked are deleted. Items with history are archived (hidden) so your books stay correct.`)) return;
    start(async () => {
      const r = await deleteProductsAction(ids);
      setMsg(r.ok ? `Deleted ${r.data.deleted}, archived ${r.data.archived}.` : r.error);
      if (r.ok) { setSel(new Set()); router.refresh(); }
    });
  };

  return (
    <div className="space-y-2">
      {canEdit && !archived && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-ink-3">{sel.size} selected</span>
          <button className="btn btn-ghost btn-sm text-danger" disabled={pending || !sel.size} onClick={() => remove([...sel])}><Trash2 className="size-4" />Delete selected</button>
          {msg && <span>{msg}</span>}
        </div>
      )}
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr>
            {canEdit && !archived && <th className="w-8"><input type="checkbox" aria-label="Select all" checked={all} onChange={() => setSel(all ? new Set() : new Set(rows.map((r) => r.id)))} /></th>}
            <th>Item</th><th>Category</th><th className="num">From</th><th className="num">On hand</th><th className="num">Value (cost)</th><th />
          </tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} className="py-10 text-center text-ink-3">No products. Add one or import a sheet.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}>
                {canEdit && !archived && <td><input type="checkbox" aria-label={`Select ${r.name}`} checked={sel.has(r.id)} onChange={() => toggle(r.id)} /></td>}
                <td>
                  <div className="flex items-center gap-3">
                    {r.image
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={r.image} alt="" className="size-10 shrink-0 rounded-lg object-cover" />
                      : <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface-2"><ImageOff className="size-4 text-ink-3" /></span>}
                    <span className="min-w-0">
                      <span className="block">{r.name}{!r.online && <span className="badge ml-2">shop only</span>}</span>
                      <span className="block truncate font-mono text-xs text-ink-3">{r.skus.slice(0, 3).join(", ")}{r.variants > 3 ? ` +${r.variants - 3}` : ""}</span>
                    </span>
                  </div>
                </td>
                <td className="text-ink-3">{r.category}{r.brand && ` · ${r.brand}`}</td>
                <td className="num">{formatPKR(r.price)}</td>
                <td className="num">{r.onHand}</td>
                <td className="num">{formatPKR(r.value)}</td>
                <td className="whitespace-nowrap text-right">
                  {canEdit && (archived
                    ? <button className="btn btn-ghost btn-sm" disabled={pending} onClick={() => start(async () => { await restoreProductAction(r.id); router.refresh(); })}>Restore</button>
                    : <>
                        <Link href={`/panel/inventory/products/${r.id}`} className="btn btn-ghost btn-sm">Edit</Link>
                        <button className="btn btn-ghost btn-sm text-danger" aria-label={`Delete ${r.name}`} disabled={pending} onClick={() => remove([r.id])}><Trash2 className="size-4" /></button>
                      </>)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
