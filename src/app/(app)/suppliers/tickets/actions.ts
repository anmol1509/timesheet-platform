"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission, requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { logAudit } from "@/lib/audit";
import { notifySupplier } from "@/lib/vendor/notify";

type State = { error: string | null; ok?: boolean };
const str = (v: FormDataEntryValue | null) => String(v ?? "").trim();

async function load(id: string) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const t = await prisma.supplierTicket.findUnique({ where: { id }, include: { supplier: { select: { name: true } } } });
  if (!t || isOutsideBranch(t.branchId, branchId, isSuperAdmin)) return { user, t: null };
  return { user, t };
}

/** Answer a supplier. It appears in their portal and they are notified. */
export async function replyToTicketAction(_prev: State, formData: FormData): Promise<State> {
  await requirePermission("partners", "edit");
  const { user, t } = await load(str(formData.get("ticketId")));
  if (!t) return { error: "Message not found." };
  const body = str(formData.get("body"));
  if (!body) return { error: "Write your reply first." };
  if (body.length > 4000) return { error: "That reply is too long (4,000 characters at most)." };
  await prisma.$transaction([
    prisma.supplierTicketMessage.create({ data: { ticketId: t.id, fromSupplier: false, authorName: user.name, body } }),
    prisma.supplierTicket.update({ where: { id: t.id }, data: { status: "REPLIED" } }),
  ]);
  await notifySupplier({ supplierId: t.supplierId, kind: "TICKET_REPLY", title: "We replied to your message", body: t.subject, href: `/vendor/support/${t.id}` });
  await logAudit({ entityType: "SUPPLIER_TICKET", entityId: t.id, action: "UPDATE", after: { replied: true, supplier: t.supplier.name, subject: t.subject }, userId: user.id, userName: user.name, branchId: t.branchId });
  revalidatePath(`/suppliers/tickets/${t.id}`);
  revalidatePath("/suppliers/tickets");
  return { error: null, ok: true };
}

export async function setTicketStatusAction(formData: FormData): Promise<State> {
  await requirePermission("partners", "edit");
  const { user, t } = await load(str(formData.get("id")));
  if (!t) return { error: "Message not found." };
  const status = str(formData.get("status"));
  if (status !== "CLOSED" && status !== "OPEN") return { error: "Unknown status." };
  await prisma.supplierTicket.update({ where: { id: t.id }, data: { status } });
  await logAudit({ entityType: "SUPPLIER_TICKET", entityId: t.id, action: "UPDATE", before: { status: t.status }, after: { status, supplier: t.supplier.name }, userId: user.id, userName: user.name, branchId: t.branchId });
  revalidatePath(`/suppliers/tickets/${t.id}`);
  revalidatePath("/suppliers/tickets");
  return { error: null, ok: true };
}
