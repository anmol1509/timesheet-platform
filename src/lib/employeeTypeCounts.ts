import { prisma } from "@/lib/db";
import { branchWhere } from "@/lib/branch";

export type EmployeeTypeCounts = {
  siteStaff: number; // has a supplierId — supplier-sourced labour on a project
  officeStaff: number; // no supplierId, no projectId — own direct staff, on bench
  supplierLabour: number; // has a supplierId
  idle: number; // status IDLE
  onVacation: number; // status ON_VACATION
  active: number; // status ACTIVE
};

// Mirrors the competitor dashboard's "Employee Count" breakdown
// (Site Staff / Staff / Supplier Labour / Idle / Vacation).
export async function getEmployeeTypeCounts(
  branchId: string | null
): Promise<EmployeeTypeCounts> {
  const where = branchWhere(branchId);
  const [supplierLabour, ownStaffOnProject, ownStaffOffProject, statusCounts] = await Promise.all([
    prisma.employee.count({ where: { ...where, supplierId: { not: null } } }),
    // Own (non-supplier) staff currently deployed to a project site.
    prisma.employee.count({
      where: { ...where, supplierId: null, projectId: { not: null } },
    }),
    // Own staff not on a project — office/bench staff.
    prisma.employee.count({
      where: { ...where, supplierId: null, projectId: null },
    }),
    prisma.employee.groupBy({
      by: ["status"],
      where,
      _count: { _all: true },
    }),
  ]);

  const byStatus = Object.fromEntries(statusCounts.map((s) => [s.status, s._count._all]));

  return {
    siteStaff: ownStaffOnProject,
    officeStaff: ownStaffOffProject,
    supplierLabour,
    idle: byStatus.IDLE ?? 0,
    onVacation: byStatus.ON_VACATION ?? 0,
    active: byStatus.ACTIVE ?? 0,
  };
}
