"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, requirePermission } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { logAudit } from "@/lib/audit";
import { approvedHeadcount, validateApproval } from "@/lib/demandApproval";
import {
  markUnderMobilisation,
  markOnSite,
  revertSiteArrival,
  releaseFromMobilisation,
} from "@/lib/employeeStageTransitions";
import { assertContactsValid } from "@/lib/validators";

function stringOrNull(value: FormDataEntryValue | null) {
  const s = String(value || "").trim();
  return s || null;
}

async function assertRequestInBranch(id: string, branchId: string | null, isSuperAdmin: boolean) {
  const request = await prisma.demandRequest.findUnique({ where: { id }, select: { branchId: true } });
  return !!request && !isOutsideBranch(request.branchId, branchId, isSuperAdmin);
}

type TradeInput = {
  trade: string;
  quantity: number;
  shift: string | null;
};

export async function createDemandRequestAction(formData: FormData) {
  assertContactsValid(formData);
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const clientId = String(formData.get("clientId") || "");
  const projectId = String(formData.get("projectId") || "");
  const requestType = stringOrNull(formData.get("requestType")) || "New";
  const remarks = stringOrNull(formData.get("remarks"));
  const tradesJson = String(formData.get("tradesJson") || "[]");
  if (!clientId || !projectId || !branchId) return;

  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { branchId: true } });
  if (!project || isOutsideBranch(project.branchId, branchId, isSuperAdmin)) return;

  let trades: TradeInput[];
  try {
    trades = JSON.parse(tradesJson);
  } catch {
    trades = [];
  }
  trades = trades.filter((t) => t.trade && t.quantity > 0);

  // The dropdown offers trades from the taxonomy *and* trades only present as
  // strings on the roster, so a name may not have a taxonomy entry yet. Resolve
  // case-insensitively and create what's missing, which keeps the Trades list
  // converging on what the workforce actually does rather than drifting apart.
  const skillIdByTrade = new Map<string, string>();
  for (const name of new Set(trades.map((t) => t.trade.trim()))) {
    const existing = await prisma.skill.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
      select: { id: true },
    });
    const skill = existing ?? (await prisma.skill.create({ data: { name } }));
    skillIdByTrade.set(name.toLowerCase(), skill.id);
  }
  if (trades.length === 0) return;

  const created = await prisma.demandRequest.create({
    data: {
      clientId,
      projectId,
      branchId,
      requestType,
      remarks,
      requestedById: user.id,
      trades: {
        create: trades.map((t) => ({
          skillId: skillIdByTrade.get(t.trade.trim().toLowerCase()),
          trade: t.trade.trim(),
          quantity: t.quantity,
          shift: t.shift,
        })),
      },
    },
  });

  await logAudit({
    entityType: "DEMAND_REQUEST",
    entityId: created.id,
    action: "CREATE",
    after: { clientId, projectId, requestType, trades },
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidatePath("/demand");
  redirect(`/demand/${created.id}`);
}

export async function updateDemandRequestAction(formData: FormData) {
  assertContactsValid(formData);
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("requestId") || "");
  if (!id) return;
  if (!(await assertRequestInBranch(id, branchId, isSuperAdmin))) return;

  const before = await prisma.demandRequest.findUnique({ where: { id } });

  const data = {
    status: stringOrNull(formData.get("status")) || "Open",
    remarks: stringOrNull(formData.get("remarks")),
  };

  await prisma.demandRequest.update({ where: { id }, data });

  await logAudit({
    entityType: "DEMAND_REQUEST",
    entityId: id,
    action: "UPDATE",
    before: before as unknown as Record<string, unknown>,
    after: data,
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidatePath(`/demand/${id}`);
  revalidatePath("/demand");
}

export async function deleteDemandRequestAction(formData: FormData) {
  assertContactsValid(formData);
  await requirePermission("demand", "delete");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("requestId") || "");
  if (!id) return;
  if (!(await assertRequestInBranch(id, branchId, isSuperAdmin))) return;

  const allocationCount = await prisma.demandRequestAllocation.count({
    where: { demandRequestTrade: { demandRequestId: id } },
  });
  if (allocationCount > 0) {
    redirect(
      `/demand/${id}?error=${encodeURIComponent(
        "Unallocate all employees from this request before deleting it."
      )}`
    );
  }

  const existing = await prisma.demandRequest.findUnique({ where: { id } });
  await prisma.demandRequest.delete({ where: { id } });

  if (existing) {
    await logAudit({
      entityType: "DEMAND_REQUEST",
      entityId: id,
      action: "DELETE",
      before: { clientId: existing.clientId, projectId: existing.projectId, requestNo: existing.requestNo },
      userId: user.id,
      userName: user.name,
      branchId,
    });
  }

  revalidatePath("/demand");
  redirect("/demand");
}

// Pairs each selected employee (in order) with this trade line, soft-capped
// to (quantity - already allocated) — mirrors bulkCheckInAction (Phase 6).
// Allocating is a real project placement, so it also opens an
// EmployeeAssignmentHistory row exactly like updateEmployeeAction's existing
// project-change handling (Phase 5) — reusing that shape rather than
// duplicating divergent logic.
export async function allocateEmployeesAction(
  formData: FormData
): Promise<{ allocated: number; requested: number }> {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const tradeId = String(formData.get("tradeId") || "");
  const employeeIds = formData.getAll("employeeId").map(String).filter(Boolean);
  if (!tradeId || employeeIds.length === 0) return { allocated: 0, requested: employeeIds.length };

  const trade = await prisma.demandRequestTrade.findUnique({
    where: { id: tradeId },
    include: { demandRequest: { include: { branch: true, project: true } }, allocations: true },
  });
  if (!trade || isOutsideBranch(trade.demandRequest.branchId, branchId, isSuperAdmin)) {
    return { allocated: 0, requested: employeeIds.length };
  }

  // The approved number is the cap, not the requested one — and a line nobody
  // has agreed takes nobody. This was previously enforced only by the UI
  // disabling the button, which left the action itself open.
  const approved = approvedHeadcount(trade);
  if (approved === 0) return { allocated: 0, requested: employeeIds.length };
  const remaining = Math.max(0, approved - trade.allocations.length);
  let allocated = 0;
  const mobilisedIds: string[] = [];
  // Separate from mobilisedIds: only the employees whose project actually
  // changed — an already-ACTIVE worker re-allocated to a different trade on
  // the *same* project shouldn't be knocked back into "awaiting arrival"
  // when nothing about their placement changed.
  const projectChangedIds: string[] = [];
  const rawDate = String(formData.get("mobilisationDate") || "").trim();
  const mobilisationDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
    ? new Date(rawDate + "T00:00:00.000Z")
    : null;

  for (const employeeId of employeeIds) {
    if (allocated >= remaining) break;

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { supplier: { select: { approvalStatus: true, labourApprovalStatus: true } } },
    });
    if (!employee || isOutsideBranch(employee.branchId, branchId, isSuperAdmin)) continue;
    if (
      employee.supplier &&
      (employee.supplier.approvalStatus !== "Approved" || employee.supplier.labourApprovalStatus !== "Approved")
    ) {
      continue;
    }

    await prisma.demandRequestAllocation.create({
      data: { demandRequestTradeId: tradeId, employeeId },
    });

    if (employee.projectId !== trade.demandRequest.projectId) {
      const openHistory = await prisma.employeeAssignmentHistory.findFirst({
        where: { employeeId, demobilizedDate: null },
        orderBy: { mobilizedDate: "desc" },
      });
      if (openHistory) {
        await prisma.employeeAssignmentHistory.update({
          where: { id: openHistory.id },
          data: { demobilizedDate: new Date() },
        });
      }
      await prisma.employeeAssignmentHistory.create({
        data: {
          employeeId,
          projectId: trade.demandRequest.projectId,
          projectName: trade.demandRequest.project.name,
          branchName: trade.demandRequest.branch.name,
        },
      });
      await prisma.employee.update({ where: { id: employeeId }, data: { projectId: trade.demandRequest.projectId } });
      projectChangedIds.push(employeeId);
    }

    await logAudit({
      entityType: "DEMAND_REQUEST_ALLOCATION",
      entityId: employeeId,
      action: "CREATE",
      after: { tradeId, trade: trade.trade, projectId: trade.demandRequest.projectId },
      userId: user.id,
      userName: user.name,
      branchId,
    });

    revalidatePath(`/employees/${employeeId}`);
    mobilisedIds.push(employeeId);
    allocated++;
  }

  // Allocated is not the same as working: the worker is committed to a site but
  // hasn't started, which is its own stage until attendance says otherwise.
  await markUnderMobilisation(mobilisedIds, mobilisationDate);

  // markUnderMobilisation only touches IDLE/UNDER_MOBILISATION/ON_SITE — an
  // already-ACTIVE worker moved onto a genuinely new project also needs to
  // go back through Site Arrival before showing up as deployed there, or
  // they appear on Demobilisation (which reads any working stage) having
  // never been confirmed on the new site at all.
  if (projectChangedIds.length > 0) {
    await prisma.employee.updateMany({
      where: { id: { in: projectChangedIds }, status: "ACTIVE" },
      data: { status: "UNDER_MOBILISATION", mobilisationDate, siteArrivalDate: null },
    });
  }

  // revalidatePath only invalidates the exact path, so the mobilise and
  // documents screens have to be named explicitly — otherwise they re-render
  // from stale cache and an assignment appears not to have happened.
  revalidatePath(`/demand/${trade.demandRequestId}`);
  revalidatePath(`/demand/${trade.demandRequestId}/mobilise`);
  revalidatePath(`/demand/${trade.demandRequestId}/documents`);
  revalidatePath("/demand/mobilisation");
  // markUnderMobilisation above moves these workers onto the site-arrival
  // queue — without this, the page kept serving its cached (empty) render
  // until something else happened to invalidate it, so a newly mobilised
  // worker appeared not to show up there at all.
  revalidatePath("/demand/site-arrival");
  return { allocated, requested: employeeIds.length };
}

export async function unallocateEmployeeAction(formData: FormData) {
  assertContactsValid(formData);
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const allocationId = String(formData.get("allocationId") || "");
  if (!allocationId) return;

  const allocation = await prisma.demandRequestAllocation.findUnique({
    where: { id: allocationId },
    include: {
      demandRequestTrade: { include: { demandRequest: true } },
      employee: { select: { status: true } },
    },
  });
  if (!allocation || isOutsideBranch(allocation.demandRequestTrade.demandRequest.branchId, branchId, isSuperAdmin)) {
    return;
  }
  // Once Site Arrival (or attendance) has confirmed them, removing the
  // allocation here would strand a worker who's actually on site with
  // nothing behind them — that has to go through Demobilisation instead,
  // which closes the placement properly. The UI already hides this button
  // past that point; this is the server-side half of the same rule.
  if (allocation.employee.status !== "UNDER_MOBILISATION") return;

  await prisma.demandRequestAllocation.delete({ where: { id: allocationId } });

  const openHistory = await prisma.employeeAssignmentHistory.findFirst({
    where: { employeeId: allocation.employeeId, demobilizedDate: null },
    orderBy: { mobilizedDate: "desc" },
  });
  if (openHistory) {
    await prisma.employeeAssignmentHistory.update({
      where: { id: openHistory.id },
      data: { demobilizedDate: new Date() },
    });
  }
  await prisma.employee.update({ where: { id: allocation.employeeId }, data: { projectId: null } });

  // The placement is over, so everything that described it goes with it —
  // otherwise the worker sits on the arrival queue forever, growing more
  // overdue against a demand they are no longer on.
  await releaseFromMobilisation([allocation.employeeId]);

  await logAudit({
    entityType: "DEMAND_REQUEST_ALLOCATION",
    entityId: allocation.employeeId,
    action: "DELETE",
    before: { tradeId: allocation.demandRequestTradeId },
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidatePath(`/employees/${allocation.employeeId}`);
  const demandId = allocation.demandRequestTrade.demandRequestId;
  revalidatePath(`/demand/${demandId}`);
  revalidatePath(`/demand/${demandId}/mobilise`);
  revalidatePath(`/demand/${demandId}/documents`);
  revalidatePath("/demand/mobilisation");
  revalidatePath("/demand/site-arrival");
}

/**
 * Changes a worker's recorded trade, from the mobilisation screen.
 *
 * A demand often can't be filled from the exact trade — 84 idle Helpers and no
 * idle Carpenters — and in practice a worker gets re-designated rather than the
 * demand going unfilled. This writes the worker's profile (Employee.trade), so
 * the change is permanent and visible everywhere, not a per-demand override.
 */
export async function changeEmployeeTradeAction(
  formData: FormData
): Promise<{ error?: string } | void> {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const employeeId = String(formData.get("employeeId") || "");
  const trade = String(formData.get("trade") || "").trim();
  if (!employeeId || !trade) return;

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, branchId: true, trade: true, name: true },
  });
  if (!employee || isOutsideBranch(employee.branchId, branchId, isSuperAdmin)) return;

  // Keep the Trades taxonomy in step with what's actually recorded, the same
  // way raising a demand does.
  const existingSkill = await prisma.skill.findFirst({
    where: { name: { equals: trade, mode: "insensitive" } },
    select: { id: true },
  });
  const skill = existingSkill ?? (await prisma.skill.create({ data: { name: trade } }));

  await prisma.employee.update({
    where: { id: employeeId },
    // `position` mirrors trade elsewhere in the app, so it moves together.
    data: { trade, position: trade },
  });

  // Record it against the worker too, so the taxonomy join stops being empty.
  await prisma.employeeSkill.upsert({
    where: { employeeId_skillId: { employeeId, skillId: skill.id } },
    update: {},
    create: { employeeId, skillId: skill.id },
  });

  await logAudit({
    entityType: "EMPLOYEE",
    entityId: employeeId,
    action: "UPDATE",
    before: { trade: employee.trade },
    after: { trade },
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidatePath(`/employees/${employeeId}`);
  // A re-designation changes who matches which trade line, so the whole module
  // is invalidated rather than one path.
  revalidatePath("/demand", "layout");
}

/**
 * Approves or un-approves a single trade line.
 *
 * Approval sits on the line rather than the request because a client signs off
 * trade by trade. It is deliberately not gated on whether idle workers of that
 * trade exist: mobilisation can re-designate someone from another trade, so a
 * shortage today is not a reason to refuse approval.
 */
export async function setTradeApprovalAction(
  formData: FormData
): Promise<{ error?: string } | void> {
  await requirePermission("demand", "approve");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const tradeId = String(formData.get("tradeId") || "");
  if (!tradeId) return;

  const trade = await prisma.demandRequestTrade.findUnique({
    where: { id: tradeId },
    include: { demandRequest: { select: { id: true, branchId: true } }, allocations: true },
  });
  if (!trade || isOutsideBranch(trade.demandRequest.branchId, branchId, isSuperAdmin)) return;

  const raw = String(formData.get("approvedQuantity") || "").trim();
  // An empty box means "undecided", which is not the same as refusing zero.
  const next = raw === "" ? null : Number(raw);

  let approvedQuantity: number | null;
  if (next === null) {
    if (trade.allocations.length > 0) {
      return {
        error: `${trade.trade} has ${trade.allocations.length} worker(s) mobilised — remove them first.`,
      };
    }
    approvedQuantity = null;
  } else {
    const check = validateApproval(next, {
      quantity: trade.quantity,
      approvedQuantity: trade.approvedQuantity,
      allocatedCount: trade.allocations.length,
    });
    if (!check.ok) return { error: check.error };
    approvedQuantity = check.value;
  }

  await prisma.demandRequestTrade.update({
    where: { id: tradeId },
    data: { approvedQuantity },
  });

  await logAudit({
    entityType: "DEMAND_REQUEST",
    entityId: trade.demandRequest.id,
    action: "UPDATE",
    before: { trade: trade.trade, approvedQuantity: trade.approvedQuantity, requested: trade.quantity },
    after: { trade: trade.trade, approvedQuantity, requested: trade.quantity },
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidatePath(`/demand/${trade.demandRequest.id}`);
  revalidatePath(`/demand/${trade.demandRequest.id}/mobilise`);
  revalidatePath("/demand/mobilisation");
  revalidatePath("/demand");
}


/**
 * Records that mobilised workers reached site.
 *
 * Both this and its reverse revalidate the employee pages as well as the queue,
 * because the stage badge on the worker's own record is the copy most people
 * look at.
 */
export async function confirmSiteArrivalAction(formData: FormData) {
  assertContactsValid(formData);
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const employeeIds = formData.getAll("employeeId").map(String).filter(Boolean);
  if (employeeIds.length === 0) return { confirmed: 0, requested: 0 };

  const rawDate = String(formData.get("siteArrivalDate") || "").trim();
  // No sensible default: an arrival with no date is the thing this step exists
  // to stop, so a missing or malformed one is refused rather than guessed.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    return { confirmed: 0, requested: employeeIds.length };
  }
  const siteArrivalDate = new Date(rawDate + "T00:00:00.000Z");
  const siteId = stringOrNull(formData.get("siteId"));

  // Filter to this branch before writing — updateMany takes ids straight from
  // the form, so the branch guard has to happen here rather than inside it.
  const employees = await prisma.employee.findMany({
    where: { id: { in: employeeIds } },
    select: { id: true, branchId: true, name: true, status: true, projectId: true },
  });
  const allowed = employees.filter((e) => !isOutsideBranch(e.branchId, branchId, isSuperAdmin));

  // A site belongs to exactly one project, so it can only be applied to workers
  // on that project. The rest are still confirmed as arrived — the arrival is
  // the fact being recorded, and the site is an extra the form may have got
  // wrong. Refusing the whole batch over it would cost more than it saves.
  let siteProjectId: string | null = null;
  if (siteId) {
    const site = await prisma.site.findUnique({
      where: { id: siteId },
      select: { projectId: true, project: { select: { branchId: true } } },
    });
    if (!site || isOutsideBranch(site.project.branchId, branchId, isSuperAdmin)) {
      return { confirmed: 0, requested: employeeIds.length };
    }
    siteProjectId = site.projectId;
  }

  const onSiteProject = allowed.filter((e) => siteProjectId && e.projectId === siteProjectId);
  const elsewhere = allowed.filter((e) => !siteProjectId || e.projectId !== siteProjectId);

  const confirmed =
    (await markOnSite(onSiteProject.map((e) => e.id), siteArrivalDate, siteId)) +
    (await markOnSite(elsewhere.map((e) => e.id), siteArrivalDate, null));

  for (const employee of allowed) {
    await logAudit({
      entityType: "EMPLOYEE_SITE_ARRIVAL",
      entityId: employee.id,
      action: "UPDATE",
      before: { status: employee.status, siteArrivalDate: null },
      after: {
        status: "ON_SITE",
        siteArrivalDate: rawDate,
        siteId: employee.projectId === siteProjectId ? siteId : null,
      },
      userId: user.id,
      userName: user.name,
      branchId,
    });
    revalidatePath(`/employees/${employee.id}`);
  }

  revalidatePath("/demand/site-arrival");
  revalidatePath("/employees");
  return { confirmed, requested: employeeIds.length };
}

/** Reverses a site-arrival confirmation entered against the wrong worker. */
export async function revertSiteArrivalAction(formData: FormData) {
  assertContactsValid(formData);
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const employeeId = String(formData.get("employeeId") || "");
  if (!employeeId) return;

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, branchId: true, status: true, siteArrivalDate: true },
  });
  if (!employee || isOutsideBranch(employee.branchId, branchId, isSuperAdmin)) return;

  await revertSiteArrival([employee.id]);

  await logAudit({
    entityType: "EMPLOYEE_SITE_ARRIVAL",
    entityId: employee.id,
    action: "UPDATE",
    before: { status: employee.status, siteArrivalDate: employee.siteArrivalDate },
    after: { status: "UNDER_MOBILISATION", siteArrivalDate: null },
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidatePath(`/employees/${employeeId}`);
  revalidatePath("/demand/site-arrival");
  revalidatePath("/employees");
}

/**
 * Rejects a mobilised worker who never actually turned up.
 *
 * The other half of the Approve/Disapprove pair on Site Arrival — Approve is
 * confirmSiteArrivalAction above. Unlike a revert (which just undoes a
 * mis-click), a disapproval ends the placement entirely: same cleanup as
 * unallocateEmployeeAction (allocation removed, assignment history closed,
 * project cleared, stage back to IDLE), plus a reason on file. That reason is
 * a normal EmployeeNote, so it shows up wherever notes already do — the
 * profile's Notes section and the Instant View report — without needing a
 * dedicated "disapproval" concept of its own.
 */
export async function disapproveSiteArrivalAction(
  formData: FormData
): Promise<{ error?: string } | void> {
  await requirePermission("demand", "approve");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const employeeId = String(formData.get("employeeId") || "");
  const reason = String(formData.get("reason") || "").trim();
  if (!employeeId) return;
  if (!reason) return { error: "A reason is required." };

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, branchId: true, status: true, name: true },
  });
  if (!employee || isOutsideBranch(employee.branchId, branchId, isSuperAdmin)) return;
  if (employee.status !== "UNDER_MOBILISATION") {
    return { error: `${employee.name} is no longer awaiting arrival.` };
  }

  const allocation = await prisma.demandRequestAllocation.findFirst({
    where: { employeeId },
    include: { demandRequestTrade: { include: { demandRequest: true } } },
    orderBy: { allocatedAt: "desc" },
  });

  if (allocation) {
    await prisma.demandRequestAllocation.delete({ where: { id: allocation.id } });
  }

  const openHistory = await prisma.employeeAssignmentHistory.findFirst({
    where: { employeeId, demobilizedDate: null },
    orderBy: { mobilizedDate: "desc" },
  });
  if (openHistory) {
    await prisma.employeeAssignmentHistory.update({
      where: { id: openHistory.id },
      data: { demobilizedDate: new Date() },
    });
  }

  await prisma.employee.update({ where: { id: employeeId }, data: { projectId: null } });
  await releaseFromMobilisation([employeeId]);

  await prisma.employeeNote.create({
    data: {
      employeeId,
      remarks: `Site arrival disapproved: ${reason}`,
      createdById: user.id,
    },
  });

  await logAudit({
    entityType: "EMPLOYEE_SITE_ARRIVAL",
    entityId: employeeId,
    action: "UPDATE",
    before: { status: "UNDER_MOBILISATION" },
    after: { status: "IDLE", disapprovalReason: reason },
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidatePath(`/employees/${employeeId}`);
  revalidatePath("/employees/instant-view");
  revalidatePath("/demand/site-arrival");
  revalidatePath("/demand/mobilisation");
  revalidatePath("/employees");
  if (allocation) {
    const demandId = allocation.demandRequestTrade.demandRequestId;
    revalidatePath(`/demand/${demandId}`);
    revalidatePath(`/demand/${demandId}/mobilise`);
  }
}
