import { prisma } from "@/lib/db";
import { branchWhere } from "@/lib/branch";

export type EmployeeTypeCounts = {
  siteStaff: number; // has a supplierId — supplier-sourced labour on a project
  officeStaff: number; // no supplierId, no projectId — own direct staff, on bench
  supplierLabour: number; // has a supplierId
  // Subset of supplierLabour whose supplier is flagged isOwnCompany — one of
  // our own entities rather than a third-party subcontractor. Not part of the
  // mutually-exclusive siteStaff/officeStaff/supplierLabour partition (it
  // overlaps with supplierLabour), shown as its own informational row.
  ourWorkers: number;
  idle: number; // status IDLE
  onVacation: number; // status ON_VACATION
  active: number; // status ACTIVE
};

// Mirrors the competitor dashboard's "Employee Count" breakdown
// (Site Staff / Staff / Supplier Labour / Idle / Vacation). Buckets are
// mutually exclusive: supplier-sourced labour is counted once regardless of
// its `category`; the remaining own-branch employees split by `category`.
export async function getEmployeeTypeCounts(
  branchId: string | null
): Promise<EmployeeTypeCounts> {
  const where = branchWhere(branchId);
  const [supplierLabour, ourWorkers, siteStaff, officeStaff, statusCounts] = await Promise.all([
    prisma.employee.count({ where: { ...where, supplierId: { not: null } } }),
    prisma.employee.count({ where: { ...where, supplier: { isOwnCompany: true } } }),
    prisma.employee.count({
      where: { ...where, supplierId: null, category: "SITE_STAFF" },
    }),
    prisma.employee.count({
      where: { ...where, supplierId: null, category: "STAFF" },
    }),
    prisma.employee.groupBy({
      by: ["status"],
      where,
      _count: { _all: true },
    }),
  ]);

  const byStatus = Object.fromEntries(statusCounts.map((s) => [s.status, s._count._all]));

  return {
    siteStaff,
    officeStaff,
    supplierLabour,
    ourWorkers,
    idle: byStatus.IDLE ?? 0,
    onVacation: byStatus.ON_VACATION ?? 0,
    active: byStatus.ACTIVE ?? 0,
  };
}
