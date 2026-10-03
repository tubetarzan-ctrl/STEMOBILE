"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, ScanLine, ShieldAlert, ShieldCheck, Smartphone, X } from "lucide-react";
import { HoloProofCard } from "@/components/home/HoloProofCard";
import { gradeLabel } from "@/lib/grades";
import { isValidImei } from "@/lib/imei/luhn";
import { formatDate } from "@/lib/time";
import { whatsappLink } from "@/lib/utils";

type Proof = { valid: boolean; code?: string; product?: string; grade?: string; status?: string; sold_at?: string | null; warranty_ends?: string | null; warranty_active?: boolean; error?: string };
type Imei = { imei: string; model?: string; brand?: string; blacklist?: string; simLock?: string; warranty?: string; error?: string };
type Popup = { kind: "proof"; data: Proof } | { kind: "imei"; data: Imei } | null;

/** Pulls the code out of a scanned QR: a /verify/CODE link or a bare code. */
function extractCode(text: string): string {
  const m = text.match(/\/verify\/([A-Za-z0-9]{6,14})/);
  return (m ? m[1] : text).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 14);
}

function Modal({ onClose, label, children }: { onClose: () => void; label: string; children: React.ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label={label} className="fixed inset-0 z-[60] grid place-items-end bg-black/70 p-3 backdrop-blur-sm sm:place-items-center" onClick={onClose}>
      <div className="st-chat-in relative max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-3xl border border-line bg-surface-1 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 grid size-9 place-items-center rounded-xl text-ink-2 hover:bg-surface-2"><X className="size-4" /></button>
        {children}
      </div>
    </div>
  );
}

function Scanner({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0, stopped = false;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (!video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        type BD = { detect: (s: CanvasImageSource) => Promise<{ rawValue: string }[]> };
        const W = window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => BD };
        const native = W.BarcodeDetector ? new W.BarcodeDetector({ formats: ["qr_code"] }) : null;
        const jsQR = native ? null : (await import("jsqr")).default;
        const tick = async () => {
          if (stopped || !video.current) return;
          const v = video.current;
          if (v.readyState >= 2) {
            let text: string | undefined;
            if (native) text = (await native.detect(v).catch(() => []))[0]?.rawValue;
            else if (jsQR) {
              canvas.width = v.videoWidth; canvas.height = v.videoHeight;
              ctx.drawImage(v, 0, 0);
              text = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height)?.data;
            }
            if (text && extractCode(text).length >= 6) { stopped = true; navigator.vibrate?.(60); onCode(extractCode(text)); return; }
          }
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch (e) {
        setError((e as Error).name === "NotAllowedError" ? "Camera permission was blocked. Allow camera access in your browser, or type the code instead." : "Couldn't open the camera on this device. Please type the code instead.");
      }
    })();
    return () => { stopped = true; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); };
  }, [onCode]);

  return (
    <Modal onClose={onClose} label="Scan Genuine Proof QR">
      <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold"><ScanLine className="size-5 text-accent" />Scan the part&apos;s QR</h2>
      {error ? <p className="rounded-xl bg-surface-2 p-4 text-sm text-ink-2">{error}</p> : (
        <div className="relative overflow-hidden rounded-2xl bg-black">
          <video ref={video} muted playsInline className="aspect-[3/4] w-full object-cover" />
          <div aria-hidden className="pointer-events-none absolute inset-[18%] rounded-2xl border-2 border-accent shadow-[0_0_0_9999px_rgba(0,0,0,.45)]" />
          <p className="absolute inset-x-0 bottom-3 text-center text-xs text-white/85">Point at the QR code on the label</p>
        </div>
      )}
    </Modal>
  );
}

export function VerifyTools({ whatsapp }: { whatsapp: string }) {
  const [code, setCode] = useState("");
  const [imei, setImei] = useState("");
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState<"proof" | "imei" | null>(null);
  const [popup, setPopup] = useState<Popup>(null);
  const [imeiErr, setImeiErr] = useState<string | null>(null);

  const verify = async (c: string) => {
    setScanning(false);
    setBusy("proof");
    try {
      const r = await fetch(`/api/verify?code=${encodeURIComponent(c)}`).then((x) => x.json());
      setPopup({ kind: "proof", data: { ...r, code: c } });
    } catch {
      setPopup({ kind: "proof", data: { valid: false, code: c, error: "network" } });
    } finally { setBusy(null); }
  };

  const checkImei = async () => {
    setImeiErr(null);
    if (!isValidImei(imei)) return setImeiErr("That doesn't look like a valid 15-digit IMEI. Dial *#06# to see it.");
    setBusy("imei");
    try {
      const res = await fetch("/api/imei", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imei }) });
      const r = await res.json();
      setPopup({ kind: "imei", data: { imei, ...r } });
    } catch {
      setPopup({ kind: "imei", data: { imei, error: "network" } });
    } finally { setBusy(null); }
  };

  return (
    <>
      {/* Genuine Proof */}
      <section className="card p-5 sm:p-6">
        <h2 className="flex items-center gap-2 font-display text-xl font-semibold"><ShieldCheck className="size-5 text-trust" />Check a StarTech part</h2>
        <p className="mt-1 text-sm text-ink-2">Scan the QR on the part&apos;s label, or type the code printed under it.</p>
        <button type="button" onClick={() => setScanning(true)} className="btn btn-primary mt-4 w-full"><Camera className="size-4" />Scan QR with camera</button>
        <form onSubmit={(e) => { e.preventDefault(); const c = extractCode(code); if (c.length >= 6) verify(c); }} className="mt-3 flex gap-2">
          <label className="sr-only" htmlFor="proof-code">Genuine Proof code</label>
          <input id="proof-code" value={code} onChange={(e) => setCode(e.target.value)} className="input min-w-0 font-mono uppercase tracking-widest" placeholder="K7QXM2PR9D" maxLength={40} autoComplete="off" />
          <button className="btn btn-ghost shrink-0" disabled={busy === "proof"}>{busy === "proof" ? <Loader2 className="size-4 animate-spin" /> : "Verify"}</button>
        </form>
      </section>

      {/* IMEI */}
      <section className="card p-5 sm:p-6">
        <h2 className="flex items-center gap-2 font-display text-xl font-semibold"><Smartphone className="size-5 text-accent" />Check your phone (IMEI)</h2>
        <p className="mt-1 text-sm text-ink-2">Confirms the phone&apos;s model and whether it&apos;s reported lost or stolen. Dial <strong className="font-mono">*#06#</strong> to see your IMEI.</p>
        <form onSubmit={(e) => { e.preventDefault(); checkImei(); }} className="mt-4 flex gap-2">
          <label className="sr-only" htmlFor="imei">IMEI number</label>
          <input id="imei" value={imei} onChange={(e) => setImei(e.target.value.replace(/\D/g, "").slice(0, 15))} inputMode="numeric" className="input min-w-0 font-mono tracking-wider" placeholder="15-digit IMEI" />
          <button className="btn btn-ghost shrink-0" disabled={busy === "imei" || imei.length !== 15}>{busy === "imei" ? <Loader2 className="size-4 animate-spin" /> : "Check"}</button>
        </form>
        {imeiErr && <p role="alert" className="mt-2 text-sm text-warn">{imeiErr}</p>}
      </section>

      {scanning && <Scanner onCode={verify} onClose={() => setScanning(false)} />}

      {popup?.kind === "proof" && (
        <Modal onClose={() => setPopup(null)} label="Verification result">
          {popup.data.valid ? (
            <div className="space-y-5 pt-4">
              <HoloProofCard data={{
                product: popup.data.product!, grade: gradeLabel(popup.data.grade), code: popup.data.code!, valid: true,
                sold: popup.data.sold_at ? `Sold ${formatDate(popup.data.sold_at)}` : "In stock at StarTech",
                warrantyEnds: popup.data.warranty_ends ? `${popup.data.warranty_active ? "Warranty to" : "Warranty ended"} ${formatDate(popup.data.warranty_ends)}` : "",
              }} />
              <div className="text-center">
                <p className="font-display text-2xl font-semibold text-trust">✓ Genuine StarTech part</p>
                <p className="mt-1 text-sm text-ink-2">{popup.data.product} · <strong>{gradeLabel(popup.data.grade)}</strong></p>
                <p className="text-sm text-ink-3">{popup.data.warranty_active ? "Warranty active" : popup.data.warranty_ends ? "Warranty has ended" : "Not sold yet"}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3 pt-4 text-center">
              <ShieldAlert className="mx-auto size-10 text-danger" />
              <p className="font-display text-xl font-semibold">{popup.data.error === "too_many" ? "Too many checks — wait a minute" : "We can't verify this code"}</p>
              <p className="text-sm text-ink-2">Code <span className="font-mono">{popup.data.code}</span> isn&apos;t in StarTech&apos;s records. Check for typos, or send us a photo of the label.</p>
              <a href={whatsappLink(whatsapp, `Hi StarTech, please check this part code: ${popup.data.code}`)} target="_blank" rel="noopener" className="btn btn-ghost">Ask on WhatsApp</a>
            </div>
          )}
        </Modal>
      )}

      {popup?.kind === "imei" && (
        <Modal onClose={() => setPopup(null)} label="IMEI result">
          <div className="space-y-3 pt-4">
            <h2 className="font-display text-xl font-semibold">IMEI <span className="font-mono text-base">{popup.data.imei}</span></h2>
            {popup.data.error === "not_configured" ? (
              <>
                <p className="text-sm text-ink-2">Online IMEI checking isn&apos;t switched on yet. Send us your IMEI on WhatsApp and our team will check it for you.</p>
                <a href={whatsappLink(whatsapp, `Hi StarTech, please check my phone's IMEI: ${popup.data.imei}`)} target="_blank" rel="noopener" className="btn btn-primary w-full">Send IMEI on WhatsApp</a>
              </>
            ) : popup.data.error ? (
              <p className="text-sm text-ink-2">{popup.data.error === "too_many" ? "Too many checks from this device — please try again in a few minutes." : "The IMEI service didn't respond. Please try again later."}</p>
            ) : (
              <dl className="divide-y divide-line rounded-2xl border border-line text-sm">
                {[["Model", popup.data.model], ["Brand", popup.data.brand], ["Lost / stolen", popup.data.blacklist === "clean" ? "✓ Clean" : popup.data.blacklist === "blacklisted" ? "⚠ Reported lost / stolen" : "Unknown"], ["SIM lock", popup.data.simLock], ["Warranty", popup.data.warranty]]
                  .filter(([, v]) => v).map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4 px-4 py-2.5"><dt className="text-ink-3">{k}</dt><dd className={k === "Lost / stolen" && popup.data.blacklist === "blacklisted" ? "font-semibold text-danger" : "font-medium"}>{v}</dd></div>
                  ))}
              </dl>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
