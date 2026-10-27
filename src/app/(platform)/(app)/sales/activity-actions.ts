"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, requireWrite } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { logAudit } from "@/lib/audit";
import { logSalesActivity } from "@/lib/salesActivity";

type Target = { entity: "quotation" | "enquiry"; id: string };
type Result = { error?: string };

/** Loads the record and checks the caller may change it. */
async function load(t: Target) {
  await requireWrite(t.entity === "quotation" ? "sales.quotations" : "sales.enquiries");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const row =
    t.entity === "quotation"
      ? await prisma.quotation.findUnique({ where: { id: t.id }, select: { branchId: true, status: true } })
      : await prisma.enquiry.findUnique({ where: { id: t.id }, select: { branchId: true, status: true } });
  if (!row || isOutsideBranch(row.branchId, branchId, isSuperAdmin)) return null;
  return { user, branchId, status: row.status };
}

const ids = (t: Target) => (t.entity === "quotation" ? { quotationId: t.id } : { enquiryId: t.id });
const refresh = (t: Target) => {
  revalidatePath("/sales");
  revalidatePath(t.entity === "quotation" ? `/sales/quotations/${t.id}` : "/sales/enquiries");
};

/** A note or a logged call on the activity trail. */
export async function addSalesNoteAction(t: Target, kind: "NOTE" | "CALL", body: string): Promise<Result> {
  const ctx = await load(t);
  if (!ctx) return { error: "You can't change that record." };
  const text = body.trim();
  if (!text) return { error: "Write something first." };
  await logSalesActivity({ ...ids(t), kind, body: text, user: ctx.user, branchId: ctx.branchId });
  refresh(t);
  return {};
}

/** Sets or clears the next follow-up date (yyyy-mm-dd). */
export async function setFollowUpAction(t: Target, date: string | null, why?: string): Promise<Result> {
  const ctx = await load(t);
  if (!ctx) return { error: "You can't change that record." };
  const when = date ? new Date(`${date}T09:00:00`) : null;
  if (when && Number.isNaN(when.getTime())) return { error: "That date isn't valid." };
  if (t.entity === "quotation") await prisma.quotation.update({ where: { id: t.id }, data: { nextFollowUpAt: when } });
  else await prisma.enquiry.update({ where: { id: t.id }, data: { nextFollowUpAt: when } });
  await logSalesActivity({
    ...ids(t),
    kind: "FOLLOWUP",
    body: when ? `Follow-up set for ${when.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}${why ? `: ${why}` : ""}` : "Follow-up cleared",
    user: ctx.user,
    branchId: ctx.branchId,
  });
  refresh(t);
  return {};
}

/** Closes a deal as lost, with the reason. A quotation moves to Rejected, an enquiry to Lost. */
export async function markLostAction(t: Target, reason: string): Promise<Result> {
  const ctx = await load(t);
  if (!ctx) return { error: "You can't change that record." };
  const why = reason.trim();
  if (!why) return { error: "Say why it was lost. It helps next time." };
  if (t.entity === "quotation") {
    if (!["DRAFT", "SENT", "NEGOTIATION", "APPROVED"].includes(ctx.status)) return { error: "This quotation can't be marked lost any more." };
    await prisma.quotation.update({ where: { id: t.id }, data: { status: "REJECTED", lostReason: why, nextFollowUpAt: null } });
  } else {
    if (ctx.status === "Converted") return { error: "This enquiry already became a quotation that was won." };
    await prisma.enquiry.update({ where: { id: t.id }, data: { status: "Lost", lostReason: why, nextFollowUpAt: null } });
  }
  await logSalesActivity({ ...ids(t), kind: "LOST", body: `Lost: ${why}`, user: ctx.user, branchId: ctx.branchId });
  await logAudit({ entityType: t.entity === "quotation" ? "QUOTATION" : "ENQUIRY", entityId: t.id, action: "UPDATE", before: { status: ctx.status }, after: { lostReason: why }, userId: ctx.user.id, userName: ctx.user.name, branchId: ctx.branchId });
  refresh(t);
  return {};
}
