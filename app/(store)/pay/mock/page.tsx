import { redirect } from "next/navigation";
import { formatPKR } from "@/lib/money";
import { signMock } from "@/lib/payments";

export const metadata = { title: "Test payment", robots: { index: false } };

// Local-dev stand-in for the gateway's hosted page. Fires a signed webhook to
// our own endpoint exactly like PayFast/Safepay would. Disabled in production.
export default async function MockPayPage({ searchParams }: { searchParams: Promise<{ order?: string; amount?: string; return?: string }> }) {
  if (process.env.NODE_ENV === "production" && process.env.PAYMENT_GATEWAY !== "mock") redirect("/");
  const { order = "", amount = "0", return: ret = "/" } = await searchParams;

  async function pay(formData: FormData) {
    "use server";
    const status = String(formData.get("status"));
    const body = JSON.stringify({ event_id: `mock_${crypto.randomUUID()}`, status, order_no: order, amount: Number(amount), method: "raast", transaction_id: `RAAST-${Date.now()}` });
    await fetch(`${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/api/webhooks/payments/mock`, {
      method: "POST", headers: { "Content-Type": "application/json", "x-signature": signMock(body) }, body,
    });
    redirect(ret.startsWith("http") || ret.startsWith("/") ? ret : "/");
  }

  return (
    <div className="mx-auto max-w-md px-4 py-20">
      <div className="card space-y-5 p-8 text-center">
        <p className="eyebrow">Test gateway · Raast</p>
        <p className="font-display text-4xl font-bold money">{formatPKR(Number(amount))}</p>
        <p className="text-ink-2">Order {order}</p>
        <form action={pay} className="grid gap-2">
          <button name="status" value="paid" className="btn btn-primary">Pay now</button>
          <button name="status" value="failed" className="btn btn-ghost">Simulate failure</button>
        </form>
      </div>
    </div>
  );
}
