"use client";
import { useState } from "react";
import { Check, Copy, Landmark } from "lucide-react";
import type { BankAccount } from "@/lib/data/bank";
import { formatPKR } from "@/lib/money";

function CopyRow({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="text-xs text-ink-3">{label}</p>
        <p className={mono ? "break-all font-mono text-sm" : "text-sm font-medium"}>{value}</p>
      </div>
      <button
        type="button"
        onClick={async () => { try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ } }}
        className="grid size-8 shrink-0 place-items-center rounded-lg border border-line text-ink-2 hover:text-ink"
        aria-label={`Copy ${label}`}
      >
        {copied ? <Check className="size-3.5 text-trust" /> : <Copy className="size-3.5" />}
      </button>
    </div>
  );
}

/** Shop bank details with copy buttons, shown for manual bank transfers. */
export function BankDetails({ bank, amount, reference }: { bank: BankAccount | null; amount?: number; reference?: string }) {
  if (!bank) {
    return <p className="rounded-xl bg-surface-2 p-4 text-sm text-ink-2">We&apos;ll send our bank details on WhatsApp right after you place the order.</p>;
  }
  return (
    <div className="rounded-xl border border-line bg-surface-2 p-4">
      <p className="mb-1 flex items-center gap-2 text-sm font-medium"><Landmark className="size-4 text-accent" />Transfer to</p>
      <div className="divide-y divide-line">
        <CopyRow label="Bank" value={bank.bank + (bank.branch ? ` · ${bank.branch}` : "")} mono={false} />
        <CopyRow label="Account title" value={bank.title} mono={false} />
        {bank.number && <CopyRow label="Account number" value={bank.number} />}
        {bank.iban && <CopyRow label="IBAN" value={bank.iban} />}
        {amount !== undefined && <CopyRow label="Amount" value={formatPKR(amount)} mono={false} />}
        {reference && <CopyRow label="Write this in the transfer note" value={reference} />}
      </div>
    </div>
  );
}
