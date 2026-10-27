"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { can, canWrite } from "@/lib/permissions";
import { isOutsideBranch } from "@/lib/branch";
import { logAudit } from "@/lib/audit";
import { assertContactsValid } from "@/lib/validators";

/**
 * The demand request quick view: where a request stands (requested, approved, allocated, offers) and the two
 * things people change without opening it, its priority and remarks. Approving a trade's quantity goes through
 * the same action the request page uses; status changes, allocation and offers stay on the request page.
 */
export type DemandQuickView = {
  id: string;
  requestNo: number;
  requestType: string;
  status: string;
  priority: string | null;
  remarks: string | null;
  clientName: string;
  projectName: string;
  createdAt: string;
  ageDays: number;
  trades: { id: string; trade: string; quantity: number; approvedQuantity: number | null; allocated: number }[];
  offers: { id: string; supplierName: string; status: string; sentAt: string }[];
  nocs: number;
  canEdit: boolean;
  canApprove: boolean;
};

export async function loadDemandQuickViewAction(id: string): Promise<DemandQuickView | null> {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const r = await prisma.demandRequest.findUnique({
    where: { id },
    include: {
      client: { select: { name: true } },
      project: { select: { name: true } },
      trades: { select: { id: true, trade: true, quantity: true, approvedQuantity: true, _count: { select: { allocations: true } } }, orderBy: { trade: "asc" } },
      supplierOffers: { select: { id: true, status: true, sentAt: true, supplier: { select: { name: true } } }, orderBy: { sentAt: "desc" } },
      _count: { select: { nocs: true } },
    },
  });
  if (!r || isOutsideBranch(r.branchId, branchId, isSuperAdmin)) return null;
  const subject = subjectOf(user);
  return {
    id: r.id,
    requestNo: r.requestNo,
    requestType: r.requestType,
    status: r.status,
    priority: r.priority,
    remarks: r.remarks,
    clientName: r.client.name,
    projectName: r.project.name,
    createdAt: r.createdAt.toISOString(),
    ageDays: Math.max(0, Math.floor((Date.now() - r.createdAt.getTime()) / 86_400_000)),
    trades: r.trades.map((t) => ({ id: t.id, trade: t.trade, quantity: t.quantity, approvedQuantity: t.approvedQuantity, allocated: t._count.allocations })),
    offers: r.supplierOffers.map((o) => ({ id: o.id, supplierName: o.supplier.name, status: o.status, sentAt: o.sentAt.toISOString() })),
    nocs: r._count.nocs,
    canEdit: canWrite(subject, "demand"),
    canApprove: can(subject, "demand", "approve"),
  };
}

export type DemandSaveResult = { ok: true; value: string | null; previous: string | null } | { ok?: false; error?: string };

/** Saves the priority or the remarks of a request. */
export async function saveDemandFieldAction(input: { id: string; field: string; value: string | null }): Promise<DemandSaveResult> {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  if (!canWrite(subjectOf(user), "demand")) return { error: "You don't have permission to edit demand requests." };
  if (input.field !== "priority" && input.field !== "remarks") return { error: "That field can't be edited here." };
  const before = await prisma.demandRequest.findUnique({ where: { id: input.id } });
  if (!before || isOutsideBranch(before.branchId, branchId, isSuperAdmin)) return { error: "That request isn't in this company." };

  const value = (input.value ?? "").trim() || null;
  if (input.field === "priority" && value && !["Low", "Medium", "High"].includes(value)) return { error: "Choose Low, Medium or High." };
  try {
    const f = new FormData();
    if (value) f.set(input.field, value);
    assertContactsValid(f);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "That value isn't valid." };
  }

  await prisma.demandRequest.update({ where: { id: input.id }, data: { [input.field]: value } });
  const previous = (before as Record<string, unknown>)[input.field] as string | null;
  await logAudit({ entityType: "DEMAND_REQUEST", entityId: input.id, action: "UPDATE", before: { [input.field]: previous }, after: { [input.field]: value }, userId: user.id, userName: user.name, branchId });
  revalidatePath(`/demand/${input.id}`);
  revalidatePath("/demand");
  return { ok: true, value, previous };
}
