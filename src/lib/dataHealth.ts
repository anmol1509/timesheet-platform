import { prisma } from "@/lib/db";

// How complete the worker records are. Not a compliance verdict — a to-do list:
// which details are missing, for whom, so they can be filled in.

export const HEALTH_FIELDS = [
  { key: "mobileNumber", label: "Mobile number", why: "Needed to reach the worker and for the worker portal" },
  { key: "nationality", label: "Nationality", why: "Shown on letters, reports and filters" },
  { key: "dateOfBirth", label: "Date of birth", why: "Needed for visas and insurance" },
  { key: "trade", label: "Trade", why: "Needed to bill hours at the right rate" },
  { key: "passportNumber", label: "Passport number", why: "Identity record" },
  { key: "passportExpiry", label: "Passport expiry", why: "So renewals are flagged in time" },
  { key: "emiratesId", label: "Emirates ID", why: "Identity record" },
  { key: "emiratesIdExpiry", label: "Emirates ID expiry", why: "So renewals are flagged in time" },
  { key: "visaExpiry", label: "Visa expiry", why: "So renewals are flagged in time" },
  { key: "laborCardNumber", label: "Labour card number", why: "Identity and WPS record" },
  { key: "laborCardExpiry", label: "Labour card expiry", why: "So renewals are flagged in time" },
] as const;

export type HealthKey = (typeof HEALTH_FIELDS)[number]["key"];
export const HEALTH_KEYS = HEALTH_FIELDS.map((f) => f.key) as HealthKey[];

export type HealthWorker = {
  id: string;
  employeeIdNo: string;
  name: string;
  company: string | null;
  mobileNumber: string | null;
  missing: HealthKey[];
  /** 0..100 */
  score: number;
};

export type DataHealth = {
  workers: number;
  /** Average completeness, 0..100 */
  overall: number;
  fields: { key: HealthKey; label: string; why: string; have: number; pct: number }[];
  buckets: { complete: number; good: number; partial: number; poor: number };
  /** Least complete first. */
  list: HealthWorker[];
  withoutMobile: number;
};

const filled = (v: unknown) => v !== null && v !== undefined && String(v).trim() !== "";

/** Completeness of the company's current workers. Sample workers are left out when `realOnly`. */
export async function getDataHealth(branchId: string, opts: { realOnly?: boolean } = {}): Promise<DataHealth> {
  const rows = await prisma.employee.findMany({
    where: {
      branchId,
      active: true,
      status: { not: "TERMINATED" },
      ...(opts.realOnly ? { NOT: { employeeIdNo: { startsWith: "SMP-" } } } : {}),
    },
    select: {
      id: true, employeeIdNo: true, name: true, supplier: { select: { name: true } },
      mobileNumber: true, nationality: true, dateOfBirth: true, trade: true, passportNumber: true, passportExpiry: true,
      emiratesId: true, emiratesIdExpiry: true, visaExpiry: true, laborCardNumber: true, laborCardExpiry: true,
    },
  });

  const have = new Map<HealthKey, number>(HEALTH_KEYS.map((k) => [k, 0]));
  const list: HealthWorker[] = rows.map((r) => {
    const missing: HealthKey[] = [];
    for (const k of HEALTH_KEYS) {
      if (filled(r[k])) have.set(k, (have.get(k) ?? 0) + 1);
      else missing.push(k);
    }
    return {
      id: r.id, employeeIdNo: r.employeeIdNo, name: r.name, company: r.supplier?.name ?? null, mobileNumber: r.mobileNumber,
      missing, score: Math.round(((HEALTH_KEYS.length - missing.length) / HEALTH_KEYS.length) * 100),
    };
  });
  list.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name));

  const n = rows.length;
  return {
    workers: n,
    overall: n ? Math.round(list.reduce((s, w) => s + w.score, 0) / n) : 0,
    fields: HEALTH_FIELDS.map((f) => ({ key: f.key, label: f.label, why: f.why, have: have.get(f.key) ?? 0, pct: n ? Math.round(((have.get(f.key) ?? 0) / n) * 100) : 0 })),
    buckets: {
      complete: list.filter((w) => w.score === 100).length,
      good: list.filter((w) => w.score >= 70 && w.score < 100).length,
      partial: list.filter((w) => w.score >= 40 && w.score < 70).length,
      poor: list.filter((w) => w.score < 40).length,
    },
    list,
    withoutMobile: list.filter((w) => !filled(w.mobileNumber)).length,
  };
}
