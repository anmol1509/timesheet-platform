import { entityMeta } from "@/lib/auditPresentation";
import { auditFields, auditSentence } from "@/lib/auditSentence";

/**
 * The audit log laid out for a spreadsheet: one row per entry in plain words, and a second list with one row per
 * field that changed (old value, new value). No database in here, so it is tested on its own.
 */

export type ExportEntry = {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  changes: Record<string, unknown> | null;
  userName: string;
  createdAt: Date;
  source: string | null;
  batchLabel: string | null;
  revertOfId: string | null;
  revertedAt: Date | null;
  revertedByName: string | null;
};

export const ACTION_WORD: Record<string, string> = { CREATE: "Added", UPDATE: "Changed", DELETE: "Deleted", VIEW: "Opened" };
export const SOURCE_WORD: Record<string, string> = { SCREEN: "Screen", REVERT: "Put back", IMPORT: "Import", API: "API", SYSTEM: "System" };
/** The company works on UAE time, so that is the time the sheet shows. */
export const AUDIT_TIME_ZONE = "Asia/Dubai";

const timeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: AUDIT_TIME_ZONE, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
const ymdFmt = new Intl.DateTimeFormat("en-CA", { timeZone: AUDIT_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
const dateTimeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: AUDIT_TIME_ZONE, day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });

/** The UAE calendar day of a moment, as a date at midnight, so Excel shows and sorts it as a date. */
export function uaeDay(d: Date): Date {
  const [y, m, day] = ymdFmt.format(d).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}
export const uaeTime = (d: Date) => timeFmt.format(d);
export const uaeDateTime = (d: Date) => `${dateTimeFmt.format(d).replace(",", "")} (UAE time)`;

export const ACTIVITY_HEADERS = [
  "Date", "Time (UAE)", "Who", "What happened", "Action", "Area", "Record type", "Record", "Fields changed", "Source", "Bulk action", "Put back?", "Notes", "Entry reference",
];
export const FIELD_HEADERS = ["Date", "Time (UAE)", "Who", "Area", "Record type", "Record", "Action", "Field", "Old value", "New value", "Entry reference"];

export type ActivityRow = (string | number | Date | null)[];

export function buildAuditRows(entries: ExportEntry[], names: Record<string, string | undefined>, opts: { canSeePay: boolean }): { activity: ActivityRow[]; fields: ActivityRow[] } {
  const activity: ActivityRow[] = [];
  const fields: ActivityRow[] = [];
  for (const e of entries) {
    const meta = entityMeta(e.entityType);
    const name = names[e.id] ?? null;
    const like = { entityType: e.entityType, action: e.action, changes: e.changes };
    const { shown, hiddenPay } = auditFields(like, opts);
    const sentence = `${e.userName} ${auditSentence(like, name, opts)}`;
    const day = uaeDay(e.createdAt);
    const time = uaeTime(e.createdAt);
    const recordName = name ? name.replace(/^for /, "") : "";
    const notes: string[] = [];
    if (hiddenPay > 0) notes.push(`${hiddenPay} pay figure${hiddenPay === 1 ? "" : "s"} not shown (needs payroll access)`);
    if (e.revertOfId) notes.push("This change put an earlier one back");
    activity.push([
      day, time, e.userName, sentence, ACTION_WORD[e.action] ?? e.action, meta.module, meta.label, recordName,
      e.action === "UPDATE" || e.action === "CREATE" || e.action === "DELETE" ? shown.length : null,
      e.source ? (SOURCE_WORD[e.source] ?? e.source) : "Screen (older entry)",
      e.batchLabel ?? "",
      e.revertedAt ? `Yes, by ${e.revertedByName ?? "someone"} on ${uaeDateTime(e.revertedAt)}` : "",
      notes.join(". "), e.id,
    ]);
    for (const f of shown) {
      const label = f.label.charAt(0).toUpperCase() + f.label.slice(1);
      const old = e.action === "DELETE" ? f.to : f.from ?? "";
      const now = e.action === "DELETE" ? "" : f.to;
      fields.push([day, time, e.userName, meta.module, meta.label, recordName, ACTION_WORD[e.action] ?? e.action, label, old, now, e.id]);
    }
  }
  return { activity, fields };
}

/** "Anmol Srivastava 12 · Pooja 4": the people behind the most entries. */
export function countBy<T>(items: T[], key: (t: T) => string): [string, number][] {
  const m = new Map<string, number>();
  for (const i of items) m.set(key(i), (m.get(key(i)) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}
