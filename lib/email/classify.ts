// Inbound email safety gate (§5.26). Rules first; never auto-reply to
// notification/social senders, spam, complaints or refund requests.
export type EmailClass = "notification" | "social" | "spam" | "complaint" | "refund" | "order" | "general";

const SOCIAL = /(facebookmail|instagram|linkedin|twitter|x\.com|tiktok|youtube|pinterest)\./i;
const NOTIFY = /(no-?reply|notifications?|mailer-daemon|postmaster|bounce|alerts?)@/i;
const SPAM = /(viagra|crypto giveaway|lottery|you have won|seo services|backlinks|loan offer)/i;
const COMPLAINT = /(complain|complaint|worst|fraud|scam|cheat|dhoka|bakwas|disappointed|consumer court)/i;
const REFUND = /(refund|money back|paise wapas|return my money|chargeback)/i;
const ORDER = /\b(ST-\d{4,}|RJ-\d{4,}|order|tracking)\b/i;

export function classifyEmail(from: string, subject: string, body: string): { kind: EmailClass; autoReply: boolean; priority: "high" | "normal" | "low" } {
  const text = `${subject}\n${body}`;
  if (SOCIAL.test(from)) return { kind: "social", autoReply: false, priority: "low" };
  if (NOTIFY.test(from)) return { kind: "notification", autoReply: false, priority: "low" };
  if (SPAM.test(text)) return { kind: "spam", autoReply: false, priority: "low" };
  if (REFUND.test(text)) return { kind: "refund", autoReply: false, priority: "high" };
  if (COMPLAINT.test(text)) return { kind: "complaint", autoReply: false, priority: "high" };
  if (ORDER.test(text)) return { kind: "order", autoReply: false, priority: "normal" };
  return { kind: "general", autoReply: true, priority: "normal" };
}
