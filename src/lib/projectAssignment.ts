import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { recordProjectChange } from "@/lib/employeeAssignment";

/**
 * Picking a project for a worker from their profile is not a mobilisation: nothing ties it to a demand, a quantity
 * someone agreed, or the letters that follow. So it is held as a request and only applied once someone with approval
 * rights agrees in the Approvals inbox.
 */
export async function requestProjectAssignment(opts: {
  employeeId: string;
  projectId: string;
  siteId: string | null;
  by: { id: string; name: string };
  branchId: string | null;
}): Promise<{ projectName: string }> {
  const [employee, project] = await Promise.all([
    prisma.employee.findUnique({ where: { id: opts.employeeId }, select: { name: true, employeeIdNo: true, branchId: true, project: { select: { name: true } } } }),
    prisma.project.findUnique({ where: { id: opts.projectId }, select: { name: true } }),
  ]);
  if (!employee || !project) throw new Error("Worker or project not found.");
  const open = await prisma.projectAssignmentRequest.findFirst({ where: { employeeId: opts.employeeId, projectId: opts.projectId, status: "PENDING" } });
  if (open) {
    await prisma.projectAssignmentRequest.update({ where: { id: open.id }, data: { siteId: opts.siteId, requestedById: opts.by.id, requestedByName: opts.by.name, requestedAt: new Date() } });
  } else {
    await prisma.projectAssignmentRequest.create({
      data: {
        employeeId: opts.employeeId, employeeName: employee.name, employeeIdNo: employee.employeeIdNo,
        projectId: opts.projectId, projectName: project.name, siteId: opts.siteId, fromProjectName: employee.project?.name ?? null,
        requestedById: opts.by.id, requestedByName: opts.by.name, branchId: employee.branchId ?? opts.branchId,
      },
    });
  }
  await logAudit({ entityType: "EMPLOYEE", entityId: opts.employeeId, action: "UPDATE", before: {}, after: { projectAssignmentRequested: project.name }, userId: opts.by.id, userName: opts.by.name, branchId: opts.branchId });
  return { projectName: project.name };
}

/** Applies an approved request: the worker takes the project and the placement history records it. */
export async function approveProjectAssignment(id: string, by: { id: string; name: string }): Promise<{ error?: string }> {
  const req = await prisma.projectAssignmentRequest.findUnique({ where: { id } });
  if (!req || req.status !== "PENDING") return { error: "That request has already been decided." };
  const [before, project] = await Promise.all([
    prisma.employee.findUnique({ where: { id: req.employeeId } }),
    prisma.project.findUnique({ where: { id: req.projectId }, select: { id: true } }),
  ]);
  if (!before || !project) return { error: "The worker or project no longer exists." };
  if (before.supplierId) {
    const supplier = await prisma.supplier.findUnique({ where: { id: before.supplierId }, select: { approvalStatus: true } });
    if (supplier && supplier.approvalStatus !== "Approved") return { error: "This worker's supplier isn't approved yet. Approve the supplier first." };
  }
  const site = req.siteId ? await prisma.site.findUnique({ where: { id: req.siteId }, select: { projectId: true } }) : null;
  await prisma.employee.update({ where: { id: before.id }, data: { projectId: req.projectId, siteId: site && site.projectId === req.projectId ? req.siteId : null } });
  await recordProjectChange(before, req.projectId);
  await prisma.projectAssignmentRequest.update({ where: { id }, data: { status: "APPROVED", decidedByName: by.name, decidedAt: new Date() } });
  await logAudit({ entityType: "EMPLOYEE", entityId: before.id, action: "UPDATE", before: { projectId: before.projectId }, after: { projectId: req.projectId, approvedFromRequest: id }, userId: by.id, userName: by.name, branchId: before.branchId });
  return {};
}

export async function rejectProjectAssignment(id: string, by: { name: string }, note: string): Promise<{ error?: string }> {
  const req = await prisma.projectAssignmentRequest.findUnique({ where: { id } });
  if (!req || req.status !== "PENDING") return { error: "That request has already been decided." };
  await prisma.projectAssignmentRequest.update({ where: { id }, data: { status: "REJECTED", decidedByName: by.name, decidedAt: new Date(), decisionNote: note || null } });
  return {};
}
