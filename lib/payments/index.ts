import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// PaymentProvider (§5.9). Raast + cards via a licensed gateway (PayFast or
// Safepay — chosen at onboarding). Webhooks are verified by signature here,
// then handed to the idempotent public.handle_gateway_webhook RPC.

export type CheckoutRequest = { orderNo: string; amount: number /* paisa */; customerPhone: string; returnUrl: string };
export type CheckoutSession = { redirectUrl: string; providerRef?: string };
export type WebhookEvent = { eventId: string; status: "paid" | "failed" | "pending"; orderNo: string; amount: number; method: "raast" | "card"; transactionId?: string };

export interface PaymentProvider {
  name: string;
  createCheckout(req: CheckoutRequest): Promise<CheckoutSession>;
  /** Verify signature and normalise the payload. Returns null when the signature is invalid. */
  parseWebhook(rawBody: string, headers: Headers): Promise<WebhookEvent | null>;
}

function hmacOk(raw: string, sig: string | null, secret: string | undefined): boolean {
  if (!secret || !sig) return false;
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  const a = Buffer.from(sig.replace(/^sha256=/, "")), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Local dev: redirects to our own simulated pay page which fires a signed webhook. */
const mockProvider: PaymentProvider = {
  name: "mock",
  async createCheckout(req) {
    const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    return { redirectUrl: `${site}/pay/mock?order=${encodeURIComponent(req.orderNo)}&amount=${req.amount}&return=${encodeURIComponent(req.returnUrl)}` };
  },
  async parseWebhook(raw, headers) {
    if (!hmacOk(raw, headers.get("x-signature"), process.env.PAYMENT_GATEWAY_SECRET || "mock-secret")) return null;
    const j = JSON.parse(raw);
    return { eventId: j.event_id, status: j.status, orderNo: j.order_no, amount: Number(j.amount), method: j.method ?? "raast", transactionId: j.transaction_id };
  },
};

// DECISION: PayFast / Safepay request shapes are confirmed against each
// gateway's merchant docs at onboarding; these adapters implement the common
// hosted-checkout + HMAC-webhook pattern and are the only files to adjust.
const payfastProvider: PaymentProvider = {
  name: "payfast",
  async createCheckout(req) {
    const merchant = process.env.PAYMENT_GATEWAY_MERCHANT_ID!;
    const params = new URLSearchParams({
      MERCHANT_ID: merchant, BASKET_ID: req.orderNo, TXNAMT: (req.amount / 100).toFixed(2),
      CUSTOMER_MOBILE_NO: req.customerPhone, SUCCESS_URL: req.returnUrl, FAILURE_URL: req.returnUrl,
      CHECKOUT_URL: `${process.env.NEXT_PUBLIC_SITE_URL}/api/webhooks/payments/payfast`,
    });
    params.set("SIGNATURE", createHmac("sha256", process.env.PAYMENT_GATEWAY_SECRET!).update(params.toString()).digest("hex"));
    return { redirectUrl: `https://ipg1.apps.net.pk/Ecommerce/api/Transaction/PostTransaction?${params}` };
  },
  async parseWebhook(raw, headers) {
    if (!hmacOk(raw, headers.get("x-signature"), process.env.PAYMENT_GATEWAY_SECRET)) return null;
    const j = Object.fromEntries(new URLSearchParams(raw));
    return {
      eventId: j.transaction_id ?? j.basket_id, status: j.err_code === "000" ? "paid" : "failed", orderNo: j.basket_id,
      amount: Math.round(Number(j.transaction_amount) * 100), method: j.PaymentName?.toLowerCase().includes("raast") ? "raast" : "card", transactionId: j.transaction_id,
    };
  },
};

const safepayProvider: PaymentProvider = {
  name: "safepay",
  async createCheckout(req) {
    const res = await fetch("https://api.getsafepay.com/order/v1/init", {
      method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(10000),
      body: JSON.stringify({ client: process.env.PAYMENT_GATEWAY_MERCHANT_ID, amount: req.amount / 100, currency: "PKR", environment: "production" }),
    });
    if (!res.ok) throw new Error("safepay_init_failed");
    const { data } = await res.json();
    const q = new URLSearchParams({ env: "production", beacon: data.token, source: "custom", order_id: req.orderNo, redirect_url: req.returnUrl, cancel_url: req.returnUrl });
    return { redirectUrl: `https://www.getsafepay.com/components?${q}`, providerRef: data.token };
  },
  async parseWebhook(raw, headers) {
    if (!hmacOk(raw, headers.get("x-sfpy-signature"), process.env.PAYMENT_GATEWAY_SECRET)) return null;
    const j = JSON.parse(raw);
    const d = j.data ?? j;
    return { eventId: j.token ?? d.tracker, status: d.state === "PAID" || j.type === "payment:created" ? "paid" : "pending", orderNo: d.metadata?.order_id ?? d.order_id, amount: Math.round(Number(d.amount) * 100), method: "card", transactionId: d.tracker };
  },
};

export function getPaymentProvider(name = process.env.PAYMENT_GATEWAY ?? "mock"): PaymentProvider {
  if (name === "payfast" && process.env.PAYMENT_GATEWAY_SECRET) return payfastProvider;
  if (name === "safepay" && process.env.PAYMENT_GATEWAY_SECRET) return safepayProvider;
  return mockProvider;
}

/** Used by the mock pay page to sign its simulated webhook. */
export function signMock(raw: string): string {
  return createHmac("sha256", process.env.PAYMENT_GATEWAY_SECRET || "mock-secret").update(raw).digest("hex");
}
