import { prisma } from "@/lib/db";
import { complianceStatus, type ComplianceStatus } from "@/lib/compliance";

const STATUS_RANK = { expired: 0, expiring: 1, not_set: 2, valid: 3 } as const;

export type AssignedStaffRow = {
  id: string;
  name: string;
  projectName: string;
  status: ComplianceStatus;
};

/** Employees currently active on a project, most recently updated first. */
export async function getAssignedStaff(limit = 4): Promise<AssignedStaffRow[]> {
  const employees = await prisma.employee.findMany({
    where: { active: true, projectId: { not: null } },
    select: {
      id: true,
      name: true,
      project: { select: { name: true } },
      visaExpiry: true,
      laborCardExpiry: true,
      medicalExpiry: true,
      passportExpiry: true,
      emiratesIdExpiry: true,
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  return employees
    .filter((e) => e.project)
    .map((e) => {
      const statuses = [
        complianceStatus(e.visaExpiry),
        complianceStatus(e.laborCardExpiry),
        complianceStatus(e.medicalExpiry),
        complianceStatus(e.passportExpiry),
        complianceStatus(e.emiratesIdExpiry),
      ];
      const status = statuses.sort((a, b) => STATUS_RANK[a] - STATUS_RANK[b])[0];
      return { id: e.id, name: e.name, projectName: e.project!.name, status };
    });
}
