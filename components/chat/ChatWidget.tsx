"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MessageCircle, Phone, Send, X } from "lucide-react";
import { formatPKR } from "@/lib/money";
import { cn } from "@/lib/utils";
import { AssistantAvatar } from "./AssistantAvatar";

type Item = { title: string; sub?: string; price?: number; stock?: "in" | "low" | "out"; href?: string };
type Action = { label: string; href: string; kind?: "call" | "whatsapp" | "link" };
type Msg = { role: "bot" | "user"; text: string; items?: Item[]; actions?: Action[]; chips?: string[] };
type Ctx = Record<string, unknown>;

const KEY = "st_chat_v1";
const GREETING: Msg = {
  role: "bot",
  text: "Assalam-o-Alaikum! 👋 I'm **Zara**, StarTech's assistant.\nTell me how I can help you — I can check **live prices & stock**, give **repair quotes**, or share our timing and location.",
  chips: ["iPhone 13 screen price", "Galaxy A54 battery in stock?", "iPhone 14 screen repair", "Shop timing & location"],
};

/** Renders **bold** and line breaks safely (no HTML injection). */
function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, i) => (
        <span key={i} className="block">
          {line.split("**").map((part, j) => (j % 2 ? <strong key={j} className="font-semibold text-ink">{part}</strong> : <span key={j}>{part}</span>))}
        </span>
      ))}
    </>
  );
}

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [teaser, setTeaser] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([GREETING]);
  const [ctx, setCtx] = useState<Ctx>({});
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // restore the conversation for this browser session
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(KEY) ?? "null");
      if (saved?.msgs?.length) { setMsgs(saved.msgs); setCtx(saved.ctx ?? {}); }
      else if (!sessionStorage.getItem(`${KEY}_teased`)) {
        const t1 = setTimeout(() => setTeaser(true), 3500);
        const t2 = setTimeout(() => setTeaser(false), 12000);
        sessionStorage.setItem(`${KEY}_teased`, "1");
        return () => { clearTimeout(t1); clearTimeout(t2); };
      }
    } catch { /* storage blocked */ }
  }, []);
  useEffect(() => {
    try { sessionStorage.setItem(KEY, JSON.stringify({ msgs: msgs.slice(-40), ctx })); } catch { /* ignore */ }
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, ctx, busy]);
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [open]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    setInput("");
    setMsgs((m) => [...m, { role: "user", text: q }]);
    setBusy(true);
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: q, ctx }) });
      const r = await res.json();
      setMsgs((m) => [...m, { role: "bot", text: r.text, items: r.items, actions: r.actions, chips: r.chips }]);
      setCtx(r.ctx ?? {});
    } catch {
      setMsgs((m) => [...m, { role: "bot", text: "I couldn't connect just now. Please call or WhatsApp us on **+92 332 2142141**.", actions: [{ label: "Call +92 332 2142141", href: "tel:+923322142141", kind: "call" }] }]);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => { setMsgs([GREETING]); setCtx({}); };
  const last = msgs[msgs.length - 1];

  return (
    <>
      {/* Launcher: waving 3D-style avatar, left of the WhatsApp bubble */}
      <div className="fixed bottom-4 right-[84px] z-40 flex flex-col items-end">
        {teaser && !open && (
          <button type="button" onClick={() => { setOpen(true); setTeaser(false); }}
            className="st-teaser mb-2 mr-1 max-w-[220px] rounded-2xl rounded-br-sm border border-line bg-surface-1 px-3 py-2 text-left text-sm shadow-2xl">
            Hi! 👋 Ask me about <strong>prices, stock</strong> or a <strong>repair quote</strong>.
          </button>
        )}
        <button
          type="button"
          onClick={() => { setOpen((o) => !o); setTeaser(false); }}
          aria-label={open ? "Close chat" : "Chat with StarTech assistant"}
          aria-expanded={open}
          className="st-avatar-bob relative grid size-16 place-items-center rounded-full transition-transform hover:scale-105"
        >
          {open ? (
            <span className="grid size-14 place-items-center rounded-full bg-surface-2 text-ink shadow-2xl"><X className="size-6" /></span>
          ) : (
            <>
              <AssistantAvatar size={64} />
              <span className="absolute bottom-1 right-1 size-3.5 rounded-full border-2 border-bg bg-trust pulse-dot" aria-hidden />
            </>
          )}
        </button>
      </div>

      {open && (
        <section
          role="dialog"
          aria-label="StarTech chat assistant"
          className="st-chat-in fixed bottom-24 left-3 right-3 z-50 flex h-[min(620px,calc(100dvh-8rem))] flex-col overflow-hidden rounded-3xl border border-line bg-surface-1 shadow-2xl sm:left-auto sm:right-5 sm:w-[390px]"
        >
          <header className="flex items-center gap-3 border-b border-line bg-surface-2/60 px-4 py-3">
            <AssistantAvatar size={40} waving={false} />
            <div className="min-w-0 flex-1">
              <p className="font-display text-base font-semibold leading-tight">Zara · StarTech</p>
              <p className="flex items-center gap-1.5 text-xs text-ink-3"><span className="size-1.5 rounded-full bg-trust" />Live stock & prices</p>
            </div>
            <a href="tel:+923322142141" className="grid size-9 place-items-center rounded-xl text-ink-2 hover:bg-surface-2 hover:text-ink" aria-label="Call the shop"><Phone className="size-4" /></a>
            <button type="button" onClick={reset} className="rounded-lg px-2 py-1 text-xs text-ink-3 hover:bg-surface-2 hover:text-ink">New chat</button>
            <button type="button" onClick={() => setOpen(false)} className="grid size-9 place-items-center rounded-xl text-ink-2 hover:bg-surface-2" aria-label="Close chat"><X className="size-4" /></button>
          </header>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
            {msgs.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[88%] space-y-2 rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                  m.role === "user" ? "rounded-br-sm bg-accent text-accent-ink" : "rounded-bl-sm bg-surface-2 text-ink-2")}>
                  <RichText text={m.text} />
                  {m.items?.length ? (
                    <ul className="space-y-1.5 pt-1">
                      {m.items.map((it, k) => {
                        const body = (
                          <span className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface-1 px-3 py-2">
                            <span className="min-w-0">
                              <span className="block truncate font-medium text-ink">{it.title}</span>
                              {it.sub && <span className={cn("block text-xs", it.stock === "out" ? "text-danger" : it.stock === "low" ? "text-warn" : "text-trust")}>{it.sub}</span>}
                            </span>
                            {it.price !== undefined && <span className="money shrink-0 font-semibold text-ink">{formatPKR(it.price)}</span>}
                          </span>
                        );
                        return <li key={k}>{it.href ? <Link href={it.href} onClick={() => setOpen(false)}>{body}</Link> : body}</li>;
                      })}
                    </ul>
                  ) : null}
                  {m.actions?.length ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {m.actions.map((a, k) => (
                        <a key={k} href={a.href} target={a.kind === "whatsapp" || a.href.startsWith("http") ? "_blank" : undefined} rel="noopener"
                          className={cn("inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold",
                            a.kind === "whatsapp" ? "bg-[#25D366] text-[#062A14]" : a.kind === "call" ? "bg-accent text-accent-ink" : "border border-line text-ink hover:bg-surface-1")}>
                          {a.kind === "whatsapp" ? <MessageCircle className="size-3.5" /> : a.kind === "call" ? <Phone className="size-3.5" /> : null}
                          {a.label}
                        </a>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start" aria-label="Zara is typing">
                <span className="st-typing flex gap-1 rounded-2xl rounded-bl-sm bg-surface-2 px-4 py-3"><i /><i /><i /></span>
              </div>
            )}
            {!busy && last?.role === "bot" && last.chips?.length ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {last.chips.map((c) => (
                  <button key={c} type="button" onClick={() => send(c)} className="rounded-full border border-accent/40 px-3 py-1.5 text-xs text-accent hover:bg-accent/10">{c}</button>
                ))}
              </div>
            ) : null}
          </div>

          <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex items-center gap-2 border-t border-line p-3">
            <label htmlFor="st-chat-input" className="sr-only">Your message</label>
            <input
              id="st-chat-input" ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} maxLength={500} autoComplete="off"
              placeholder="e.g. iPhone 15 Pro Max original LCD price?" className="input h-11 flex-1 text-sm"
            />
            <button className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent text-accent-ink disabled:opacity-50" disabled={busy || !input.trim()} aria-label="Send">
              <Send className="size-4" />
            </button>
          </form>
        </section>
      )}
    </>
  );
}
