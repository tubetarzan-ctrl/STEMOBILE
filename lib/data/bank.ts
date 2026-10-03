import "server-only";

export type BankAccount = { bank: string; title: string; number: string; iban: string | null; branch: string | null };

/** Shop bank account for manual transfers (from .env.local / Vercel env). Null until filled in. */
export function getBankAccount(): BankAccount | null {
  const { BANK_NAME, BANK_ACCOUNT_TITLE, BANK_ACCOUNT_NUMBER, BANK_IBAN, BANK_BRANCH } = process.env;
  if (!BANK_NAME || !BANK_ACCOUNT_TITLE || !(BANK_ACCOUNT_NUMBER || BANK_IBAN)) return null;
  return {
    bank: BANK_NAME.trim(),
    title: BANK_ACCOUNT_TITLE.trim(),
    number: (BANK_ACCOUNT_NUMBER ?? "").trim(),
    iban: BANK_IBAN?.replace(/\s+/g, "").toUpperCase() || null,
    branch: BANK_BRANCH?.trim() || null,
  };
}
