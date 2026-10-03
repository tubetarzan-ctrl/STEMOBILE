import "server-only";

// CourierProvider (§5.8). Start with one courier; add PostEx / Leopards / Trax /
// M&P / TCS behind the same interface. Tracking uses webhooks where available,
// otherwise the /api/cron/courier-poll job calls track().

export type BookingRequest = {
  orderNo: string; codAmount: number /* paisa */; consignee: { name: string; phone: string; address: string; city: string };
  pieces: number; weightKg: number; description: string;
};
export type Booking = { trackingNo: string; labelUrl?: string; charges?: number };
export type TrackingEvent = { status: "booked" | "picked" | "in_transit" | "out_for_delivery" | "delivered" | "returned" | "failed"; at: string; note?: string };
import { parseSimpleRemittanceCsv, type RemittanceLine } from "./parse";
export { parseSimpleRemittanceCsv, type RemittanceLine };

export interface CourierProvider {
  name: string;
  book(req: BookingRequest): Promise<Booking>;
  track(trackingNo: string): Promise<TrackingEvent[]>;
  /** Parse the courier's remittance report (CSV export) into lines. */
  parseRemittance(csv: string): RemittanceLine[];
}

async function withRetry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  let err: unknown;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) { err = e; await new Promise((r) => setTimeout(r, 500 * (i + 1))); }
  }
  throw err;
}

const mockCourier: CourierProvider = {
  name: "mock",
  async book(req) {
    return { trackingNo: `MOCK-${req.orderNo.replace(/\D/g, "")}${Math.floor(Math.random() * 90 + 10)}`, charges: 25000 };
  },
  async track() {
    return [{ status: "booked", at: new Date().toISOString() }];
  },
  parseRemittance: parseSimpleRemittanceCsv,
};

// DECISION: PostEx is the first real adapter target (COD-focused, Karachi based).
// Endpoint/fields to be confirmed with the merchant account at onboarding.
const postex: CourierProvider = {
  name: "postex",
  async book(req) {
    return withRetry(async () => {
      const res = await fetch("https://api.postex.pk/services/integration/api/order/v3/create-order", {
        method: "POST", signal: AbortSignal.timeout(10000),
        headers: { token: process.env.COURIER_API_KEY!, "Content-Type": "application/json" },
        body: JSON.stringify({
          orderRefNumber: req.orderNo, invoicePayment: req.codAmount / 100, customerName: req.consignee.name,
          customerPhone: req.consignee.phone, deliveryAddress: req.consignee.address, cityName: req.consignee.city,
          items: req.pieces, orderDetail: req.description, orderType: "Normal",
        }),
      });
      if (!res.ok) throw new Error(`postex_book_failed ${res.status}`);
      const j = await res.json();
      return { trackingNo: j.dist?.trackingNumber ?? j.trackingNumber };
    });
  },
  async track(trackingNo) {
    return withRetry(async () => {
      const res = await fetch(`https://api.postex.pk/services/integration/api/order/v1/track-order/${trackingNo}`, {
        headers: { token: process.env.COURIER_API_KEY! }, signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error("postex_track_failed");
      const j = await res.json();
      const hist: { transactionStatusMessage: string; updatedAt: string }[] = j.dist?.transactionStatusHistory ?? [];
      return hist.map((h) => ({ status: mapStatus(h.transactionStatusMessage), at: h.updatedAt, note: h.transactionStatusMessage }));
    });
  },
  parseRemittance: parseSimpleRemittanceCsv,
};

function mapStatus(s: string): TrackingEvent["status"] {
  const x = s.toLowerCase();
  if (x.includes("deliver") && !x.includes("un")) return "delivered";
  if (x.includes("return")) return "returned";
  if (x.includes("out for")) return "out_for_delivery";
  if (x.includes("pick")) return "picked";
  if (x.includes("transit") || x.includes("arriv")) return "in_transit";
  return "booked";
}

export function getCourier(name = process.env.COURIER_PROVIDER ?? "mock"): CourierProvider {
  if (name === "postex" && process.env.COURIER_API_KEY) return postex;
  return mockCourier;
}
