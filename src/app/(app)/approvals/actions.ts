"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { allowedKinds, type ApprovalKind } from "@/lib/approvals";
import { decideExpenseAction, decideBillAction } from "../finance/actions";
import { approveRunAction, returnRunAction } from "../payroll/actions";
import { approveWorkerAction, rejectWorkerAction, approveChangeAction, rejectChangeAction } from "../suppliers/requests/actions";
import { updateSupplierApprovalAction } from "../suppliers/actions";
import { setTradeApprovalAction } from "../demand/actions";
import { approveTimesheetAction, rejectTimesheetAction } from "../invoices/client-timesheet/actions";
import { reviewCorrectionRequestAction } from "../attendance/actions";
import { sendEmail } from "@/lib/notifications/email";

type State = { error: string | null; ok?: boolean };
type Input = { kind: ApprovalKind; id: string; ids?: string[]; field?: string; decision: "APPROVE" | "REJECT"; note?: string };

const fd = (fields: Record<string, string>, many?: Record<string, string[]>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  for (const [k, list] of Object.entries(many ?? {})) for (const v of list) f.append(k, v);
  return f;
};

/**
 * True for an approver whose decision is final. Staff approvals stay internal;
 * an admin's — super or branch — is the last word, and a client's branch admin
 * is the top of their own company, so they must reach their own customers too.
 */
function isFinalApprover(role: string) {
  return role === "SUPER_ADMIN" || role === "BRANCH_ADMIN";
}

/**
 * Emails the client on an approval an admin just made — a client-facing
 * confirmation, not the internal staff notification `notifyUsers` already
 * sends. Only a final approver's decision should reach the client's inbox (see
 * isFinalApprover); a staff approval is still an internal step. Best-effort —
 * a failed send must never fail the approval itself.
 */
async function notifyClientOfApproval(to: string | null, clientName: string, subject: string, body: string) {
  if (!to) return;
  try {
    await sendEmail(to, subject, `Hi ${clientName} team,\n\n${body}`);
  } catch (e) {
    console.error("[approvals] client notification email failed:", e instanceof Error ? e.message : e);
  }
}

/**
 * Decides one item from the Approvals inbox. It does no deciding of its own:
 * it checks that this person may decide this kind, then hands over to the same
 * server action the module's own screen uses, so every rule (approval limits,
 * four-eyes payroll, bank checks, status transitions) applies exactly as before.
 */
export async function decideApprovalAction(input: Input): Promise<State> {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  if (!allowedKinds(subjectOf(user)).includes(input.kind)) return { error: "You don't have permission to decide this kind of request." };
  const approve = input.decision === "APPROVE";
  const note = (input.note ?? "").trim();
  const decision = approve ? "APPROVED" : "REJECTED";
  let result: State | void = undefined;

  switch (input.kind) {
    case "EXPENSE":
      result = await decideExpenseAction(fd({ id: input.id, decision, note }));
      break;
    case "BILL":
      result = await decideBillAction(fd({ id: input.id, decision, note }));
      break;
    case "PAYROLL":
      result = approve ? await approveRunAction(fd({ id: input.id })) : await returnRunAction(fd({ id: input.id, note }));
      break;
    case "WORKER":
      result = approve ? await approveWorkerAction(fd({ id: input.id })) : await rejectWorkerAction(fd({ id: input.id, note }));
      break;
    case "CHANGE":
      result = approve ? await approveChangeAction(fd({ id: input.id })) : await rejectChangeAction(fd({ id: input.id, note }));
      break;
    case "SUPPLIER": {
      const field = input.field ?? "";
      const value = approve ? "Approved" : "Rejected";
      await updateSupplierApprovalAction(fd({ supplierId: input.id, field, value }));
      // That action returns nothing on a refusal, so confirm the change actually happened.
      const s = await prisma.supplier.findUnique({ where: { id: input.id } });
      if (!s || isOutsideBranch(s.branchId, branchId, isSuperAdmin) || (s as unknown as Record<string, string>)[field] !== value) return { error: "That couldn't be saved. Check you can approve suppliers and try again." };
      break;
    }
    case "DEMAND": {
      const trades = await prisma.demandRequestTrade.findMany({ where: { id: { in: input.ids ?? [] } }, select: { id: true, quantity: true, trade: true, demandRequestId: true } });
      if (trades.length === 0) return { error: "Nothing left to approve on that request." };
      for (const t of trades) {
        const r = await setTradeApprovalAction(fd({ tradeId: t.id, approvedQuantity: approve ? String(t.quantity) : "0" }));
        if (r && "error" in r && r.error) return { error: `${t.trade}: ${r.error}` };
      }
      if (approve && isFinalApprover(user.role)) {
        const demandRequestId = trades[0].demandRequestId;
        const dr = await prisma.demandRequest.findUnique({
          where: { id: demandRequestId },
          select: { requestNo: true, client: { select: { name: true, contactEmail: true } } },
        });
        if (dr) {
          const tradeList = trades.map((t) => `${t.trade} × ${t.quantity}`).join(", ");
          await notifyClientOfApproval(
            dr.client.contactEmail,
            dr.client.name,
            `Demand request #${dr.requestNo} approved`,
            `Your demand request #${dr.requestNo} has been approved: ${tradeList}.`
          );
        }
      }
      break;
    }
    case "TIMESHEET": {
      const ids = input.ids ?? [];
      if (ids.length === 0) return { error: "No timesheet rows selected." };
      const r = approve ? await approveTimesheetAction(fd({}, { entryId: ids })) : await rejectTimesheetAction(fd({}, { entryId: ids }));
      if (r && r.updated < r.requested) return { error: `${r.updated} of ${r.requested} rows could be updated; the rest are in a status that can't move that way.` };
      if (approve && isFinalApprover(user.role)) {
        const entries = await prisma.timesheetEntry.findMany({
          where: { id: { in: ids }, clientId: { not: null } },
          select: { clientId: true, client: { select: { name: true, contactEmail: true } } },
          distinct: ["clientId"],
        });
        for (const e of entries) {
          if (!e.client) continue;
          await notifyClientOfApproval(
            e.client.contactEmail,
            e.client.name,
            "Timesheet approved",
            `Your team's timesheet entries have been approved.`
          );
        }
      }
      break;
    }
    case "CORRECTION": {
      await reviewCorrectionRequestAction(fd({ correctionId: input.id, decision }));
      const c = await prisma.attendanceCorrectionRequest.findUnique({ where: { id: input.id }, select: { status: true } });
      if (!c || c.status === "PENDING") return { error: "That couldn't be saved. It may already have been decided." };
      break;
    }
  }
  if (result && result.error) return { error: result.error };
  revalidatePath("/approvals");
  return { error: null, ok: true };
}
