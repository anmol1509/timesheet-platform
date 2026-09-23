"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, requirePermission } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { logAudit } from "@/lib/audit";
import { approverIds, notifyUsers } from "@/lib/notifications/notify";
import { UAE_DEFAULT_LEAVE_TYPES, daysInYear, inclusiveDays, parseDay } from "@/lib/leave";

type State = { error: string | null; ok?: boolean };
const NEED_BRANCH = "Pick a branch from the switcher first.";

export async function createLeaveRequestAction(_prev: State, formData: FormData): Promise<State> {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  if (!branchId) return { error: NEED_BRANCH };

  const employeeId = String(formData.get("employeeId") || "");
  const leaveTypeId = String(formData.get("leaveTypeId") || "");
  const start = parseDay(String(formData.get("startDate") || ""));
  const end = parseDay(String(formData.get("endDate") || ""));
  const reason = String(formData.get("reason") || "").trim() || null;
  if (!employeeId || !leaveTypeId) return { error: "Choose an employee and a leave type." };
  if (!start || !end) return { error: "Enter a start and end date." };
  if (end < start) return { error: "The end date is before the start date." };
  const days = inclusiveDays(start, end);
  if (days > 366) return { error: "That range is longer than a year." };

  const [employee, type] = await Promise.all([
    prisma.employee.findUnique({ where: { id: employeeId }, select: { branchId: true, name: true } }),
    prisma.leaveType.findUnique({ where: { id: leaveTypeId } }),
  ]);
  if (!employee || isOutsideBranch(employee.branchId, branchId, isSuperAdmin)) return { error: "Employee not found in this branch." };
  if (!type || type.branchId !== branchId || !type.isActive) return { error: "That leave type isn't available." };

  const clash = await prisma.leaveRequest.findFirst({
    where: { employeeId, status: { in: ["PENDING", "APPROVED"] }, startDate: { lte: end }, endDate: { gte: start } },
    select: { startDate: true, endDate: true },
  });
  if (clash) {
    return { error: `${employee.name} already has leave ${clash.startDate.toISOString().slice(0, 10)} → ${clash.endDate.toISOString().slice(0, 10)} overlapping these dates.` };
  }

  const created = await prisma.leaveRequest.create({
    data: { employeeId, leaveTypeId, startDate: start, endDate: end, days, reason, requestedById: user.id, branchId },
  });
  await logAudit({
    entityType: "LEAVE_REQUEST",
    entityId: created.id,
    action: "CREATE",
    after: { employee: employee.name, type: type.name, start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10), days },
    userId: user.id,
    userName: user.name,
    branchId,
  });
  await notifyUsers({
    userIds: (await approverIds("leave", branchId)).filter((id) => id !== user.id),
    kind: "LEAVE_REQUESTED",
    title: `Leave request: ${employee.name}`,
    body: `${type.name}, ${start.toISOString().slice(0, 10)} → ${end.toISOString().slice(0, 10)} (${days} day${days === 1 ? "" : "s"}). Waiting for approval.`,
    href: "/leave?status=PENDING",
  });
  revalidatePath("/leave");
  return { error: null, ok: true };
}

/** Approve or reject a pending request. Approval is refused if it would push the
 * employee past this year's entitlement for a capped leave type. */
export async function decideLeaveAction(formData: FormData): Promise<State> {
  const user = await requirePermission("leave", "approve");
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("id") || "");
  const decision = String(formData.get("decision") || "");
  const note = String(formData.get("note") || "").trim() || null;
  if (decision !== "APPROVED" && decision !== "REJECTED") return { error: "Invalid decision." };

  const req = await prisma.leaveRequest.findUnique({ where: { id }, include: { leaveType: true, employee: { select: { name: true } } } });
  if (!req || isOutsideBranch(req.branchId, branchId, isSuperAdmin)) return { error: "Request not found." };
  if (req.status !== "PENDING") return { error: `Already ${req.status.toLowerCase()}.` };

  if (decision === "APPROVED" && req.leaveType.daysPerYear > 0) {
    for (let year = req.startDate.getUTCFullYear(); year <= req.endDate.getUTCFullYear(); year++) {
      const approved = await prisma.leaveRequest.findMany({
        where: {
          employeeId: req.employeeId,
          leaveTypeId: req.leaveTypeId,
          status: "APPROVED",
          startDate: { lte: new Date(Date.UTC(year, 11, 31)) },
          endDate: { gte: new Date(Date.UTC(year, 0, 1)) },
        },
        select: { startDate: true, endDate: true },
      });
      const used = approved.reduce((n, r) => n + daysInYear(r.startDate, r.endDate, year), 0);
      const want = daysInYear(req.startDate, req.endDate, year);
      if (used + want > req.leaveType.daysPerYear) {
        return { error: `Would exceed ${req.leaveType.name} entitlement for ${year}: ${used} used + ${want} requested > ${req.leaveType.daysPerYear}.` };
      }
    }
  }

  await prisma.leaveRequest.update({ where: { id }, data: { status: decision, decisionNote: note, decidedById: user.id, decidedAt: new Date() } });
  await logAudit({
    entityType: "LEAVE_REQUEST",
    entityId: id,
    action: "UPDATE",
    before: { status: "PENDING" },
    after: { status: decision, note },
    userId: user.id,
    userName: user.name,
    branchId: req.branchId,
  });
  await notifyUsers({
    userIds: [req.requestedById].filter((id): id is string => !!id && id !== user.id),
    kind: "LEAVE_DECIDED",
    title: `Leave ${decision === "APPROVED" ? "approved" : "rejected"}: ${req.employee.name}`,
    body: `${req.leaveType.name}, ${req.startDate.toISOString().slice(0, 10)} → ${req.endDate.toISOString().slice(0, 10)}.${note ? ` Note: ${note}` : ""}`,
    href: "/leave",
  });
  revalidatePath("/leave");
  revalidatePath("/leave/balances");
  return { error: null, ok: true };
}

export async function cancelLeaveAction(formData: FormData): Promise<State> {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("id") || "");
  const req = await prisma.leaveRequest.findUnique({ where: { id } });
  if (!req || isOutsideBranch(req.branchId, branchId, isSuperAdmin)) return { error: "Request not found." };
  if (req.status !== "PENDING" && req.status !== "APPROVED") return { error: "Only pending or approved leave can be cancelled." };
  await prisma.leaveRequest.update({ where: { id }, data: { status: "CANCELLED", decidedById: user.id, decidedAt: new Date() } });
  await logAudit({
    entityType: "LEAVE_REQUEST",
    entityId: id,
    action: "UPDATE",
    before: { status: req.status },
    after: { status: "CANCELLED" },
    userId: user.id,
    userName: user.name,
    branchId: req.branchId,
  });
  revalidatePath("/leave");
  revalidatePath("/leave/balances");
  return { error: null, ok: true };
}

export async function seedLeaveTypesAction(): Promise<State> {
  const { user, branchId } = await requireUserWithBranch();
  if (!branchId) return { error: NEED_BRANCH };
  const created = await prisma.leaveType.createMany({
    data: UAE_DEFAULT_LEAVE_TYPES.map((t) => ({ ...t, branchId })),
    skipDuplicates: true,
  });
  await logAudit({
    entityType: "LEAVE_TYPE",
    entityId: branchId,
    action: "CREATE",
    after: { seeded: created.count },
    userId: user.id,
    userName: user.name,
    branchId,
  });
  revalidatePath("/leave/types");
  return { error: null, ok: true };
}

export async function saveLeaveTypeAction(_prev: State, formData: FormData): Promise<State> {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  if (!branchId) return { error: NEED_BRANCH };
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const code = String(formData.get("code") || "").trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_");
  const daysPerYear = Math.max(0, Math.floor(Number(formData.get("daysPerYear") || 0)));
  const paid = formData.get("paid") === "on";
  const isActive = id ? formData.get("isActive") === "on" : true;
  if (!name || !code) return { error: "Enter a name and a code." };
  if (!Number.isFinite(daysPerYear) || daysPerYear > 366) return { error: "Days per year must be 0–366." };

  try {
    if (id) {
      const existing = await prisma.leaveType.findUnique({ where: { id } });
      if (!existing || isOutsideBranch(existing.branchId, branchId, isSuperAdmin)) return { error: "Leave type not found." };
      await prisma.leaveType.update({ where: { id }, data: { name, daysPerYear, paid, isActive } });
      await logAudit({
        entityType: "LEAVE_TYPE",
        entityId: id,
        action: "UPDATE",
        before: { name: existing.name, daysPerYear: existing.daysPerYear, paid: existing.paid, isActive: existing.isActive },
        after: { name, daysPerYear, paid, isActive },
        userId: user.id,
        userName: user.name,
        branchId,
      });
    } else {
      const created = await prisma.leaveType.create({ data: { name, code, daysPerYear, paid, branchId } });
      await logAudit({ entityType: "LEAVE_TYPE", entityId: created.id, action: "CREATE", after: { name, code, daysPerYear, paid }, userId: user.id, userName: user.name, branchId });
    }
  } catch {
    return { error: "A leave type with that code already exists." };
  }
  revalidatePath("/leave/types");
  return { error: null, ok: true };
}
