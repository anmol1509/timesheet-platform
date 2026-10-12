// Pure: the reasons offered when a worker leaves a camp, and the date rules around them.

export const CHECKOUT_REASONS = [
  "Resigned / left the company",
  "Terminated",
  "Visa cancelled / repatriated",
  "Absconded",
  "Transferred to another camp",
  "Moved to a supplier or client camp",
  "On leave / vacation",
  "Other",
] as const;
export type CheckoutReason = (typeof CHECKOUT_REASONS)[number];
export const isCheckoutReason = (v: string): v is CheckoutReason => (CHECKOUT_REASONS as readonly string[]).includes(v);

/** Today in the UAE as YYYY-MM-DD: "today" for a camp manager is the Gulf date, wherever the server runs. */
export function todayKey(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export const dayKey = (d: Date | string) => (typeof d === "string" ? d : d.toISOString()).slice(0, 10);

/** Whole days from a to b (YYYY-MM-DD each); positive when b is later. */
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86_400_000);

export type CheckoutKind = "now" | "past" | "future";
export function checkoutKind(date: string, today: string = todayKey()): CheckoutKind {
  return date === today ? "now" : date < today ? "past" : "future";
}

/** Why a checkout request can't be accepted, or null when it can. */
export function checkoutProblem(input: { date: string; reason: string; note: string; checkInDate: string }, today: string = todayKey()): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return "Choose the checkout date.";
  if (!isCheckoutReason(input.reason)) return "Choose a reason.";
  if (input.reason === "Other" && !input.note.trim()) return "Add a short note for \"Other\".";
  if (input.date < input.checkInDate) return "The checkout date can't be before the check-in date.";
  if (daysBetween(today, input.date) > 365) return "That date is more than a year away.";
  return null;
}
