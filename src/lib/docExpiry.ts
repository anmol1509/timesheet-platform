import { PARTY_ROLE_LABEL, resolveDocTypes, VEHICLE_EXPIRY_FIELD, type DocAppliesTo, type DocTypeDef, type DocTypeRow } from "@/lib/documentTypes";

/**
 * Expiring documents filed through the document type registry: a supplier company's, an owner's or sponsor's, and a
 * vehicle's. Pure, so the rules (which file stands for a type, what is left out) can be tested without a database.
 */
export type ExpiryFile = { id: string; entityType: DocAppliesTo; entityId: string; docType: string; filename: string; expiryDate: Date; branchId: string | null };
export type ExpirySupplier = { id: string; name: string; isOwnCompany: boolean; workers: number };
export type ExpiryParty = { id: string; role: string; name: string; supplierId: string; supplierName: string };
export type ExpiryVehicle = { id: string; plateNumber: string; label: string; status: string; registrationExpiry: Date | null; insuranceExpiry: Date | null };

export type RegistryExpiry = {
  kind: "supplier" | "party" | "vehicle";
  subjectId: string;
  subjectName: string;
  subjectRef: string;
  supplier: string | null;
  /** Where the record lives, so the board can link to it. */
  href: string;
  document: string;
  docType: string;
  expiry: Date;
  attachmentId: string | null;
  reminderDays: number[];
};

/** These two are already in the queue from the supplier's own columns and certificate list. */
const HANDLED_ELSEWHERE = new Set(["TRADE_LICENSE", "TRADE_LICENCE", "WORKMEN_COMPENSATION_INSURANCE", "WORKMEN_COMPENSATION"]);
/** Types where one supplier can hold several unrelated files, each with its own date. */
const NEVER_COLLAPSED = new Set(["OTHER", "CONTRACT"]);

export function registryExpiries(input: {
  files: ExpiryFile[];
  suppliers: ExpirySupplier[];
  parties: ExpiryParty[];
  vehicles: ExpiryVehicle[];
  typeRows: (DocTypeRow & { branchId: string })[];
}): RegistryExpiry[] {
  const supplierOf = new Map(input.suppliers.map((s) => [s.id, s]));
  const partyOf = new Map(input.parties.map((p) => [p.id, p]));
  const vehicleOf = new Map(input.vehicles.map((v) => [v.id, v]));

  const typesByBranch = new Map<string, DocTypeDef[]>();
  const typesFor = (branchId: string | null, appliesTo: DocAppliesTo) => {
    const k = `${branchId ?? ""}|${appliesTo}`;
    let list = typesByBranch.get(k);
    if (!list) {
      list = resolveDocTypes(input.typeRows.filter((r) => r.branchId === branchId), appliesTo);
      typesByBranch.set(k, list);
    }
    return list;
  };

  // The file that stands for a type is the one that runs longest: a renewal replaces the old one.
  const current = new Map<string, ExpiryFile>();
  const out: RegistryExpiry[] = [];
  const add = (f: ExpiryFile, type: DocTypeDef) => {
    const subject = describe(f);
    if (subject) out.push({ ...subject, document: type.label, docType: type.key, expiry: f.expiryDate, attachmentId: f.id, reminderDays: type.reminderDays });
  };
  const describe = (f: ExpiryFile): Omit<RegistryExpiry, "document" | "docType" | "expiry" | "attachmentId" | "reminderDays"> | null => {
    if (f.entityType === "SUPPLIER") {
      const s = supplierOf.get(f.entityId);
      return s ? { kind: "supplier", subjectId: s.id, subjectName: s.name, subjectRef: `${s.workers} worker${s.workers === 1 ? "" : "s"}`, supplier: s.name, href: `/suppliers/${s.id}` } : null;
    }
    if (f.entityType === "SUPPLIER_PARTY") {
      const p = partyOf.get(f.entityId);
      return p ? { kind: "party", subjectId: p.id, subjectName: p.name, subjectRef: `${PARTY_ROLE_LABEL[p.role] ?? p.role} · ${p.supplierName}`, supplier: p.supplierName, href: `/suppliers/${p.supplierId}` } : null;
    }
    const v = vehicleOf.get(f.entityId);
    return v ? { kind: "vehicle", subjectId: v.id, subjectName: v.plateNumber, subjectRef: v.label, supplier: null, href: `/transport/${v.id}` } : null;
  };

  for (const f of input.files) {
    if (f.entityType === "SUPPLIER" && HANDLED_ELSEWHERE.has(f.docType)) continue;
    // A vehicle that is off the road isn't renewed.
    if (f.entityType === "VEHICLE" && vehicleOf.get(f.entityId)?.status === "INACTIVE") continue;
    const type = typesFor(f.branchId, f.entityType).find((t) => t.key === f.docType);
    if (!type || !type.isActive || !type.hasExpiry) continue;
    if (NEVER_COLLAPSED.has(f.docType)) {
      add(f, { ...type, label: `${type.label} — ${f.filename}` });
      continue;
    }
    const k = `${f.entityType}|${f.entityId}|${f.docType}`;
    const cur = current.get(k);
    if (!cur || f.expiryDate > cur.expiryDate) current.set(k, f);
  }
  for (const f of current.values()) add(f, typesFor(f.branchId, f.entityType).find((t) => t.key === f.docType)!);

  // A vehicle whose Mulkiya or insurance has only ever been typed in (no file) still counts.
  const filed = new Set(out.filter((o) => o.kind === "vehicle").map((o) => `${o.subjectId}|${o.docType}`));
  for (const v of input.vehicles) {
    if (v.status === "INACTIVE") continue;
    for (const [docType, field] of Object.entries(VEHICLE_EXPIRY_FIELD)) {
      const date = v[field];
      if (!date || filed.has(`${v.id}|${docType}`)) continue;
      const base = resolveDocTypes([], "VEHICLE").find((t) => t.key === docType)!;
      out.push({ kind: "vehicle", subjectId: v.id, subjectName: v.plateNumber, subjectRef: v.label, supplier: null, href: `/transport/${v.id}`, document: base.label, docType, expiry: date, attachmentId: null, reminderDays: base.reminderDays });
    }
  }
  return out;
}

/**
 * The reminder a document is due, if any: the smallest of its reminder days that it is now inside, or 0 once expired.
 * Sending once per (document, expiry date, threshold) means a document gets one message as it crosses each step.
 */
export function dueReminder(days: number, reminderDays: number[]): number | null {
  if (reminderDays.length === 0) return null;
  if (days < 0) return 0;
  const inside = reminderDays.filter((d) => days <= d);
  return inside.length ? Math.min(...inside) : null;
}
