"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getVendor } from "@/lib/vendor/session";
import { approverIds, notifyUsers } from "@/lib/notifications/notify";
import { assertContactsValid } from "@/lib/validators";

type State = { error: string | null; ok?: boolean; id?: string };
const str = (v: FormDataEntryValue | null) => String(v ?? "").trim();

async function tellOffice(branchId: string, title: string, body: string, ticketId: string) {
  await notifyUsers({ userIds: await approverIds("partners", branchId), kind: "SUPPLIER_TICKET", title, body, href: `/suppliers/tickets/${ticketId}` });
}

/** A supplier sends feedback or a complaint. */
export async function createTicketAction(_prev: State, formData: FormData): Promise<State> {
  assertContactsValid(formData);
  const vendor = await getVendor();
  if (!vendor) return { error: "Please sign in again." };
  const kind = str(formData.get("kind")) === "COMPLAINT" ? "COMPLAINT" : "FEEDBACK";
  const subject = str(formData.get("subject"));
  const message = str(formData.get("message"));
  if (!subject) return { error: "Add a short subject." };
  if (subject.length > 120) return { error: "Keep the subject under 120 characters." };
  if (!message) return { error: `Tell us what you'd like to say.` };
  if (message.length > 4000) return { error: "That message is too long. Please keep it under 4,000 characters." };
  // A guard against a runaway script or an accidental loop, not a limit real use would meet.
  const recent = await prisma.supplierTicket.count({ where: { supplierId: vendor.id, createdAt: { gte: new Date(Date.now() - 86_400_000) } } });
  if (recent >= 20) return { error: "You've sent a lot of messages today. Please wait, or call us." };

  const ticket = await prisma.supplierTicket.create({
    data: { supplierId: vendor.id, branchId: vendor.branchId, kind, subject, messages: { create: { fromSupplier: true, authorName: vendor.contactPerson || vendor.name, body: message } } },
  });
  await tellOffice(vendor.branchId, `${kind === "COMPLAINT" ? "Complaint" : "Feedback"} from ${vendor.name}`, subject, ticket.id);
  revalidatePath("/vendor/support");
  return { error: null, ok: true, id: ticket.id };
}

/** Add a message to one of the supplier's own tickets. */
export async function replyTicketAction(_prev: State, formData: FormData): Promise<State> {
  assertContactsValid(formData);
  const vendor = await getVendor();
  if (!vendor) return { error: "Please sign in again." };
  const ticket = await prisma.supplierTicket.findFirst({ where: { id: str(formData.get("ticketId")), supplierId: vendor.id } });
  if (!ticket) return { error: "That message wasn't found." };
  if (ticket.status === "CLOSED") return { error: "This conversation is closed. Start a new message if you need more help." };
  const body = str(formData.get("body"));
  if (!body) return { error: "Write your reply first." };
  if (body.length > 4000) return { error: "That reply is too long. Please keep it under 4,000 characters." };

  await prisma.$transaction([
    prisma.supplierTicketMessage.create({ data: { ticketId: ticket.id, fromSupplier: true, authorName: vendor.contactPerson || vendor.name, body } }),
    prisma.supplierTicket.update({ where: { id: ticket.id }, data: { status: "OPEN" } }),
  ]);
  await tellOffice(vendor.branchId, `Reply from ${vendor.name}`, ticket.subject, ticket.id);
  revalidatePath(`/vendor/support/${ticket.id}`);
  revalidatePath("/vendor/support");
  return { error: null, ok: true };
}
