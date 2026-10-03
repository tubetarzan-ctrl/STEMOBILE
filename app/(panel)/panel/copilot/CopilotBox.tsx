"use client";
import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { askCopilotAction } from "@/app/actions/panel";

const EXAMPLES = ["Aaj ka profit?", "Which cashier gave the most discounts this week?", "Top 10 dead stock items", "Is hafte ka gross margin by channel?"];

export function CopilotBox() {
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ask = (question: string) => {
    setQ(question);
    start(async () => {
      const r = await askCopilotAction(question);
      setAnswer(r.ok ? r.data.answer : r.error);
    });
  };
  return (
    <section className="card p-5">
      <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold"><Sparkles className="size-4 text-accent" />Owner Copilot</h2>
      <form onSubmit={(e) => { e.preventDefault(); if (q.trim()) ask(q); }} className="flex gap-2">
        <label htmlFor="copilot-q" className="sr-only">Ask about the business</label>
        <input id="copilot-q" value={q} onChange={(e) => setQ(e.target.value)} className="input" placeholder="Ask about sales, margin, stock, khata…" />
        <button className="btn btn-primary" disabled={pending}>{pending ? "Thinking…" : "Ask"}</button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {EXAMPLES.map((e) => <button key={e} type="button" onClick={() => ask(e)} className="badge hover:border-accent">{e}</button>)}
      </div>
      {answer && <div className="mt-4 whitespace-pre-line rounded-xl bg-surface-2 p-4 text-sm leading-relaxed">{answer}</div>}
    </section>
  );
}
