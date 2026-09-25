"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission, requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { logAudit } from "@/lib/audit";
import { notifySupplier } from "@/lib/vendor/notify";
import { assertContactsValid } from "@/lib/validators";

type State = { error: string | null; ok?: boolean };
const str = (v: FormDataEntryValue | null) => String(v ?? "").trim();

/** Send a demand to one or more suppliers to answer through their portal. */
export async function sendToSuppliersAction(_prev: State, formData: FormData): Promise<State> {
  assertContactsValid(formData);
  await requirePermission("demand", "edit");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const demandId = str(formData.get("demandId"));
  const supplierIds = formData.getAll("supplierId").map(String).filter(Boolean);
  if (supplierIds.length === 0) return { error: "Choose at least one supplier." };

  const demand = await prisma.demandRequest.findUnique({ where: { id: demandId }, select: { id: true, requestNo: true, branchId: true, status: true } });
  if (!demand || isOutsideBranch(demand.branchId, branchId, isSuperAdmin)) return { error: "Request not found." };
  if (demand.status === "Closed" || demand.status === "Rejected") return { error: "This request is closed." };

  const suppliers = await prisma.supplier.findMany({ where: { id: { in: supplierIds }, portalEnabled: true, status: "ACTIVE" }, select: { id: true, name: true, branchId: true } });
  const ok = suppliers.filter((s) => s.branchId === demand.branchId);
  if (ok.length === 0) return { error: "None of those suppliers have portal access." };

  const already = new Set((await prisma.demandSupplierOffer.findMany({ where: { demandRequestId: demand.id, supplierId: { in: ok.map((s) => s.id) } }, select: { supplierId: true } })).map((o) => o.supplierId));
  const made = await prisma.demandSupplierOffer.createMany({
    data: ok.map((s) => ({ demandRequestId: demand.id, supplierId: s.id, sentById: user.id })),
    skipDuplicates: true,
  });
  const fresh = await prisma.demandSupplierOffer.findMany({ where: { demandRequestId: demand.id, supplierId: { in: ok.filter((s) => !already.has(s.id)).map((s) => s.id) } }, select: { id: true, supplierId: true } });
  for (const o of fresh) await notifySupplier({ supplierId: o.supplierId, kind: "DEMAND_REQUEST", title: `New request #${demand.requestNo} for you`, body: "We'd like your quote. Accept or decline in Demands.", href: `/vendor/demands/${o.id}` });
  await logAudit({ entityType: "DEMAND_REQUEST", entityId: demand.id, action: "UPDATE", after: { sentToSuppliers: ok.map((s) => s.name), requestNo: demand.requestNo, count: made.count }, userId: user.id, userName: user.name, branchId: demand.branchId });
  revalidatePath(`/demand/${demand.id}`);
  return { error: null, ok: true };
}

/** Take back an offer the supplier has not answered yet. */
export async function withdrawOfferAction(formData: FormData): Promise<State> {
  assertContactsValid(formData);
  await requirePermission("demand", "edit");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const offer = await prisma.demandSupplierOffer.findUnique({ where: { id: str(formData.get("id")) }, include: { demandRequest: { select: { id: true, requestNo: true, branchId: true } }, supplier: { select: { name: true } } } });
  if (!offer || isOutsideBranch(offer.demandRequest.branchId, branchId, isSuperAdmin)) return { error: "Offer not found." };
  if (offer.status !== "SENT") return { error: "The supplier has already answered, so it can't be withdrawn." };
  await prisma.demandSupplierOffer.delete({ where: { id: offer.id } });
  await logAudit({ entityType: "DEMAND_REQUEST", entityId: offer.demandRequest.id, action: "UPDATE", after: { withdrawnFrom: offer.supplier.name, requestNo: offer.demandRequest.requestNo }, userId: user.id, userName: user.name, branchId: offer.demandRequest.branchId });
  revalidatePath(`/demand/${offer.demandRequest.id}`);
  return { error: null, ok: true };
}
