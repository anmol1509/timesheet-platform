import { prisma } from "@/lib/db";
import { branchWhere } from "@/lib/branch";
import { daysUntil, COMPLIANCE_FIELDS } from "@/lib/compliance";

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
  kind: "employee" | "supplier";
  /** Employee or supplier id, for linking through. */
  subjectId: string;
  subjectName: string;
  /** Employee ID number, or the count of workers a supplier certificate covers. */
  subjectRef: string;
  /** "Visa", "Passport", "Workmen's compensation", … */
  document: string;
  expiry: string;
  days: number;
  tier: RenewalTier;
  supplier: string | null;
  project: string | null;
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
      visaExpiry: true,
      laborCardExpiry: true,
      medicalExpiry: true,
      passportExpiry: true,
      emiratesIdExpiry: true,
      supplier: { select: { name: true } },
      project: { select: { code: true, name: true } },
    },
  });

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
        document: field.label,
        expiry: date.toISOString(),
        days,
        tier,
        supplier: e.supplier?.name ?? null,
        project: e.project ? `${e.project.code} — ${e.project.name}` : null,
      });
    }
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
        document: "Workmen's compensation",
        expiry: expiryDate.toISOString(),
        days,
        tier,
        supplier: supplier.name,
        project: null,
      });
    }
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
