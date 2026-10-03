"use client";
import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useCart } from "@/lib/client/stores";
import { formatPKR } from "@/lib/money";
import { GradeBadge } from "@/components/ui/badges";

export default function CartPage() {
  const { lines, setQty, subtotal } = useCart();
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="mb-8 font-display text-4xl font-semibold">Your cart</h1>
      {lines.length === 0 ? (
        <div className="card grid place-items-center gap-4 p-14 text-center">
          <ShoppingBag className="size-8 text-ink-3" />
          <p>Your cart is empty.</p>
          <Link href="/shop" className="btn btn-primary">Shop parts that fit</Link>
        </div>
      ) : (
        <div className="grid gap-8 md:grid-cols-[1fr_300px]">
          <ul className="divide-y divide-line border-y border-line">
            {lines.map((l) => (
              <li key={l.variantId} className="flex items-center gap-4 py-4">
                <div className="min-w-0 flex-1">
                  <Link href={`/shop/${l.productSlug}`} className="font-medium hover:text-accent">{l.name}</Link>
                  <div className="mt-1 flex items-center gap-2"><GradeBadge grade={l.grade} /><span className="font-mono text-xs text-ink-3">{l.sku}</span></div>
                </div>
                <div className="flex items-center gap-1 rounded-xl border border-line">
                  <button type="button" className="grid size-9 place-items-center" aria-label="Decrease" onClick={() => setQty(l.variantId, l.qty - 1)}><Minus className="size-4" /></button>
                  <span className="w-6 text-center tabular">{l.qty}</span>
                  <button type="button" className="grid size-9 place-items-center" aria-label="Increase" onClick={() => setQty(l.variantId, Math.min(l.qty + 1, 20))}><Plus className="size-4" /></button>
                </div>
                <span className="money w-24 text-right font-semibold">{formatPKR(l.price * l.qty)}</span>
                <button type="button" aria-label={`Remove ${l.name}`} className="text-ink-3 hover:text-danger" onClick={() => setQty(l.variantId, 0)}><Trash2 className="size-4" /></button>
              </li>
            ))}
          </ul>
          <aside className="card h-fit space-y-4 p-5">
            <div className="flex justify-between"><span className="text-ink-2">Subtotal</span><span className="money font-semibold">{formatPKR(subtotal)}</span></div>
            <p className="text-xs text-ink-3">Delivery and discounts calculated at checkout. Prices are confirmed by the shop when you place the order.</p>
            <Link href="/checkout" className="btn btn-primary w-full">Checkout</Link>
          </aside>
        </div>
      )}
    </div>
  );
}
