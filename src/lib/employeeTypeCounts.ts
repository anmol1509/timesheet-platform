import { prisma } from "@/lib/db";
import { branchWhere } from "@/lib/branch";

export type EmployeeTypeCounts = {
  siteStaff: number; // has a supplierId — supplier-sourced labour on a project
  officeStaff: number; // no supplierId, no projectId — own direct staff, on bench
  supplierLabour: number; // has a supplierId whose supplier is a third party (not isOwnCompany)
  // Has a supplierId whose supplier IS flagged isOwnCompany — one of our own
  // entities standing in for a supplier record, not a third-party
  // subcontractor. Mutually exclusive with supplierLabour (split on the same
  // isOwnCompany flag), so both belong in the same partition total.
  ourWorkers: number;
  idle: number; // status IDLE
  onVacation: number; // status ON_VACATION
  active: number; // status ACTIVE
};

// Mirrors the competitor dashboard's "Employee Count" breakdown
// (Site Staff / Staff / Supplier Labour / Idle / Vacation). Buckets are
// mutually exclusive: supplier-sourced labour splits into supplierLabour vs
// ourWorkers by the supplier's isOwnCompany flag; the remaining own-branch
// employees (no supplier at all) split by `category`.
export async function getEmployeeTypeCounts(
  branchId: string | null
): Promise<EmployeeTypeCounts> {
  const where = branchWhere(branchId);
  const [supplierLabour, ourWorkers, siteStaff, officeStaff, statusCounts] = await Promise.all([
    prisma.employee.count({ where: { ...where, supplierId: { not: null }, supplier: { isOwnCompany: false } } }),
    prisma.employee.count({ where: { ...where, supplierId: { not: null }, supplier: { isOwnCompany: true } } }),
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
