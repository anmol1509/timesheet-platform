import type { DocRow } from "./document-browser";

/** The documents every worker is expected to have, in the order the columns run. */
export const MATRIX_TYPES = ["PASSPORT", "EMIRATES_ID", "VISA", "LABOR_CARD", "MEDICAL"] as const;
export type MatrixType = (typeof MATRIX_TYPES)[number];
export const MATRIX_LABEL: Record<MatrixType | "WC", string> = { PASSPORT: "Passport", EMIRATES_ID: "Emirates ID", VISA: "Visa", LABOR_CARD: "Labour card", MEDICAL: "Medical", WC: "Workmen comp" };

export type CellState = "valid" | "expiring" | "expired" | "missing" | "notlisted";
export type Cell = { state: CellState; label: string; sub: string; docId?: string };

export type MatrixEmployee = {
  id: string;
  name: string;
  employeeIdNo: string;
  hasPhoto: boolean;
  supplierId: string | null;
  supplierName: string | null;
  projectId: string | null;
  /** Named on a workmen compensation certificate of their supplier. */
  wcCovered: boolean;
};
export type Policy = { supplierId: string; expiryDate: string | null; /** The certificate file itself, so it can be printed. */ attachmentId?: string };

const DAY = 86_400_000;

/** "14 mo", "25 d", "2 y": how far off, or how long ago, a date is. */
export function span(iso: string | null, now: number) {
  if (!iso) return "No expiry";
  const d = Math.abs(Math.round((new Date(iso).getTime() - now) / DAY));
  return d < 60 ? `${d} d` : d < 730 ? `${Math.round(d / 30)} mo` : `${Math.round(d / 365)} y`;
}

export function stateOf(iso: string | null, now: number): "valid" | "expiring" | "expired" {
  if (!iso) return "valid";
  const days = Math.round((new Date(iso).getTime() - now) / DAY);
  return days < 0 ? "expired" : days <= 30 ? "expiring" : "valid";
}

const LABEL: Record<CellState, string> = { valid: "Valid", expiring: "Expiring", expired: "Expired", missing: "Missing", notlisted: "Not listed" };

/** For each worker and document type, the document that counts: the one that runs longest, since a renewal replaces an old one. */
export function buildCells(employees: MatrixEmployee[], documents: DocRow[], policies: Policy[], now: number) {
  const best = new Map<string, DocRow>();
  for (const d of documents) {
    const key = `${d.employeeId}|${d.type}`;
    const cur = best.get(key);
    const rank = (x: DocRow) => (x.expiryDate ? new Date(x.expiryDate).getTime() : Number.POSITIVE_INFINITY);
    if (!cur || rank(d) > rank(cur)) best.set(key, d);
  }
  const policyBy = new Map(policies.map((p) => [p.supplierId, p]));
  // A supplier whose certificate has never been read has no worker marked covered: say nothing about who is covered.
  const coverageKnown = new Set(employees.filter((e) => e.wcCovered && e.supplierId).map((e) => e.supplierId!));

  const cells = new Map<string, Record<MatrixType | "WC", Cell>>();
  for (const e of employees) {
    const row = {} as Record<MatrixType | "WC", Cell>;
    for (const t of MATRIX_TYPES) {
      const d = best.get(`${e.id}|${t}`);
      row[t] = d ? { state: stateOf(d.expiryDate, now), label: "", sub: span(d.expiryDate, now), docId: d.id } : { state: "missing", label: "", sub: "—" };
    }
    const policy = e.supplierId ? policyBy.get(e.supplierId) : undefined;
    if (!e.supplierId) row.WC = { state: "missing", label: "", sub: "No supplier" };
    else if (!policy) row.WC = { state: "missing", label: "", sub: "No policy" };
    else if (e.supplierId && coverageKnown.has(e.supplierId) && !e.wcCovered) row.WC = { state: "notlisted", label: "", sub: "Not on policy" };
    else row.WC = { state: stateOf(policy.expiryDate, now), label: "", sub: span(policy.expiryDate, now) };
    for (const k of Object.keys(row) as (MatrixType | "WC")[]) row[k].label = LABEL[row[k].state];
    cells.set(e.id, row);
  }
  return { cells, coverageKnown };
}

/** How many of the five core documents a worker has that are not expired. */
export const completeCount = (row: Record<MatrixType | "WC", Cell>) => MATRIX_TYPES.filter((t) => row[t].state === "valid" || row[t].state === "expiring").length;
/** Worst first: expired counts most, then missing, then expiring. */
export const badness = (row: Record<MatrixType | "WC", Cell>) => MATRIX_TYPES.reduce((n, t) => n + (row[t].state === "expired" ? 3 : row[t].state === "missing" ? 2 : row[t].state === "expiring" ? 1 : 0), 0) + (row.WC.state === "expired" ? 3 : row.WC.state === "missing" || row.WC.state === "notlisted" ? 1 : 0);
export const hasState = (row: Record<MatrixType | "WC", Cell>, s: CellState) => (Object.keys(row) as (MatrixType | "WC")[]).some((k) => k !== "WC" ? row[k].state === s : false);

/** A supplier's own policy as a cell: valid, expiring or expired by its date, or missing when there is none. */
export function policyCell(policy: Policy | undefined, now: number): Cell {
  if (!policy) return { state: "missing", label: LABEL.missing, sub: "No policy" };
  const state = stateOf(policy.expiryDate, now);
  return { state, label: LABEL[state], sub: span(policy.expiryDate, now) };
}

/** Every document kind a worker's print can include: the five they hold, plus their supplier's workmen compensation certificate. */
export const PRINT_KINDS = [...MATRIX_TYPES, "WC"] as const;
export type PrintKind = (typeof PRINT_KINDS)[number];

/**
 * The document ids to print for chosen workers and kinds, worker by worker in the order given. A supplier's workmen
 * compensation certificate covers all its workers, so it prints once per supplier. `missing` counts what isn't on file.
 */
export function employeePrintIds(
  employeeIds: string[],
  kinds: PrintKind[],
  cells: Map<string, Record<MatrixType | "WC", Cell>>,
  employees: { id: string; supplierId: string | null }[],
  policies: Policy[],
) {
  const ids: string[] = [];
  let missing = 0;
  for (const id of employeeIds) {
    const row = cells.get(id);
    if (!row) continue;
    for (const t of MATRIX_TYPES) {
      if (!kinds.includes(t)) continue;
      if (row[t].docId) ids.push(row[t].docId as string);
      else missing++;
    }
  }
  if (kinds.includes("WC")) {
    const supplierOf = new Map(employees.map((e) => [e.id, e.supplierId]));
    const policyBy = new Map(policies.map((p) => [p.supplierId, p]));
    const seen = new Set<string>();
    for (const id of employeeIds) {
      const sid = supplierOf.get(id);
      const att = sid ? policyBy.get(sid)?.attachmentId : undefined;
      if (!att) { missing++; continue; }
      if (!seen.has(att)) { seen.add(att); ids.push(`att:${att}`); }
    }
  }
  return { ids, missing };
}
