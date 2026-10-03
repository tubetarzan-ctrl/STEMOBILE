"use client";
import { useState, useTransition } from "react";
import { saveFaqAction } from "../website/actions";

type Faq = { id?: string; q_en: string; q_ur?: string | null; a_en: string; a_ur?: string | null; sort?: number; visible?: boolean };

export function FaqEditor({ faqs }: { faqs: Faq[] }) {
  const [list, setList] = useState<Faq[]>(faqs);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const save = (f: Faq, i: number, del = false) => start(async () => {
    const r = await saveFaqAction({ ...f, q_ur: f.q_ur ?? undefined, a_ur: f.a_ur ?? undefined, sort: i + 1 }, del);
    setMsg(r.ok ? (del ? "Deleted" : "Saved") : r.error);
    if (r.ok && del) setList((l) => l.filter((_, j) => j !== i));
  });
  return (
    <div className="space-y-3">
      {list.map((f, i) => (
        <div key={f.id ?? `new-${i}`} className="card space-y-2 p-4">
          <div className="grid gap-2 md:grid-cols-2">
            <input className="input" value={f.q_en} placeholder="Question (English)" onChange={(e) => setList((l) => l.map((x, j) => (j === i ? { ...x, q_en: e.target.value } : x)))} />
            <input className="input urdu" dir="rtl" lang="ur" value={f.q_ur ?? ""} placeholder="سوال (اردو)" onChange={(e) => setList((l) => l.map((x, j) => (j === i ? { ...x, q_ur: e.target.value } : x)))} />
            <textarea className="input" rows={3} value={f.a_en} placeholder="Answer (English)" onChange={(e) => setList((l) => l.map((x, j) => (j === i ? { ...x, a_en: e.target.value } : x)))} />
            <textarea className="input urdu" dir="rtl" lang="ur" rows={3} value={f.a_ur ?? ""} placeholder="جواب (اردو)" onChange={(e) => setList((l) => l.map((x, j) => (j === i ? { ...x, a_ur: e.target.value } : x)))} />
          </div>
          <div className="flex gap-2">
            <button className="btn btn-primary btn-sm" disabled={pending || !f.q_en || !f.a_en} onClick={() => save(f, i)}>Save</button>
            {f.id && <button className="btn btn-ghost btn-sm" disabled={pending} onClick={() => confirm("Delete this FAQ?") && save(f, i, true)}>Delete</button>}
            {i > 0 && <button className="btn btn-ghost btn-sm" onClick={() => setList((l) => { const n = [...l]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n; })}>Move up</button>}
          </div>
        </div>
      ))}
      <button className="btn btn-ghost" onClick={() => setList((l) => [...l, { q_en: "", a_en: "", visible: true }])}>+ Add question</button>
      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
}
