"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { logAudit } from "@/lib/audit";

export type DeleteEmployeesResult = {
  deleted: number;
  /** Employees that couldn't be removed, with the reason to show the user. */
  blocked: { id: string; name: string; employeeIdNo: string; reason: string }[];
  error?: string;
};

/**
 * Why an employee can't be deleted, or null when they can be.
 *
 * Timesheet rows and attendance are payroll history — deleting an employee out
 * from under them would silently change what was billed, so those block. The
 * NOC and demand-request links block too: both are database-enforced (no
 * cascade), so a delete would fail at the FK anyway, and a clear message beats
 * a constraint error.
 */
async function blockingReason(employee: {
  id: string;
  employeeIdNo: string;
}): Promise<string | null> {
  const [entries, attendance, nocs, allocations] = await Promise.all([
    prisma.timesheetEntry.count({ where: { employeeIdNo: employee.employeeIdNo } }),
    prisma.attendance.count({ where: { employeeId: employee.id } }),
    prisma.nocEmployee.count({ where: { employeeId: employee.id } }),
    prisma.demandRequestAllocation.count({ where: { employeeId: employee.id } }),
  ]);

  const parts: string[] = [];
  if (entries > 0) parts.push(`${entries} timesheet row${entries === 1 ? "" : "s"}`);
  if (attendance > 0)
    parts.push(`${attendance} attendance record${attendance === 1 ? "" : "s"}`);
  if (nocs > 0) parts.push(`${nocs} NOC${nocs === 1 ? "" : "s"}`);
  if (allocations > 0)
    parts.push(`${allocations} demand allocation${allocations === 1 ? "" : "s"}`);

  return parts.length > 0 ? `Still linked to ${parts.join(", ")}` : null;
}

/**
 * Deletes employees that carry no payroll history, and reports the rest back
 * rather than removing them — the caller offers to deactivate those instead.
 *
 * Takes a list so the roster's selection bar and a single row action share one
 * code path.
 */
export async function deleteEmployeesAction(
  employeeIds: string[]
): Promise<DeleteEmployeesResult> {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  if (employeeIds.length === 0) return { deleted: 0, blocked: [] };

  const employees = await prisma.employee.findMany({
    where: { id: { in: employeeIds } },
  });

  const blocked: DeleteEmployeesResult["blocked"] = [];
  let deleted = 0;

  for (const employee of employees) {
    if (isOutsideBranch(employee.branchId, branchId, isSuperAdmin)) continue;

    const reason = await blockingReason(employee);
    if (reason) {
      blocked.push({
        id: employee.id,
        name: employee.name,
        employeeIdNo: employee.employeeIdNo,
        reason,
      });
      continue;
    }

    // Freeing a bed is reversible, unlike the history checked above, so it's
    // safe to do automatically rather than making the user go and do it first.
    await prisma.bed.updateMany({
      where: { employeeId: employee.id },
      data: { employeeId: null },
    });

    // Documents, skills, visa/labour applications, vaccinations and the
    // assignment/accommodation history all cascade from the schema.
    await prisma.employee.delete({ where: { id: employee.id } });
    deleted += 1;

    await logAudit({
      entityType: "EMPLOYEE",
      entityId: employee.id,
      action: "DELETE",
      before: {
        ...(employee as unknown as Record<string, unknown>),
        photoData: undefined,
      },
      userId: user.id,
      userName: user.name,
      branchId,
    });
  }

  revalidatePath("/employees");
  revalidatePath("/documents");
  return { deleted, blocked };
}

/**
 * The offered alternative when a delete is blocked: keeps the record and its
 * history, drops them off the active roster.
 */
export async function deactivateEmployeesAction(
  employeeIds: string[],
  reason?: string
): Promise<{ deactivated: number }> {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  if (employeeIds.length === 0) return { deactivated: 0 };

  const employees = await prisma.employee.findMany({
    where: { id: { in: employeeIds } },
    select: { id: true, branchId: true, name: true, active: true },
  });

  let deactivated = 0;
  for (const employee of employees) {
    if (isOutsideBranch(employee.branchId, branchId, isSuperAdmin)) continue;

    await prisma.employee.update({
      where: { id: employee.id },
      // Mirrors what the edit form's Active toggle writes — `status` is left
      // alone there too, so deactivating here doesn't invent new semantics.
      data: {
        active: false,
        inactiveReason: reason?.trim() || "Deactivated from the roster",
        lastDemobilizedDate: new Date(),
      },
    });
    deactivated += 1;

    await logAudit({
      entityType: "EMPLOYEE",
      entityId: employee.id,
      action: "UPDATE",
      before: { active: employee.active },
      after: { active: false },
      userId: user.id,
      userName: user.name,
      branchId,
    });
  }

  revalidatePath("/employees");
  return { deactivated };
}
