import { auditFieldLabel, auditValue, isHiddenField, isPayField } from "@/lib/auditSentence";

/* The deciding part of putting an edit back, with no database in it so it can be tested on its own. */

/** The records whose plain edits can be put back from the log, and the table each one lives in. */
export const REVERTIBLE: Record<string, { delegate: string; model: string }> = {
  EMPLOYEE: { delegate: "employee", model: "Employee" },
  SUPPLIER: { delegate: "supplier", model: "Supplier" },
  CLIENT: { delegate: "client", model: "Client" },
  PROJECT: { delegate: "project", model: "Project" },
  VEHICLE: { delegate: "vehicle", model: "Vehicle" },
  CAMP: { delegate: "camp", model: "Camp" },
  INVENTORY_ITEM: { delegate: "inventoryItem", model: "InventoryItem" },
};

/** Columns that must never be written back from a log entry. */
const NEVER = /^(id|createdAt|updatedAt|branchId|status|active|isActive|role|permissions|password\w*|sessionsValidAfter|approvalStatus|\w+ApprovalStatus|projectId|siteId|supplierId|sponsorSupplierId|parentId|campId|roomId|bedId|photoData|\w+Data)$/;

export type FieldInfo = { name: string; kind: string; type: string; isRequired?: boolean };

export type FieldPlan = {
  key: string;
  label: string;
  /** What it says now. */
  now: string;
  /** What it will go back to. */
  back: string;
  status: "ok" | "changed" | "skipped";
  /** Why it is not going back. */
  reason?: string;
  /** The raw value to write, for "ok" fields. */
  value?: unknown;
};

export type RevertPlan = { fields: FieldPlan[]; problem?: string };

const iso = (v: unknown): string | null => {
  if (v === null || v === undefined || v === "") return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? String(v) : d.toISOString();
};

/** One comparable form for what is stored and what the log says, whatever the column type. */
export function normalise(v: unknown, type: string): string | number | boolean | null {
  if (v === null || v === undefined) return null;
  if (type === "DateTime") return iso(v);
  if (type === "Decimal" || type === "Float" || type === "Int" || type === "BigInt") {
    if (v === "") return null;
    const n = Number(typeof v === "object" ? String(v) : v);
    return Number.isNaN(n) ? String(v) : n;
  }
  if (type === "Boolean") return Boolean(v);
  if (typeof v === "string") return v === "" ? null : v;
  return JSON.stringify(v);
}

function coerce(v: unknown, f: FieldInfo): unknown {
  if (v === null || v === undefined || v === "") return null;
  switch (f.type) {
    case "DateTime": return new Date(String(v));
    case "Int": return Math.trunc(Number(v));
    case "Float": return Number(v);
    case "Decimal": return String(v);
    case "BigInt": return BigInt(String(v));
    case "Boolean": return Boolean(v);
    default: return String(v);
  }
}

/**
 * Pure: decides, field by field, what can go back. A field goes back only when the record still holds the value the
 * edit wrote, so someone else's later change is never overwritten.
 */
export function planRevert(
  changes: Record<string, unknown> | null,
  current: Record<string, unknown>,
  fields: Record<string, FieldInfo>,
  opts: { canSeePay: boolean },
): RevertPlan {
  const out: FieldPlan[] = [];
  for (const [key, raw] of Object.entries(changes ?? {})) {
    if (isHiddenField(key)) continue;
    if (!raw || typeof raw !== "object" || !("from" in (raw as object))) continue;
    const d = raw as { from: unknown; to: unknown };
    const info = fields[key];
    const label = auditFieldLabel(key);
    const base = { key, label, now: auditValue(key, current[key]), back: auditValue(key, d.from) };
    if (!info || (info.kind !== "scalar" && info.kind !== "enum")) { out.push({ ...base, status: "skipped", reason: "It isn't a plain field on the record." }); continue; }
    if (info.type === "Bytes" || info.type === "Json") { out.push({ ...base, status: "skipped", reason: "Files and structured data can't be put back from the log." }); continue; }
    if (NEVER.test(key)) { out.push({ ...base, status: "skipped", reason: "It affects other records, so correct it from its own screen." }); continue; }
    if (!opts.canSeePay && isPayField(key)) { out.push({ ...base, status: "skipped", reason: "Pay figures need payroll access." }); continue; }
    if (d.from === null && info.isRequired) { out.push({ ...base, status: "skipped", reason: "It was filled in from the start, so there is nothing to put back." }); continue; }
    if (normalise(current[key], info.type) !== normalise(d.to, info.type)) { out.push({ ...base, status: "changed", reason: "It has been changed again since." }); continue; }
    out.push({ ...base, status: "ok", value: coerce(d.from, info) });
  }
  if (out.length === 0) return { fields: out, problem: "This entry has no field changes to put back." };
  if (!out.some((f) => f.status === "ok")) return { fields: out, problem: out.every((f) => f.status === "changed") ? "Everything in this change has been edited again since, so putting it back would overwrite newer work." : "None of the fields in this change can be put back automatically." };
  return { fields: out };
}

