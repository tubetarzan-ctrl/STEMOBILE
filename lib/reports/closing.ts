import { formatPKR } from "@/lib/money";

export type DailySummary = {
  date: string; revenue: number; gross_profit: number; sales_count: number; expenses: number; repairs_delivered: number; repairs_received: number;
  sales_by_channel: Record<string, number>; payments_by_method: Record<string, number>; discounts_given: number; returns: number;
  drawers: { drawer: string; status: string; expected: number | null; counted: number | null; variance: number | null; not_counted: boolean }[];
  khata_movement: number; top_items: { name: string; qty: number; amount: number }[]; open_stock_alerts: number;
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const row = (k: string, v: string) => `<tr><td style="padding:6px 12px;color:#555">${esc(k)}</td><td style="padding:6px 12px;text-align:right;font-variant-numeric:tabular-nums">${esc(v)}</td></tr>`;

/** Email-safe HTML version of the Daily Closing Report (§5.13). */
export function closingReportHtml(s: DailySummary): string {
  const table = (title: string, rows: string) => `<h3 style="margin:24px 0 8px;font:600 15px system-ui">${esc(title)}</h3><table style="border-collapse:collapse;width:100%;font:14px system-ui">${rows}</table>`;
  return `<div style="max-width:640px;margin:auto;font:14px system-ui;color:#111">
  <h2 style="font:700 20px system-ui">StarTech — Daily Closing ${esc(s.date)}</h2>
  ${table("Summary", row("Revenue", formatPKR(s.revenue)) + row("Gross profit", formatPKR(s.gross_profit)) + row("Sales", String(s.sales_count)) + row("Discounts", formatPKR(s.discounts_given)) + row("Returns", formatPKR(s.returns)) + row("Expenses", formatPKR(s.expenses)) + row("Repairs received / delivered", `${s.repairs_received} / ${s.repairs_delivered}`) + row("Khata movement", formatPKR(s.khata_movement)) + row("Open stock alerts", String(s.open_stock_alerts)))}
  ${table("Sales by channel", Object.entries(s.sales_by_channel ?? {}).map(([k, v]) => row(k, formatPKR(v))).join(""))}
  ${table("Receipts by method", Object.entries(s.payments_by_method ?? {}).map(([k, v]) => row(k, formatPKR(v))).join(""))}
  ${table("Cash drawers", (s.drawers ?? []).map((d) => row(`${d.drawer}${d.not_counted ? " (NOT COUNTED)" : ""}`, `expected ${formatPKR(d.expected ?? 0)} · counted ${d.counted == null ? "—" : formatPKR(d.counted)} · variance ${formatPKR(d.variance ?? 0)}`)).join(""))}
  ${table("Top items", (s.top_items ?? []).map((t) => row(`${t.qty} × ${t.name}`, formatPKR(t.amount))).join(""))}
  </div>`;
}
