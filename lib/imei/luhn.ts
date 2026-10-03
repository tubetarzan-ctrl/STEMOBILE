/** IMEI = 15 digits with a Luhn check digit (typos are caught before any paid lookup). */
export function isValidImei(raw: string): boolean {
  const d = raw.replace(/\D/g, "");
  if (!/^\d{15}$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let n = Number(d[14 - i]);
    if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
  }
  return sum % 10 === 0;
}
