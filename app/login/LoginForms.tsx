"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { normalizePhone } from "@/lib/utils";
import { linkCustomerAction } from "./actions";
import { cn } from "@/lib/utils";

export function LoginForms({ next, configured }: { next?: string; configured: boolean }) {
  const [tab, setTab] = useState<"customer" | "staff">(next?.startsWith("/panel") || next?.startsWith("/admin") ? "staff" : "customer");
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  if (!configured) return <p className="card p-5 text-center text-ink-2">Sign-in needs Supabase. Add your keys to <code className="font-mono">.env.local</code>.</p>;

  return (
    <div className="card space-y-5 p-6">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1 text-sm" role="tablist">
        {(["customer", "staff"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => { setTab(t); setError(null); }} className={cn("rounded-lg py-2 font-medium capitalize", tab === t && "bg-surface-1 text-accent")}>{t}</button>
        ))}
      </div>

      {tab === "customer" ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setError(null);
            start(async () => {
              const sb = supabaseBrowser();
              if (!sent) {
                const { error } = await sb.auth.signInWithOtp({ phone: normalizePhone(phone) });
                if (error) setError(error.message); else setSent(true);
              } else {
                const { error } = await sb.auth.verifyOtp({ phone: normalizePhone(phone), token: String(f.get("otp")), type: "sms" });
                if (error) return setError(error.message);
                await linkCustomerAction();
                router.push(next ?? "/warranty");
                router.refresh();
              }
            });
          }}
        >
          <label className="block space-y-1"><span className="label">Mobile number</span><input value={phone} onChange={(e) => setPhone(e.target.value)} required disabled={sent} className="input" inputMode="tel" placeholder="03xx xxxxxxx" autoComplete="tel" /></label>
          {sent && <label className="block space-y-1"><span className="label">6-digit code</span><input name="otp" required className="input font-mono tracking-[0.4em]" inputMode="numeric" maxLength={6} autoComplete="one-time-code" /></label>}
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <button className="btn btn-primary w-full" disabled={pending}>{sent ? "Verify" : "Send code"}</button>
        </form>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setError(null);
            start(async () => {
              const { error } = await supabaseBrowser().auth.signInWithPassword({ email: String(f.get("email")), password: String(f.get("password")) });
              if (error) return setError("Wrong email or password");
              router.push(next ?? "/panel");
              router.refresh();
            });
          }}
        >
          <label className="block space-y-1"><span className="label">Email</span><input name="email" type="email" required className="input" autoComplete="username" /></label>
          <label className="block space-y-1"><span className="label">Password</span><input name="password" type="password" required className="input" autoComplete="current-password" /></label>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <button className="btn btn-primary w-full" disabled={pending}>Sign in</button>
        </form>
      )}
    </div>
  );
}
