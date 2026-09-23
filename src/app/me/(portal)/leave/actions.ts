"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getEssEmployee } from "@/lib/ess/session";
import { logAudit } from "@/lib/audit";
import { approverIds, notifyUsers } from "@/lib/notifications/notify";
import { inclusiveDays, parseDay } from "@/lib/leave";

type State = { error: string | null; ok?: boolean };

/** Employee-raised leave request. Always PENDING; the office decides. */
export async function requestLeaveAction(_prev: State, formData: FormData): Promise<State> {
  const employee = await getEssEmployee();
  if (!employee) return { error: "Please sign in again." };

  const leaveTypeId = String(formData.get("leaveTypeId") || "");
  const start = parseDay(String(formData.get("startDate") || ""));
  const end = parseDay(String(formData.get("endDate") || ""));
  const reason = String(formData.get("reason") || "").trim().slice(0, 300) || null;
  if (!leaveTypeId) return { error: "Choose a leave type." };
  if (!start || !end) return { error: "Enter your start and end dates." };
  if (end < start) return { error: "The end date is before the start date." };
  const days = inclusiveDays(start, end);
  if (days > 120) return { error: "That's too long for one request. Please split it or speak to your office." };

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  if (start.getTime() < today.getTime() - 7 * 86_400_000) return { error: "Leave can't start more than a week in the past. Speak to your office." };

  const type = await prisma.leaveType.findUnique({ where: { id: leaveTypeId } });
  if (!type || type.branchId !== employee.branchId || !type.isActive) return { error: "That leave type isn't available." };

  const clash = await prisma.leaveRequest.findFirst({
    where: { employeeId: employee.id, status: { in: ["PENDING", "APPROVED"] }, startDate: { lte: end }, endDate: { gte: start } },
    select: { startDate: true, endDate: true },
  });
  if (clash) return { error: `You already have leave ${clash.startDate.toISOString().slice(0, 10)} → ${clash.endDate.toISOString().slice(0, 10)} that overlaps these dates.` };

  const created = await prisma.leaveRequest.create({
    data: { employeeId: employee.id, leaveTypeId, startDate: start, endDate: end, days, reason, requestedViaPortal: true, branchId: employee.branchId },
  });
  await logAudit({
    entityType: "LEAVE_REQUEST",
    entityId: created.id,
    action: "CREATE",
    after: { via: "employee portal", employee: employee.name, type: type.name, start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10), days },
    userId: `employee:${employee.id}`,
    userName: employee.name,
    branchId: employee.branchId,
  });
  await notifyUsers({
    userIds: await approverIds("leave", employee.branchId),
    kind: "LEAVE_REQUESTED",
    title: `Leave request: ${employee.name}`,
    body: `${type.name}, ${start.toISOString().slice(0, 10)} → ${end.toISOString().slice(0, 10)} (${days} day${days === 1 ? "" : "s"}). Raised from the employee portal.`,
    href: "/leave?status=PENDING",
  });
  revalidatePath("/me/leave");
  return { error: null, ok: true };
}

export async function cancelMyLeaveAction(formData: FormData): Promise<State> {
  const employee = await getEssEmployee();
  if (!employee) return { error: "Please sign in again." };
  const id = String(formData.get("id") || "");
  // Only your own request, and only while it's still waiting.
  const res = await prisma.leaveRequest.updateMany({
    where: { id, employeeId: employee.id, status: "PENDING" },
    data: { status: "CANCELLED", decidedAt: new Date() },
  });
  if (res.count !== 1) return { error: "Only a pending request can be cancelled here." };
  await logAudit({ entityType: "LEAVE_REQUEST", entityId: id, action: "UPDATE", before: { status: "PENDING" }, after: { status: "CANCELLED", via: "employee portal" }, userId: `employee:${employee.id}`, userName: employee.name, branchId: employee.branchId });
  revalidatePath("/me/leave");
  return { error: null, ok: true };
}
