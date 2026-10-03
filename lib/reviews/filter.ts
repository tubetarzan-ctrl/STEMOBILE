// Rules-based review filter (no AI call) — mirrors public.submit_review so the
// form can warn before submitting. The database is the authority.
const PROFANITY = /\b(fuck|shit|bitch|harami|kutta|kanjar|bhenchod|madarchod)\b/i;

export function checkReviewText(text: string): null | "contains_link" | "profanity" | "repeated_text" {
  if (/(https?:\/\/|www\.|\.com\b)/i.test(text)) return "contains_link";
  if (PROFANITY.test(text)) return "profanity";
  if (/(.)\1{7,}/.test(text) || /\b(\w+)\b(\s+\1\b){4,}/i.test(text)) return "repeated_text";
  return null;
}
