"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, requireWrite } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { logAudit } from "@/lib/audit";
import { revertSiteArrival } from "@/lib/employeeStageTransitions";
import { unallocateEmployeeAction } from "./actions";

/** Undo only reaches back this far, and only for what the same person just did. The audit log's "Put this change back" covers anything older. */
const WINDOW_MS = 30 * 60 * 1000;

type Diff = Record<string, { from?: unknown; to?: unknown } | undefined>;
const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);

/**
 * Undoes what a screen just did: site arrivals recorded or confirmed, and workers mobilised. It checks that each worker
 * is still exactly where that action left them, so it never overwrites anything that happened since.
 */
export async function undoEntriesAction(entryIds: string[]): Promise<{ ok: boolean; message: string }> {
  await requireWrite("demand");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const ids = [...new Set((entryIds ?? []).filter((x) => typeof x === "string"))].slice(0, 300);
  if (ids.length === 0) return { ok: false, message: "Nothing to undo." };

  const entries = await prisma.auditLog.findMany({
    where: { id: { in: ids }, userId: user.id, revertedAt: null, createdAt: { gte: new Date(Date.now() - WINDOW_MS) } },
    orderBy: { createdAt: "asc" },
  });
  if (entries.length === 0) return { ok: false, message: "That can't be undone any more. Use the audit log to put a change back." };

  let undone = 0;
  const skipped: string[] = [];
  for (const e of entries) {
    const mark = () => prisma.auditLog.update({ where: { id: e.id }, data: { revertedAt: new Date(), revertedByName: user.name } });
    try {
      if (e.entityType === "EMPLOYEE_SITE_ARRIVAL" && e.action === "UPDATE") {
        const ch = (e.changes ?? {}) as Diff;
        const emp = await prisma.employee.findUnique({ where: { id: e.entityId }, select: { id: true, name: true, branchId: true, status: true, siteArrivalDate: true, siteId: true } });
        if (!emp || isOutsideBranch(emp.branchId, branchId, isSuperAdmin)) { skipped.push("a worker was not found"); continue; }
        const recorded = typeof ch.siteArrivalDate?.to === "string" ? ch.siteArrivalDate.to.slice(0, 10) : null;
        const sameDate = !!recorded && day(emp.siteArrivalDate) === recorded;
        const siteSet = typeof ch.siteId?.to === "string" ? ch.siteId.to : null;
        const clearSite = siteSet && emp.siteId === siteSet ? { siteId: null } : {};
        if (ch.status?.to === "ON_SITE") {
          if (emp.status !== "ON_SITE" || !sameDate) { skipped.push(`${emp.name} has moved on since`); continue; }
          await revertSiteArrival([emp.id]);
          if (Object.keys(clearSite).length) await prisma.employee.update({ where: { id: emp.id }, data: clearSite });
          await logAudit({ entityType: "EMPLOYEE_SITE_ARRIVAL", entityId: emp.id, action: "UPDATE", before: { status: "ON_SITE", siteArrivalDate: recorded }, after: { status: "UNDER_MOBILISATION", siteArrivalDate: null }, userId: user.id, userName: user.name, branchId: e.branchId, source: "REVERT", revertOfId: e.id });
        } else if (!ch.status && ch.siteArrivalDate && ch.siteArrivalDate.from == null) {
          if (emp.status !== "ACTIVE" || !sameDate) { skipped.push(`${emp.name} has moved on since`); continue; }
          await prisma.employee.update({ where: { id: emp.id }, data: { siteArrivalDate: null, ...clearSite } });
          await logAudit({ entityType: "EMPLOYEE_SITE_ARRIVAL", entityId: emp.id, action: "UPDATE", before: { siteArrivalDate: recorded }, after: { siteArrivalDate: null }, userId: user.id, userName: user.name, branchId: e.branchId, source: "REVERT", revertOfId: e.id });
        } else { skipped.push("that kind of change can't be undone here"); continue; }
        await mark();
        undone++;
        revalidatePath(`/employees/${emp.id}`);
      } else if (e.entityType === "DEMAND_REQUEST_ALLOCATION" && e.action === "CREATE") {
        const tradeId = typeof (e.changes as Record<string, unknown> | null)?.tradeId === "string" ? String((e.changes as Record<string, unknown>).tradeId) : null;
        const allocation = tradeId ? await prisma.demandRequestAllocation.findFirst({ where: { employeeId: e.entityId, demandRequestTradeId: tradeId }, select: { id: true, employee: { select: { name: true } } } }) : null;
        if (!allocation) { skipped.push("a worker was already taken off"); continue; }
        // The same path as the Remove button, so everything that mobilising set up is taken down the same way.
        const fd = new FormData();
        fd.set("allocationId", allocation.id);
        await unallocateEmployeeAction(fd);
        const still = await prisma.demandRequestAllocation.findUnique({ where: { id: allocation.id }, select: { id: true } });
        if (still) { skipped.push(`${allocation.employee.name} has already arrived on site`); continue; }
        await mark();
        undone++;
      } else {
        skipped.push("that kind of change can't be undone here");
      }
    } catch {
      skipped.push("something couldn't be undone");
    }
  }
  revalidatePath("/demand/site-arrival");
  revalidatePath("/demand/mobilisation");
  revalidatePath("/audit-log");
  if (undone === 0) return { ok: false, message: `Nothing was undone: ${[...new Set(skipped)].join("; ")}.` };
  const base = undone === 1 ? "Undone" : `Undone for ${undone} workers`;
  return { ok: true, message: skipped.length ? `${base}. ${skipped.length} could not be: ${[...new Set(skipped)].slice(0, 2).join("; ")}.` : `${base}.` };
}
