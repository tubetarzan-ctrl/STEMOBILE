import { describe, expect, it } from "vitest";
import { normalizePhone, isValidPKMobile } from "@/lib/utils";
import { classifyEmail } from "@/lib/email/classify";
import { checkReviewText } from "@/lib/reviews/filter";
import { answerFromBank, needsLiveData } from "@/lib/ai/answer-bank";
import { businessDate, addDays } from "@/lib/time";
import { parseSimpleRemittanceCsv } from "@/lib/courier/parse";

describe("phones", () => {
  it("normalises Pakistani mobiles to +92", () => {
    expect(normalizePhone("0300-1234567")).toBe("+923001234567");
    expect(normalizePhone("923001234567")).toBe("+923001234567");
    expect(normalizePhone("3001234567")).toBe("+923001234567");
    expect(isValidPKMobile("0300 1234567")).toBe(true);
    expect(isValidPKMobile("021-1234567")).toBe(false);
  });
});

describe("business day (Asia/Karachi)", () => {
  it("rolls over at PKT midnight, not UTC", () => {
    expect(businessDate(new Date("2026-10-02T19:30:00Z"))).toBe("2026-10-03"); // 00:30 PKT
    expect(businessDate(new Date("2026-10-02T18:30:00Z"))).toBe("2026-10-02"); // 23:30 PKT
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("email safety gate", () => {
  it("never auto-replies to social / notification / complaints / refunds", () => {
    expect(classifyEmail("notification@facebookmail.com", "New login", "").autoReply).toBe(false);
    expect(classifyEmail("no-reply@bank.com", "Statement", "").autoReply).toBe(false);
    expect(classifyEmail("a@b.com", "Refund please", "I want my money back").kind).toBe("refund");
    expect(classifyEmail("a@b.com", "Worst service", "this is a scam").kind).toBe("complaint");
    expect(classifyEmail("a@b.com", "Question", "Do you have iPhone 13 battery?")).toMatchObject({ kind: "general", autoReply: true });
  });
});

describe("review filter", () => {
  it("flags links, profanity and repeated text", () => {
    expect(checkReviewText("great shop visit www.spam.com")).toBe("contains_link");
    expect(checkReviewText("aaaaaaaaaaaa")).toBe("repeated_text");
    expect(checkReviewText("Fixed my screen in 40 minutes, thanks!")).toBeNull();
  });
});

describe("answer bank", () => {
  const bank = [
    { q: "How long is the warranty?", a: "Up to 180 days by grade.", keywords: ["warranty"] },
    { q: "Do you offer cash on delivery?", a: "Yes, COD across Pakistan.", keywords: ["cod"] },
  ];
  it("answers FAQ-shaped questions without a model call", () => {
    expect(answerFromBank("warranty kitni hai?", bank)?.answer).toContain("180");
    expect(answerFromBank("tell me a joke", bank)).toBeNull();
  });
  it("routes price/stock questions to live data", () => {
    expect(needsLiveData("iPhone 12 ka original panel kitne ka hai?")).toBe(true);
    expect(needsLiveData("where is the shop")).toBe(false);
  });
});

describe("courier remittance CSV", () => {
  it("parses rupees to paisa and skips headers", () => {
    const rows = parseSimpleRemittanceCsv("tracking,cod,charge\nMOCK-1,1250.50,150\nMOCK-2,999,0");
    expect(rows).toEqual([{ trackingNo: "MOCK-1", codAmount: 125050, charge: 15000 }, { trackingNo: "MOCK-2", codAmount: 99900, charge: 0 }]);
  });
});
