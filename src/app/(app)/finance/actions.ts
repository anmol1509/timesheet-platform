"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, requirePermission } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { logAudit } from "@/lib/audit";
import { approverIds, notifyUsers } from "@/lib/notifications/notify";
import { parseDay } from "@/lib/dates";
import { round2 } from "@/lib/payroll";
import { billTotals } from "@/lib/payables";

type State = { error: string | null; ok?: boolean };
const NEED_BRANCH = "Pick a branch from the switcher first.";
const money = (v: FormDataEntryValue | null) => {
  const n = Number(String(v ?? "").trim() || 0);
  return Number.isFinite(n) ? round2(n) : NaN;
};
const str = (v: FormDataEntryValue | null) => String(v ?? "").trim();

// ---------------------------------------------------------------- expenses
export async function createExpenseAction(_prev: State, formData: FormData): Promise<State> {
  await requirePermission("finance", "create");
  const { user, branchId } = await requireUserWithBranch();
  if (!branchId) return { error: NEED_BRANCH };
  const date = parseDay(str(formData.get("date")));
  const category = str(formData.get("category"));
  const description = str(formData.get("description"));
  const amount = money(formData.get("amount"));
  const vatAmount = money(formData.get("vatAmount"));
  if (!date) return { error: "Enter the expense date." };
  if (!category || !description) return { error: "Choose a category and describe the expense." };
  if (!(amount > 0) || Number.isNaN(vatAmount) || vatAmount < 0) return { error: "Enter a valid amount." };
  const projectId = str(formData.get("projectId")) || null;
  if (projectId) {
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { branchId: true } });
    if (!project || project.branchId !== branchId) return { error: "That project isn't in this branch." };
  }

  const created = await prisma.expense.create({
    data: {
      date, category, description, amount, vatAmount, projectId, branchId, submittedById: user.id,
      paidTo: str(formData.get("paidTo")) || null,
      paymentMethod: str(formData.get("paymentMethod")) || null,
      reference: str(formData.get("reference")) || null,
    },
  });
  await logAudit({ entityType: "EXPENSE", entityId: created.id, action: "CREATE", after: { category, amount, vatAmount, description }, userId: user.id, userName: user.name, branchId });
  await notifyUsers({
    userIds: (await approverIds("finance", branchId)).filter((id) => id !== user.id),
    kind: "EXPENSE_SUBMITTED",
    title: `Expense to approve: AED ${(amount + vatAmount).toFixed(2)}`,
    body: `${category} — ${description} (by ${user.name}).`,
    href: "/finance/expenses?status=PENDING",
  });
  revalidatePath("/finance/expenses");
  revalidatePath("/finance");
  return { error: null, ok: true };
}

export async function decideExpenseAction(formData: FormData): Promise<State> {
  const user = await requirePermission("finance", "approve");
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = str(formData.get("id"));
  const decision = str(formData.get("decision"));
  const note = str(formData.get("note")) || null;
  if (decision !== "APPROVED" && decision !== "REJECTED") return { error: "Invalid decision." };
  const e = await prisma.expense.findUnique({ where: { id } });
  if (!e || isOutsideBranch(e.branchId, branchId, isSuperAdmin)) return { error: "Expense not found." };
  if (e.status !== "PENDING") return { error: `Already ${e.status.toLowerCase()}.` };
  if (e.submittedById === user.id && user.role === "STAFF") return { error: "You can't approve your own expense." };
  await prisma.expense.update({ where: { id }, data: { status: decision, decisionNote: note, decidedById: user.id, decidedAt: new Date() } });
  await logAudit({ entityType: "EXPENSE", entityId: id, action: "UPDATE", before: { status: "PENDING" }, after: { status: decision, note }, userId: user.id, userName: user.name, branchId: e.branchId });
  await notifyUsers({
    userIds: [e.submittedById].filter((x) => x !== user.id),
    kind: "EXPENSE_DECIDED",
    title: `Expense ${decision === "APPROVED" ? "approved" : "rejected"}: AED ${(Number(e.amount) + Number(e.vatAmount)).toFixed(2)}`,
    body: `${e.category} — ${e.description}.${note ? ` Note: ${note}` : ""}`,
    href: "/finance/expenses",
  });
  revalidatePath("/finance/expenses");
  revalidatePath("/finance");
  return { error: null, ok: true };
}

export async function deleteExpenseAction(formData: FormData): Promise<State> {
  const user = await requirePermission("finance", "delete");
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = str(formData.get("id"));
  const e = await prisma.expense.findUnique({ where: { id } });
  if (!e || isOutsideBranch(e.branchId, branchId, isSuperAdmin)) return { error: "Expense not found." };
  if (e.status === "APPROVED") return { error: "Approved expenses can't be deleted." };
  await prisma.expense.delete({ where: { id } });
  await logAudit({ entityType: "EXPENSE", entityId: id, action: "DELETE", before: { category: e.category, amount: Number(e.amount), description: e.description }, userId: user.id, userName: user.name, branchId: e.branchId });
  revalidatePath("/finance/expenses");
  revalidatePath("/finance");
  return { error: null, ok: true };
}

// ------------------------------------------------------------------- bills
export async function createBillAction(_prev: State, formData: FormData): Promise<State> {
  await requirePermission("finance", "create");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  if (!branchId) return { error: NEED_BRANCH };
  const supplierId = str(formData.get("supplierId"));
  const billNo = str(formData.get("billNo"));
  const billDate = parseDay(str(formData.get("billDate")));
  const dueDate = parseDay(str(formData.get("dueDate")));
  const amount = money(formData.get("amount"));
  const vatAmount = money(formData.get("vatAmount"));
  if (!supplierId || !billNo) return { error: "Choose a supplier and enter the bill number." };
  if (!billDate || !dueDate) return { error: "Enter the bill and due dates." };
  if (dueDate < billDate) return { error: "The due date is before the bill date." };
  if (!(amount > 0) || Number.isNaN(vatAmount) || vatAmount < 0) return { error: "Enter a valid amount." };
  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId }, select: { branchId: true, name: true } });
  if (!supplier || isOutsideBranch(supplier.branchId, branchId, isSuperAdmin)) return { error: "Supplier not found." };
  try {
    const created = await prisma.supplierBill.create({
      data: { supplierId, billNo, billDate, dueDate, amount, vatAmount, description: str(formData.get("description")) || null, branchId },
    });
    await logAudit({ entityType: "SUPPLIER_BILL", entityId: created.id, action: "CREATE", after: { supplier: supplier.name, billNo, amount, vatAmount }, userId: user.id, userName: user.name, branchId });
  } catch {
    return { error: `${supplier.name} already has a bill numbered ${billNo}.` };
  }
  revalidatePath("/finance/bills");
  revalidatePath("/finance");
  return { error: null, ok: true };
}

export async function recordPaymentAction(_prev: State, formData: FormData): Promise<State> {
  await requirePermission("finance", "edit");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const billId = str(formData.get("billId"));
  const paidOn = parseDay(str(formData.get("paidOn")));
  const amount = money(formData.get("amount"));
  if (!paidOn) return { error: "Enter the payment date." };
  if (!(amount > 0)) return { error: "Enter the amount paid." };
  const bill = await prisma.supplierBill.findUnique({ where: { id: billId }, include: { payments: { select: { amount: true } } } });
  if (!bill || isOutsideBranch(bill.branchId, branchId, isSuperAdmin)) return { error: "Bill not found." };
  const t = billTotals({ amount: Number(bill.amount), vatAmount: Number(bill.vatAmount) }, bill.payments.map((p) => ({ amount: Number(p.amount) })));
  if (amount > t.balance + 0.005) return { error: `That's more than the outstanding balance (AED ${t.balance.toFixed(2)}).` };
  const created = await prisma.billPayment.create({
    data: { billId, paidOn, amount, method: str(formData.get("method")) || null, reference: str(formData.get("reference")) || null, createdById: user.id },
  });
  await logAudit({ entityType: "BILL_PAYMENT", entityId: created.id, action: "CREATE", after: { billNo: bill.billNo, amount, paidOn: paidOn.toISOString().slice(0, 10) }, userId: user.id, userName: user.name, branchId: bill.branchId });
  revalidatePath("/finance/bills");
  revalidatePath("/finance");
  return { error: null, ok: true };
}

export async function deleteBillAction(formData: FormData): Promise<State> {
  const user = await requirePermission("finance", "delete");
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = str(formData.get("id"));
  const bill = await prisma.supplierBill.findUnique({ where: { id }, include: { _count: { select: { payments: true } } } });
  if (!bill || isOutsideBranch(bill.branchId, branchId, isSuperAdmin)) return { error: "Bill not found." };
  if (bill._count.payments > 0) return { error: "This bill has payments recorded, so it can't be deleted." };
  await prisma.supplierBill.delete({ where: { id } });
  await logAudit({ entityType: "SUPPLIER_BILL", entityId: id, action: "DELETE", before: { billNo: bill.billNo, amount: Number(bill.amount) }, userId: user.id, userName: user.name, branchId: bill.branchId });
  revalidatePath("/finance/bills");
  revalidatePath("/finance");
  return { error: null, ok: true };
}
