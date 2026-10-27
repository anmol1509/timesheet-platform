import { prisma } from "@/lib/db";
import { branchWhere } from "@/lib/branch";
import { daysUntil, COMPLIANCE_FIELDS } from "@/lib/compliance";
import { EXPIRY_FIELD } from "@/lib/importer/documentRead";
import { registryExpiries } from "@/lib/docExpiry";

/**
 * The renewal queue.
 *
 * The bell already lists anything inside 30 days, which is fine as a nudge but
 * not as a worklist: a visa needs starting months out, and "expired" and "due
 * in four weeks" are different jobs. This buckets the same underlying dates by
 * how much runway is left, so the work can be picked up in order.
 */
export const RENEWAL_TIERS = [
  { key: "expired", label: "Expired", max: -1 },
  { key: "urgent", label: "Within 7 days", max: 7 },
  { key: "soon", label: "Within 30 days", max: 30 },
  { key: "planned", label: "Within 60 days", max: 60 },
  { key: "horizon", label: "Within 90 days", max: 90 },
] as const;

export type RenewalTier = (typeof RENEWAL_TIERS)[number]["key"];

export type RenewalItem = {
  /**
   * What the expiry belongs to. A supplier's workmen's-compensation
   * certificate lapsing stops that supplier's whole workforce, so it belongs
   * in the same queue as a worker's own papers rather than in a separate one
   * nobody opens.
   */
  kind: "employee" | "supplier" | "party" | "vehicle";
  /** Employee or supplier id, for linking through. */
  subjectId: string;
  subjectName: string;
  /** Employee ID number, or the count of workers a supplier certificate covers. */
  subjectRef: string;
  /** Employee has an uploaded photo (always false for suppliers). */
  hasPhoto: boolean;
  /** "Visa", "Passport", "Workmen's compensation", … */
  document: string;
  expiry: string;
  days: number;
  tier: RenewalTier;
  supplier: string | null;
  project: string | null;
  /** The newest uploaded file of this kind for the worker, with the expiry carried on that file. Null for suppliers or when none is filed. */
  scan: { id: string; expiry: string | null; mime: string; filename: string } | null;
  /** The employee record column this date lives in, and the document type that renews it. Null for suppliers. */
  field: string | null;
  docType: string | null;
  /** Where to open the record. Set for owners/sponsors and vehicles, whose id alone doesn't say. */
  href?: string;
  /** The uploaded file behind a registry document, and the reminder steps its type sets. */
  attachmentId?: string | null;
  reminderDays?: number[];
};

export function tierFor(days: number): RenewalTier | null {
  for (const t of RENEWAL_TIERS) {
    if (days <= t.max) return t.key;
  }
  return null;
}

/** Everything due inside `horizonDays`, worst first. */
export async function getRenewals(
  branchId: string | null,
  horizonDays = 90
): Promise<RenewalItem[]> {
  const employees = await prisma.employee.findMany({
    // Deactivated workers aren't renewed — they've left the roster.
    where: { ...branchWhere(branchId), active: true },
    select: {
      id: true,
      name: true,
      employeeIdNo: true,
      photoMimeType: true,
      // Must cover every COMPLIANCE_FIELDS key — see the note in
      // dashboardAlerts.ts: an unselected column is skipped silently.
      visaExpiry: true,
      laborCardExpiry: true,
      medicalExpiry: true,
      passportExpiry: true,
      emiratesIdExpiry: true,
      cicpaExpiry: true,
      insuranceExpiry: true,
      drivingLicenceExpiry: true,
      supplier: { select: { name: true } },
      project: { select: { code: true, name: true } },
      // The files only, never their bytes: just enough to say whether a scan backs each date.
      documents: { select: { id: true, type: true, expiryDate: true, mimeType: true, filename: true }, orderBy: { uploadedAt: "desc" } },
    },
  });

  // Which stored file types carry each record date (a visa date can come from a visa or a residency issuance page).
  const typesFor = new Map<string, string[]>();
  for (const [type, field] of Object.entries(EXPIRY_FIELD.EMPLOYEE)) typesFor.set(field, [...(typesFor.get(field) ?? []), type]);

  const items: RenewalItem[] = [];
  for (const e of employees) {
    for (const field of COMPLIANCE_FIELDS) {
      const date = e[field.key as keyof typeof e] as Date | null;
      if (!date) continue;
      const days = daysUntil(date);
      if (days > horizonDays) continue;
      const tier = tierFor(days);
      if (!tier) continue;
      items.push({
        kind: "employee",
        subjectId: e.id,
        subjectName: e.name,
        subjectRef: e.employeeIdNo,
        hasPhoto: !!e.photoMimeType,
        document: field.label,
        expiry: date.toISOString(),
        days,
        tier,
        supplier: e.supplier?.name ?? null,
        project: e.project ? `${e.project.code}: ${e.project.name}` : null,
        scan: (() => {
          const kinds = typesFor.get(field.key) ?? [];
          const doc = e.documents.find((d) => kinds.includes(d.type));
          return doc ? { id: doc.id, expiry: doc.expiryDate ? doc.expiryDate.toISOString() : null, mime: doc.mimeType, filename: doc.filename } : null;
        })(),
        field: field.key,
        docType: (typesFor.get(field.key) ?? [])[0] ?? null,
      });
    }
  }

  // A supplier's trade licence lapsing stops them being used at all, so it
  // belongs beside their insurance rather than only colouring a row on the
  // supplier list.
  const licensed = await prisma.supplier.findMany({
    where: { ...branchWhere(branchId), tradeLicenseExpiry: { not: null } },
    select: {
      id: true,
      name: true,
      tradeLicenseExpiry: true,
      _count: { select: { employees: true } },
    },
  });

  for (const supplier of licensed) {
    const days = daysUntil(supplier.tradeLicenseExpiry!);
    if (days > horizonDays) continue;
    const tier = tierFor(days);
    if (!tier) continue;
    items.push({
      kind: "supplier",
      subjectId: supplier.id,
      subjectName: supplier.name,
      subjectRef: `${supplier._count.employees} worker${
        supplier._count.employees === 1 ? "" : "s"
      }`,
      hasPhoto: false,
      document: "Trade licence",
      expiry: supplier.tradeLicenseExpiry!.toISOString(),
      days,
      tier,
      supplier: supplier.name,
      project: null,
      scan: null,
      field: null,
      docType: null,
    });
  }

  // Supplier insurance sits in the same queue: the certificate covers people,
  // and once it lapses none of them can be sent to site.
  const certificates = await prisma.attachment.findMany({
    where: {
      entityType: "SUPPLIER",
      docType: { in: ["WORKMEN_COMPENSATION_INSURANCE", "WORKMEN_COMPENSATION"] },
      expiryDate: { not: null },
      ...(branchId ? { branchId } : {}),
    },
    select: { entityId: true, expiryDate: true },
    orderBy: { expiryDate: "desc" },
  });

  // Only the latest certificate per supplier matters — an older one having
  // expired is expected once it's been renewed.
  const latestBySupplier = new Map<string, Date>();
  for (const c of certificates) {
    if (!latestBySupplier.has(c.entityId)) latestBySupplier.set(c.entityId, c.expiryDate!);
  }

  if (latestBySupplier.size > 0) {
    const suppliers = await prisma.supplier.findMany({
      where: { id: { in: [...latestBySupplier.keys()] } },
      select: { id: true, name: true, _count: { select: { employees: true } } },
    });

    for (const supplier of suppliers) {
      const expiryDate = latestBySupplier.get(supplier.id)!;
      const days = daysUntil(expiryDate);
      if (days > horizonDays) continue;
      const tier = tierFor(days);
      if (!tier) continue;
      items.push({
        kind: "supplier",
        subjectId: supplier.id,
        subjectName: supplier.name,
        subjectRef: `${supplier._count.employees} worker${
          supplier._count.employees === 1 ? "" : "s"
        }`,
        hasPhoto: false,
        document: "Workmen's compensation",
        expiry: expiryDate.toISOString(),
        days,
        tier,
        supplier: supplier.name,
        project: null,
        scan: null,
        field: null,
        docType: null,
      });
    }
  }

  // Documents filed through the document type registry: supplier companies', owners' and sponsors', and vehicles'.
  const scope = branchId ? { branchId } : {};
  const [files, suppliers, parties, vehicles, typeRows] = await Promise.all([
    prisma.attachment.findMany({
      where: { entityType: { in: ["SUPPLIER", "SUPPLIER_PARTY", "VEHICLE"] }, expiryDate: { not: null }, ...scope },
      select: { id: true, entityType: true, entityId: true, docType: true, filename: true, expiryDate: true, branchId: true },
    }),
    prisma.supplier.findMany({ where: branchWhere(branchId), select: { id: true, name: true, isOwnCompany: true, _count: { select: { employees: true } } } }),
    prisma.supplierParty.findMany({ where: scope, select: { id: true, name: true, links: { select: { role: true, supplierId: true, supplier: { select: { name: true } } }, orderBy: { createdAt: "asc" } } } }),
    prisma.vehicle.findMany({ where: scope, select: { id: true, plateNumber: true, make: true, model: true, type: true, status: true, registrationExpiry: true, insuranceExpiry: true } }),
    prisma.documentType.findMany({ where: scope }),
  ]);
  const registry = registryExpiries({
    files: files.map((f) => ({ ...f, entityType: f.entityType as "SUPPLIER" | "SUPPLIER_PARTY" | "VEHICLE", expiryDate: f.expiryDate! })),
    suppliers: suppliers.map((s) => ({ id: s.id, name: s.name, isOwnCompany: s.isOwnCompany, workers: s._count.employees })),
    parties: parties.map((p) => ({ id: p.id, name: p.name, links: p.links.map((l) => ({ role: l.role, supplierId: l.supplierId, supplierName: l.supplier.name })) })),
    vehicles: vehicles.map((v) => ({ id: v.id, plateNumber: v.plateNumber, label: [v.make, v.model].filter(Boolean).join(" ") || v.type || "Vehicle", status: v.status, registrationExpiry: v.registrationExpiry, insuranceExpiry: v.insuranceExpiry })),
    typeRows,
  });
  for (const r of registry) {
    const days = daysUntil(r.expiry);
    if (days > horizonDays) continue;
    const tier = tierFor(days);
    if (!tier) continue;
    items.push({
      kind: r.kind,
      subjectId: r.subjectId,
      subjectName: r.subjectName,
      subjectRef: r.subjectRef,
      hasPhoto: false,
      document: r.document,
      expiry: r.expiry.toISOString(),
      days,
      tier,
      supplier: r.supplier,
      project: null,
      scan: null,
      field: null,
      docType: r.docType,
      href: r.href,
      attachmentId: r.attachmentId,
      reminderDays: r.reminderDays,
    });
  }

  items.sort((a, b) => a.days - b.days);
  return items;
}

/** Counts per tier, for the digest and the page's summary row. */
export function summarise(items: RenewalItem[]) {
  const counts = Object.fromEntries(RENEWAL_TIERS.map((t) => [t.key, 0])) as Record<
    RenewalTier,
    number
  >;
  for (const item of items) counts[item.tier] += 1;
  return counts;
}
