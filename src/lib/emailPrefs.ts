/**
 * Which emails a person gets, and when. Pure (no database or clock of its own), so the rules the settings page promises and the
 * code that sends can be the same and can be tested. In-app notifications are never affected: these settings are about email only.
 *
 * Times are UAE time. Summaries go out once a day at 08:00 (the daily job), so "when" for an email is: right away, in that
 * morning summary, or not at all. Quiet hours and the weekend hold move a would-be instant email into the next summary.
 */

export type Delivery = "INSTANT" | "SUMMARY" | "OFF";
export type CategoryId = "approvals" | "decisions" | "reminders" | "overdue" | "replies" | "ai" | "security";

export type EmailCategory = { id: CategoryId; label: string; description: string; note?: string; icon: string; fallback: Delivery; kinds: string[]; locked?: boolean };

export const EMAIL_CATEGORIES: EmailCategory[] = [
  { id: "approvals", label: "Approvals waiting for me", description: "Payroll runs, advances, expenses, supplier invoices and workers, change and demand requests.", note: "Only sent to people who can approve these.", icon: "✅", fallback: "INSTANT", kinds: ["PAYROLL_SUBMITTED", "ADVANCE_REQUESTED", "EXPENSE_SUBMITTED", "SUPPLIER_INVOICE_SUBMITTED", "SUPPLIER_CHANGE_REQUEST", "SUPPLIER_WORKER_SUBMITTED", "DEMAND_REQUEST"] },
  { id: "decisions", label: "Decisions on things I sent", description: "Approved, declined or returned.", icon: "📬", fallback: "INSTANT", kinds: ["PAYROLL_RETURNED", "ADVANCE_DECIDED", "EXPENSE_DECIDED", "CHANGE_DECISION", "INVOICE_DECISION", "WORKER_DECISION"] },
  { id: "reminders", label: "Document and renewal reminders", description: "Visas, Emirates IDs, labour cards and licences that are expiring.", icon: "🗓", fallback: "SUMMARY", kinds: ["DOCUMENT_REMINDER", "EXPIRY_DIGEST"] },
  { id: "overdue", label: "Overdue and on hold", description: "Overdue onboarding, suppliers on hold, low balances and follow-ups.", icon: "⏰", fallback: "SUMMARY", kinds: ["ONBOARDING_OVERDUE", "SUPPLIER_HOLD", "LOW_BALANCE", "FOLLOWUP"] },
  { id: "replies", label: "Replies and support", description: "Supplier tickets, replies to your requests, and anything not listed here.", icon: "💬", fallback: "INSTANT", kinds: ["DEMAND_SUPPLIER_REPLY", "SUPPLIER_TICKET", "TICKET_REPLY"] },
  { id: "ai", label: "AI credits", description: "80% used, used up, and answers to top-up requests.", icon: "✦", fallback: "INSTANT", kinds: ["AI_CREDITS"] },
  { id: "security", label: "Security and system", description: "New sign-in on a new device, password changed, a broken integration.", note: "Always sent right away. Cannot be turned off.", icon: "🛡", fallback: "INSTANT", kinds: ["SECURITY_NEW_SIGNIN", "SECURITY_PASSWORD_CHANGED", "WEBHOOK_DISABLED"], locked: true },
];

const BY_KIND = new Map(EMAIL_CATEGORIES.flatMap((c) => c.kinds.map((k) => [k, c.id] as const)));
/** A kind this list doesn't know is treated as a reply, never silently dropped. */
export const categoryOf = (kind: string): CategoryId => BY_KIND.get(kind) ?? "replies";

export type EmailPrefs = {
  /** The master switch. Off stops every email except the security ones. */
  enabled: boolean;
  categories: Record<CategoryId, Delivery>;
  /** Hours (0 to 23, UAE time). The window may wrap past midnight. */
  quiet: { enabled: boolean; from: number; to: number };
  /** SEND: weekends are like any day. HOLD: nothing goes on Saturday or Sunday; it waits for Monday's summary. */
  weekends: "SEND" | "HOLD";
  /** ISO time until which emails are paused, or null. */
  pausedUntil: string | null;
};

export const SUMMARY_HOUR = 8;
export const PAUSE_CHOICES = [{ label: "Not paused", hours: 0 }, { label: "1 day", hours: 24 }, { label: "3 days", hours: 72 }, { label: "1 week", hours: 168 }, { label: "2 weeks", hours: 336 }];

export function defaultEmailPrefs(enabled = true): EmailPrefs {
  return {
    enabled,
    categories: Object.fromEntries(EMAIL_CATEGORIES.map((c) => [c.id, c.fallback])) as Record<CategoryId, Delivery>,
    quiet: { enabled: false, from: 20, to: 7 },
    weekends: "SEND",
    pausedUntil: null,
  };
}

const hour = (v: unknown, fallback: number) => (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 23 ? v : fallback);

/** What is stored, made safe: anything missing or wrong falls back to the default. `notifyEmail` is the old single switch, used until preferences are saved. */
export function parseEmailPrefs(raw: unknown, notifyEmail = true): EmailPrefs {
  const d = defaultEmailPrefs(notifyEmail);
  if (!raw || typeof raw !== "object") return d;
  const o = raw as Record<string, unknown>;
  const cats = (o.categories && typeof o.categories === "object" ? o.categories : {}) as Record<string, unknown>;
  const categories = { ...d.categories };
  for (const c of EMAIL_CATEGORIES) {
    const v = cats[c.id];
    if (!c.locked && (v === "INSTANT" || v === "SUMMARY" || v === "OFF")) categories[c.id] = v;
  }
  const q = (o.quiet && typeof o.quiet === "object" ? o.quiet : {}) as Record<string, unknown>;
  const until = typeof o.pausedUntil === "string" && !Number.isNaN(Date.parse(o.pausedUntil)) ? new Date(o.pausedUntil).toISOString() : null;
  return {
    enabled: typeof o.enabled === "boolean" ? o.enabled : d.enabled,
    categories,
    quiet: { enabled: q.enabled === true, from: hour(q.from, d.quiet.from), to: hour(q.to, d.quiet.to) },
    weekends: o.weekends === "HOLD" ? "HOLD" : "SEND",
    pausedUntil: until,
  };
}

/** The hour and weekday in the UAE: weekday is 0 for Sunday to 6 for Saturday. */
export function uaeTime(now: Date): { hour: number; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", hour: "numeric", hour12: false, weekday: "short" }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  return { hour: h, weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd) };
}

export const isWeekend = (weekday: number) => weekday === 0 || weekday === 6;

export function inQuietHours(q: EmailPrefs["quiet"], h: number): boolean {
  if (!q.enabled || q.from === q.to) return false;
  return q.from < q.to ? h >= q.from && h < q.to : h >= q.from || h < q.to;
}

export const isPaused = (p: EmailPrefs, now: Date) => !!p.pausedUntil && new Date(p.pausedUntil).getTime() > now.getTime();

/** What to do with one new notification: email it now, hold it for the next summary, or don't email it. */
export function planEmail(prefs: EmailPrefs, kind: string, now: Date): "SEND_NOW" | "QUEUE" | "SKIP" {
  const cat = categoryOf(kind);
  if (cat === "security") return "SEND_NOW";
  if (!prefs.enabled || isPaused(prefs, now)) return "SKIP";
  const mode = prefs.categories[cat];
  if (mode === "OFF") return "SKIP";
  if (mode === "SUMMARY") return "QUEUE";
  const t = uaeTime(now);
  if (prefs.weekends === "HOLD" && isWeekend(t.weekday)) return "QUEUE";
  if (inQuietHours(prefs.quiet, t.hour)) return "QUEUE";
  return "SEND_NOW";
}

/** At the morning run: send what is waiting, keep it for a later day, or drop it because emails are off or paused now. */
export function summaryAction(prefs: EmailPrefs, now: Date): "SEND" | "WAIT" | "DROP" {
  if (!prefs.enabled || isPaused(prefs, now)) return "DROP";
  if (prefs.weekends === "HOLD" && isWeekend(uaeTime(now).weekday)) return "WAIT";
  return "SEND";
}
