"use client";
import { useState } from "react";
import { X } from "lucide-react";
import { AutoVideo } from "@/components/media/AutoVideo";

type Reel = { id: string; source: string; url: string; poster: string | null; external_id: string | null; captions: string | null };

/** "Watch the bench": swipeable 9:16 cards; in-view card plays muted; tap for full screen with sound. */
export function ReelStrip({ reels }: { reels: Reel[] }) {
  const [open, setOpen] = useState<Reel | null>(null);
  return (
    <>
      <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4" role="list" aria-label="Watch the bench">
        {reels.map((r) => (
          <div key={r.id} role="listitem" className="relative w-[220px] shrink-0 snap-start sm:w-[260px]">
            <AutoVideo src={{ source: r.source as "upload", url: r.url, poster: r.poster, external_id: r.external_id, captions: r.captions }} className="aspect-[9/16]" controls={false} />
            <button type="button" onClick={() => setOpen(r)} className="absolute inset-0" aria-label={`Open reel${r.captions ? `: ${r.captions}` : ""}`} />
          </div>
        ))}
      </div>
      {open && (
        <div role="dialog" aria-modal="true" aria-label="Reel" className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-4" onClick={() => setOpen(null)}>
          <div className="relative h-[85vh] aspect-[9/16]" onClick={(e) => e.stopPropagation()}>
            <AutoVideo src={{ source: open.source as "upload", url: open.url, poster: open.poster, external_id: open.external_id, captions: open.captions }} className="size-full" fit="contain" />
            <button type="button" onClick={() => setOpen(null)} className="absolute -top-12 right-0 grid size-10 place-items-center rounded-full bg-white/10 text-white" aria-label="Close"><X className="size-5" /></button>
          </div>
        </div>
      )}
    </>
  );
}
