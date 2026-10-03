// All business-day logic runs in Asia/Karachi (UTC+5, no DST).
export const TZ = "Asia/Karachi";

/** YYYY-MM-DD business date in PKT. */
export function businessDate(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export function formatDateTime(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-PK", {
    timeZone: TZ, day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
  }).format(new Date(d));
}

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-PK", { timeZone: TZ, day: "numeric", month: "short", year: "numeric" }).format(
    typeof d === "string" && d.length === 10 ? new Date(`${d}T00:00:00+05:00`) : new Date(d),
  );
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00+05:00`);
  d.setUTCDate(d.getUTCDate() + days);
  return businessDate(d);
}
