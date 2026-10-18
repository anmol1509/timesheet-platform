/**
 * "Needs attention today": what the assistant shows before anyone has asked a thing.
 * `buildBrief` turns facts into cards and is pure; `loadBriefFacts` (in assistantBriefData.ts) gathers them,
 * each only for people who can see that part of the app.
 */

export type BriefTone = "stop" | "warn" | "info";
export type BriefItem = {
  id: string;
  tone: BriefTone;
  title: string;
  detail?: string;
  action: { label: string; href: string };
  /** A question that explains it, sent to the assistant when the person taps "Why?". */
  ask?: string;
};

export type BriefFacts = {
  renewals?: { expired: number; within7: number; within30: number };
  payrollRuns?: { id: string; name: string; blockers: string[] }[];
  overdue?: { count: number; total: number };
  notInvoiced?: { total: number; groups: number };
  absentToday?: number;
  /** Active workers with no profile photo. */
  noPhoto?: number;
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const aed = (n: number) => `AED ${Math.round(n).toLocaleString("en-US")}`;
const RANK: Record<BriefTone, number> = { stop: 0, warn: 1, info: 2 };

export function buildBrief(f: BriefFacts, max = 5): BriefItem[] {
  const out: BriefItem[] = [];
  const r = f.renewals;
  if (r && r.expired > 0) {
    out.push({
      id: "renewals-expired", tone: "stop", title: `${plural(r.expired, "document has", "documents have")} expired`,
      detail: r.within7 > 0 ? `${plural(r.within7, "more expires", "more expire")} within a week.` : undefined,
      action: { label: "Open renewals", href: "/employees/renewals" }, ask: "Which documents have expired and who owns them?",
    });
  } else if (r && r.within7 > 0) {
    out.push({
      id: "renewals-soon", tone: "warn", title: `${plural(r.within7, "document expires", "documents expire")} within a week`,
      detail: r.within30 > r.within7 ? `${r.within30} in the next 30 days.` : undefined,
      action: { label: "Open renewals", href: "/employees/renewals" }, ask: "Which documents expire in the next 7 days?",
    });
  }
  for (const run of f.payrollRuns ?? []) {
    if (run.blockers.length === 0) continue;
    out.push({
      id: `payroll-${run.id}`, tone: "warn", title: `${run.name} payroll can't be approved yet`,
      detail: run.blockers.length > 1 ? `${run.blockers.length} things in the way.` : run.blockers[0].split(/(?<=[.])\s/)[0].slice(0, 120),
      action: { label: "Open the run", href: `/payroll/${run.id}` }, ask: `Why can't the ${run.name} payroll be approved?`,
    });
  }
  const o = f.overdue;
  if (o && o.count > 0) {
    out.push({ id: "invoices-overdue", tone: "warn", title: `${plural(o.count, "invoice is", "invoices are")} overdue`, detail: `${aed(o.total)} waiting to be paid.`, action: { label: "Open invoices", href: "/invoices" }, ask: "Which invoices are overdue?" });
  }
  const n = f.notInvoiced;
  if (n && n.total > 0) {
    out.push({ id: "not-invoiced", tone: "info", title: `${aed(n.total)} approved but not invoiced`, detail: `${plural(n.groups, "client month")} ready to bill.`, action: { label: "Create the invoices", href: "/invoices" }, ask: "What work is approved but not yet invoiced?" });
  }
  if (f.absentToday && f.absentToday > 0) {
    out.push({ id: "absent", tone: "info", title: `${plural(f.absentToday, "worker is", "workers are")} absent today`, action: { label: "Open attendance", href: "/attendance" }, ask: "Who is absent today?" });
  }
  if (f.noPhoto && f.noPhoto > 0) {
    out.push({ id: "no-photo", tone: "info", title: `${plural(f.noPhoto, "worker has", "workers have")} no profile photo`, detail: "A photo is needed for ID cards and their record.", action: { label: "Open workers", href: "/employees" }, ask: "Which workers have no profile photo?" });
  }
  // Stable sort: most urgent first, otherwise in the order above.
  return out.map((x, i) => ({ x, i })).sort((a, b) => RANK[a.x.tone] - RANK[b.x.tone] || a.i - b.i).map(({ x }) => x).slice(0, max);
}
