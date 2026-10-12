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

// ---------------------------------------------------------------------------
// The same completeness view for every kind of record, so each module can be
// scored and charted the same way.
// ---------------------------------------------------------------------------

export type HealthModule = "workers" | "suppliers" | "clients";

export const HEALTH_MODULES: { key: HealthModule; label: string; noun: string; importHref: string }[] = [
  { key: "workers", label: "Workers", noun: "worker", importHref: "/import/new/workers" },
  { key: "suppliers", label: "Suppliers", noun: "supplier", importHref: "/import/new/suppliers" },
  { key: "clients", label: "Clients", noun: "client", importHref: "/import/new/clients" },
];

export type ModuleHealth = {
  module: HealthModule;
  total: number;
  overall: number;
  fields: { key: string; label: string; why: string; have: number; pct: number }[];
  buckets: { complete: number; good: number; partial: number; poor: number };
  /** Least complete first. */
  list: { id: string; name: string; sub: string | null; href: string; missing: string[]; score: number }[];
};

type FieldDef = { key: string; label: string; why: string };
type Item = { id: string; name: string; sub: string | null; href: string; values: Record<string, unknown> };

function summarize(module: HealthModule, items: Item[], fields: FieldDef[]): ModuleHealth {
  const have = new Map<string, number>(fields.map((f) => [f.key, 0]));
  const list = items.map((it) => {
    const missing: string[] = [];
    for (const f of fields) {
      if (filled(it.values[f.key])) have.set(f.key, (have.get(f.key) ?? 0) + 1);
      else missing.push(f.key);
    }
    return { id: it.id, name: it.name, sub: it.sub, href: it.href, missing, score: Math.round(((fields.length - missing.length) / fields.length) * 100) };
  });
  list.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name));
  const n = items.length;
  return {
    module,
    total: n,
    overall: n ? Math.round(list.reduce((s, w) => s + w.score, 0) / n) : 0,
    fields: fields.map((f) => ({ ...f, have: have.get(f.key) ?? 0, pct: n ? Math.round(((have.get(f.key) ?? 0) / n) * 100) : 0 })),
    buckets: {
      complete: list.filter((w) => w.score === 100).length,
      good: list.filter((w) => w.score >= 70 && w.score < 100).length,
      partial: list.filter((w) => w.score >= 40 && w.score < 70).length,
      poor: list.filter((w) => w.score < 40).length,
    },
    list,
  };
}

const SUPPLIER_FIELDS: FieldDef[] = [
  { key: "contactPerson", label: "Contact person", why: "Who to call about hours and payments" },
  { key: "contactPhone", label: "Contact phone", why: "Reaching the supplier" },
  { key: "contactEmail", label: "Contact email", why: "Sending timesheets and statements" },
  { key: "tradeLicenseNumber", label: "Trade licence number", why: "Compliance record" },
  { key: "tradeLicenseExpiry", label: "Trade licence expiry", why: "So renewals are flagged in time" },
  { key: "trn", label: "TRN", why: "Needed on VAT invoices" },
  { key: "category", label: "Category", why: "Grouping and filtering" },
  { key: "iban", label: "Bank IBAN", why: "Paying the supplier" },
];

const CLIENT_FIELDS: FieldDef[] = [
  { key: "contactPerson", label: "Contact person", why: "Who to call about timesheets and invoices" },
  { key: "contactEmail", label: "Contact email", why: "Sending invoices" },
  { key: "contactPhone", label: "Contact phone", why: "Reaching the client" },
  { key: "trn", label: "TRN", why: "Needed on VAT invoices" },
  { key: "tradeLicenseNumber", label: "Trade licence number", why: "Compliance record" },
  { key: "tradeLicenseExpiry", label: "Trade licence expiry", why: "So renewals are flagged in time" },
  { key: "billingAddress", label: "Billing address", why: "Printed on invoices" },
  { key: "paymentTerms", label: "Payment terms", why: "Due dates on invoices" },
  { key: "emirate", label: "Emirate", why: "Filtering and reports" },
];

/** Completeness of one module's records for a company. */
export async function getModuleHealth(module: HealthModule, branchId: string): Promise<ModuleHealth> {
  if (module === "workers") {
    const h = await getDataHealth(branchId);
    return {
      module: "workers",
      total: h.workers,
      overall: h.overall,
      fields: h.fields.map((f) => ({ key: f.key, label: f.label, why: f.why, have: f.have, pct: f.pct })),
      buckets: h.buckets,
      list: h.list.map((w) => ({ id: w.id, name: w.name, sub: `${w.employeeIdNo}${w.company ? ` · ${w.company}` : ""}`, href: `/employees/${w.id}`, missing: w.missing, score: w.score })),
    };
  }
  if (module === "suppliers") {
    const rows = await prisma.supplier.findMany({
      where: { branchId, status: "ACTIVE" },
      select: { id: true, name: true, code: true, parent: { select: { name: true } }, contactPerson: true, contactPhone: true, contactEmail: true, tradeLicenseNumber: true, tradeLicenseExpiry: true, trn: true, category: true, iban: true },
    });
    return summarize("suppliers", rows.map((r) => ({ id: r.id, name: r.name, sub: r.parent ? `Sub-supplier of ${r.parent.name}` : r.code, href: `/suppliers/${r.id}`, values: r })), SUPPLIER_FIELDS);
  }
  const rows = await prisma.client.findMany({
    where: { branchId, status: "ACTIVE" },
    select: { id: true, name: true, code: true, contactPerson: true, contactEmail: true, contactPhone: true, trn: true, tradeLicenseNumber: true, tradeLicenseExpiry: true, billingAddress: true, paymentTerms: true, emirate: true },
  });
  return summarize("clients", rows.map((r) => ({ id: r.id, name: r.name, sub: r.code, href: `/clients/${r.id}`, values: r })), CLIENT_FIELDS);
}
