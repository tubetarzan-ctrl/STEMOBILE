// Mobile layout check: opens each page in Chrome emulating a phone (390×844,
// touch, DPR 3), reports any element wider than the screen (horizontal
// overflow = "cut" edges) and saves full-page screenshots.
//   node scripts/mobile-check.mjs http://localhost:3000 [outDir] [width]
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:3000";
const OUT = process.argv[3] ?? "mobile-shots";
const WIDTH = Number(process.argv[4] ?? 390);
const PAGES = (process.env.PAGES ?? "/,/shop,/shop/iphone-13-display,/repair,/cart,/checkout,/verify,/track,/reviews/new,/trade/apply,/login,/p/privacy,/warranty").split(",");
const CHROME = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find(existsSync);
mkdirSync(OUT, { recursive: true });

const proc = spawn(CHROME, ["--headless=new", "--disable-gpu", "--remote-debugging-port=9333", "--no-first-run", "--user-data-dir=" + OUT + "/.profile", "about:blank"], { stdio: "ignore" });
let wsUrl;
for (let i = 0; i < 50 && !wsUrl; i++) {
  await new Promise((r) => setTimeout(r, 200));
  try { wsUrl = (await (await fetch("http://127.0.0.1:9333/json/list")).json()).find((t) => t.type === "page")?.webSocketDebuggerUrl; } catch { /* starting */ }
}
const ws = new WebSocket(wsUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let id = 0; const pending = new Map(); const events = [];
ws.addEventListener("message", (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } else events.push(d); });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", { width: WIDTH, height: 844, deviceScaleFactor: 2, mobile: true });
await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
await send("Emulation.setUserAgentOverride", { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" });

const PROBE = `(() => {
  const vw = document.documentElement.clientWidth, bad = [];
  const scroller = (el) => { for (let p = el.parentElement; p; p = p.parentElement) { const s = getComputedStyle(p); if (s.position === "fixed" || s.opacity === "0") return true; if (/(auto|scroll|hidden|clip)/.test(s.overflowX) && p !== document.body && p !== document.documentElement) return true; } return false; };
  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const st = getComputedStyle(el);
    if (st.visibility === "hidden" || st.display === "none" || st.position === "fixed") continue;
    if ((r.right > vw + 1 || r.left < -1) && !scroller(el)) bad.push((el.tagName + "." + (el.className?.baseVal ?? el.className ?? "")).slice(0, 90) + " [" + Math.round(r.left) + "→" + Math.round(r.right) + "]");
  }
  return JSON.stringify({ vw, docW: document.documentElement.scrollWidth, bad: bad.slice(0, 8), badCount: bad.length });
})()`;

const report = [];
for (const path of PAGES) {
  await send("Page.navigate", { url: BASE + path });
  await sleep(4500); // let fonts, images and the splash settle
  await send("Runtime.evaluate", { expression: "document.documentElement.classList.add('st-splash-off');document.documentElement.classList.remove('st-splash-on')" });
  const r = JSON.parse((await send("Runtime.evaluate", { expression: PROBE, returnByValue: true })).result.result.value);
  const full = process.env.FULL === "1";
  if (full) { // scroll through so lazy-loaded images actually load
    await send("Runtime.evaluate", { expression: "(async()=>{for(let y=0;y<document.body.scrollHeight;y+=600){scrollTo(0,y);await new Promise(r=>setTimeout(r,120));}scrollTo(0,0)})()", awaitPromise: true });
    await sleep(1500);
  }
  const h = full ? Math.min(Math.ceil((await send("Page.getLayoutMetrics")).result.cssContentSize.height), 9000) : 844;
  const shot = await send("Page.captureScreenshot", { format: "jpeg", quality: 55, captureBeyondViewport: full, clip: { x: 0, y: 0, width: WIDTH, height: h, scale: 1 } });
  const name = (path === "/" ? "home" : path.replace(/\W+/g, "_").replace(/^_/, "")) + ".jpg";
  writeFileSync(`${OUT}/${name}`, Buffer.from(shot.result.data, "base64"));
  const ok = r.docW <= r.vw && r.badCount === 0;
  report.push({ path, ok, ...r });
  console.log(`${ok ? "OK  " : "FAIL"} ${path}  (page ${r.docW}px / screen ${r.vw}px${r.badCount ? `, ${r.badCount} overflowing` : ""})`);
  for (const b of r.bad) console.log("       " + b);
}
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
ws.close(); proc.kill();
process.exit(report.every((r) => r.ok) ? 0 : 1);
