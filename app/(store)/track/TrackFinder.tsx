"use client";
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { ChevronRight, Package, Wrench } from "lucide-react";
import { trackAction, type TrackHit } from "@/app/actions/store";
import { loadTracking, saveTracking, type Saved } from "@/lib/client/my-tracking";
import { formatPKR } from "@/lib/money";

const label = (s: string) => s.replace(/_/g, " ");

function Row({ hit, kind }: { hit: TrackHit; kind: "order" | "repair" }) {
  const Icon = kind === "order" ? Package : Wrench;
  return (
    <Link href={hit.url} className="card flex items-center gap-3 p-4 text-left hover:bg-surface-2">
      <Icon className="size-5 shrink-0 text-accent" />
      <span className="min-w-0 flex-1">
        <span className="block font-mono font-medium">{hit.no}</span>
        <span className="block truncate text-sm capitalize text-ink-3">
          {label(hit.status)}{hit.device ? ` · ${hit.device}` : ""}{hit.total ? ` · ${formatPKR(hit.total)}` : ""}
        </span>
      </span>
      <ChevronRight className="size-4 text-ink-3" />
    </Link>
  );
}

export function TrackFinder() {
  const [ref, setRef] = useState("");
  const [phone, setPhone] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<{ orders: TrackHit[]; repairs: TrackHit[] } | null>(null);
  const [saved, setSaved] = useState<Saved[]>([]);
  const [pending, start] = useTransition();
  useEffect(() => setSaved(loadTracking()), []);

  return (
    <div className="space-y-8 text-left">
      {saved.length > 0 && !res && (
        <section className="space-y-2">
          <h2 className="eyebrow">On this phone</h2>
          {saved.map((s) => (
            <Link key={s.no} href={s.url} className="card flex items-center gap-3 p-4 hover:bg-surface-2">
              {s.kind === "order" ? <Package className="size-5 text-accent" /> : <Wrench className="size-5 text-accent" />}
              <span className="flex-1 font-mono font-medium">{s.no}</span>
              <span className="text-sm text-accent">Open</span>
            </Link>
          ))}
        </section>
      )}

      <form
        className="card space-y-3 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          setErr(null);
          start(async () => {
            const r = await trackAction(ref, phone);
            if (!r.ok) return setErr(r.error);
            setRes(r.data);
            r.data.orders.forEach((o) => saveTracking({ no: o.no, url: o.url, kind: "order" }));
            r.data.repairs.forEach((j) => saveTracking({ no: j.no, url: j.url, kind: "repair" }));
          });
        }}
      >
        <label className="block space-y-1">
          <span className="text-sm font-medium">Order or repair number</span>
          <input value={ref} onChange={(e) => setRef(e.target.value)} required className="input font-mono uppercase" placeholder="ST-000123 or RJ-000018" autoComplete="off" />
          <span className="block text-xs text-ink-3">It&apos;s on your WhatsApp message and receipt. Short form works too, e.g. ST-8 or RJ-18.</span>
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Your mobile number</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} required inputMode="tel" className="input" placeholder="03XX XXXXXXX" autoComplete="tel" />
        </label>
        {err && <p className="text-sm text-danger" role="alert">{err}</p>}
        <button className="btn btn-primary w-full" disabled={pending}>{pending ? "Finding…" : "Track"}</button>
      </form>

      {res && (
        <section className="space-y-4">
          {res.repairs.length > 0 && <div className="space-y-2"><h2 className="eyebrow">Your repairs</h2>{res.repairs.map((h) => <Row key={h.no} hit={h} kind="repair" />)}</div>}
          {res.orders.length > 0 && <div className="space-y-2"><h2 className="eyebrow">Your orders</h2>{res.orders.map((h) => <Row key={h.no} hit={h} kind="order" />)}</div>}
        </section>
      )}
    </div>
  );
}
