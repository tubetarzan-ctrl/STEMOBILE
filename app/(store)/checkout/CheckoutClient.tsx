"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, Landmark, Smartphone, Store, Truck, Wallet } from "lucide-react";
import { useCart } from "@/lib/client/stores";
import { formatPKR } from "@/lib/money";
import { placeOrderAction } from "@/app/actions/store";
import { cn } from "@/lib/utils";
import type { BankAccount } from "@/lib/data/bank";
import { BankDetails } from "@/components/store/BankDetails";
import { saveTracking } from "@/lib/client/my-tracking";

type Pay = "cod" | "gateway" | "bank_transfer" | "pay_at_pickup";
type Del = "pickup" | "rider" | "courier";

const PREFS = "st_checkout_prefs"; // returning customers: three-tap checkout

export default function CheckoutClient({ bank }: { bank: BankAccount | null }) {
  const { lines, subtotal, clear } = useCart();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ orderNo: string; token: string; total: number } | null>(null);
  const [delivery, setDelivery] = useState<Del>("rider");
  const [pay, setPay] = useState<Pay>("cod");
  const [prefs, setPrefs] = useState<{ name?: string; phone?: string; city?: string; address?: string }>({});
  const key = useRef(crypto.randomUUID()); // idempotency for this checkout attempt

  useEffect(() => { try { setPrefs(JSON.parse(localStorage.getItem(PREFS) ?? "{}")); } catch { /* ignore */ } }, []);
  useEffect(() => { if (delivery === "pickup" && pay === "cod") setPay("pay_at_pickup"); if (delivery !== "pickup" && pay === "pay_at_pickup") setPay("cod"); }, [delivery, pay]);

  if (done) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <CheckCircle2 className="mx-auto size-12 text-trust" />
        <h1 className="mt-4 font-display text-3xl font-semibold">Order {done.orderNo} placed</h1>
        <p className="mt-3 text-ink-2">{pay === "cod" ? "Please tap Confirm on the WhatsApp message we just sent — we dispatch once you confirm." : pay === "bank_transfer" ? "Transfer the amount below, then upload your receipt so we can confirm your order. We hold your items for 24 hours." : "We'll message you on WhatsApp with updates."}</p>
        {pay === "bank_transfer" && <div className="mt-6 text-left"><BankDetails bank={bank} amount={done.total || undefined} reference={done.orderNo} /></div>}
        <Link href={`/track/${done.orderNo}?t=${done.token}`} className="btn btn-primary mt-8">{pay === "bank_transfer" ? "Upload transfer receipt" : "Track your order"}</Link>
        <p className="mt-4 text-sm text-ink-3">Closed this page? Tap <b>Track</b> at the top of the website any time and enter <b className="font-mono">{done.orderNo}</b> + your mobile number.</p>
      </div>
    );
  }
  if (lines.length === 0) {
    return <div className="mx-auto max-w-xl px-4 py-20 text-center"><p>Your cart is empty.</p><Link href="/shop" className="btn btn-primary mt-6">Shop</Link></div>;
  }

  const Opt = <T extends string>({ value, cur, set, icon: Icon, title, sub }: { value: T; cur: T; set: (v: T) => void; icon: typeof Truck; title: string; sub: string }) => (
    <button type="button" role="radio" aria-checked={cur === value} onClick={() => set(value)} className={cn("card flex items-start gap-3 p-4 text-left", cur === value && "glow border-transparent")}>
      <Icon className="mt-0.5 size-5 text-accent" /><span><span className="block font-medium">{title}</span><span className="text-sm text-ink-3">{sub}</span></span>
    </button>
  );

  return (
    <form
      className="mx-auto grid max-w-6xl gap-10 px-4 py-12 lg:grid-cols-[1fr_360px]"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const data = { name: String(f.get("name")), phone: String(f.get("phone")), city: String(f.get("city")), address: String(f.get("address") ?? "") };
        setError(null);
        start(async () => {
          const r = await placeOrderAction({
            idempotencyKey: key.current, ...data, address: data.address || undefined, paymentMethod: pay, deliveryMethod: delivery,
            discountCode: String(f.get("code") ?? "") || undefined, items: lines.map((l) => ({ variantId: l.variantId, qty: l.qty })),
          });
          if (!r.ok) { setError(r.error); key.current = crypto.randomUUID(); return; }
          try { localStorage.setItem(PREFS, JSON.stringify(data)); } catch { /* ignore */ }
          clear();
          if (r.data.payUrl) { window.location.href = r.data.payUrl; return; }
          setDone({ orderNo: r.data.orderNo, token: r.data.token, total: r.data.total });
          saveTracking({ no: r.data.orderNo, url: `/track/${r.data.orderNo}?t=${r.data.token}`, kind: "order" });
        });
      }}
    >
      <div className="space-y-10">
        <h1 className="font-display text-4xl font-semibold">Checkout</h1>
        <section className="space-y-3">
          <h2 className="eyebrow">1 · You</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1"><span className="label">Full name</span><input name="name" required defaultValue={prefs.name} key={prefs.name} className="input" autoComplete="name" /></label>
            <label className="space-y-1"><span className="label">Mobile (WhatsApp)</span><input name="phone" required defaultValue={prefs.phone} key={prefs.phone} className="input" inputMode="tel" placeholder="03xx xxxxxxx" autoComplete="tel" /></label>
          </div>
        </section>
        <section className="space-y-3">
          <h2 className="eyebrow">2 · Delivery</h2>
          <div className="grid gap-3 sm:grid-cols-3" role="radiogroup">
            <Opt value="pickup" cur={delivery} set={setDelivery} icon={Store} title="Shop pickup" sub="Sarena Mobile Mall · free" />
            <Opt value="rider" cur={delivery} set={setDelivery} icon={Smartphone} title="Karachi rider" sub="Same / next day" />
            <Opt value="courier" cur={delivery} set={setDelivery} icon={Truck} title="Courier" sub="All Pakistan · 2–3 days" />
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
            <label className="space-y-1"><span className="label">City</span><input name="city" required defaultValue={prefs.city ?? "Karachi"} key={prefs.city} className="input" autoComplete="address-level2" /></label>
            {delivery !== "pickup" && <label className="space-y-1"><span className="label">Address</span><input name="address" required defaultValue={prefs.address} key={prefs.address} className="input" autoComplete="street-address" /></label>}
          </div>
        </section>
        <section className="space-y-3">
          <h2 className="eyebrow">3 · Payment</h2>
          <div className="grid gap-3 sm:grid-cols-3" role="radiogroup">
            {delivery === "pickup"
              ? <Opt value="pay_at_pickup" cur={pay} set={setPay} icon={Wallet} title="Pay at pickup" sub="Cash, card or Raast" />
              : <Opt value="cod" cur={pay} set={setPay} icon={Wallet} title="Cash on delivery" sub="Confirm on WhatsApp" />}
            <Opt value="gateway" cur={pay} set={setPay} icon={Smartphone} title="Raast / card" sub="Instant, no receipt needed" />
            <Opt value="bank_transfer" cur={pay} set={setPay} icon={Landmark} title="Bank transfer" sub="Upload receipt · held 24h" />
          </div>
          {pay === "bank_transfer" && (
            <div className="space-y-2">
              <BankDetails bank={bank} />
              <p className="text-xs text-ink-3">Place the order first — you&apos;ll get the exact amount and can upload your transfer receipt on the next screen.</p>
            </div>
          )}
        </section>
      </div>
      <aside className="card h-fit space-y-4 p-5 lg:sticky lg:top-24">
        <h2 className="font-display text-lg font-semibold">Summary</h2>
        <ul className="space-y-2 text-sm">
          {lines.map((l) => <li key={l.variantId} className="flex justify-between gap-3"><span className="text-ink-2">{l.qty} × {l.name}</span><span className="money">{formatPKR(l.qty * l.price)}</span></li>)}
        </ul>
        <label className="block space-y-1"><span className="label">Discount code</span><input name="code" className="input uppercase" /></label>
        <div className="flex justify-between border-t border-line pt-3"><span>Subtotal</span><span className="money font-semibold">{formatPKR(subtotal)}</span></div>
        <p className="text-xs text-ink-3">Delivery fee and final prices are confirmed by the shop and shown on your order.</p>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <button className="btn btn-primary w-full" disabled={pending}>{pending ? "Placing order…" : "Place order"}</button>
      </aside>
    </form>
  );
}
