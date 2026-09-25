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
import { notifySupplier } from "@/lib/vendor/notify";
import { loadSupplierMonthPayable, type SupplierMonthPayable } from "@/lib/supplierMonthPayable";
import { exceedsApprovalLimit, isDuplicateBill, isDuplicateExpense } from "@/lib/financeRules";
import { assertContactsValid } from "@/lib/validators";

type State = { error: string | null; ok?: boolean };
const NEED_BRANCH = "Pick a branch from the switcher first.";
const money = (v: FormDataEntryValue | null) => {
  const n = Number(String(v ?? "").trim() || 0);
  return Number.isFinite(n) ? round2(n) : NaN;
};
const str = (v: FormDataEntryValue | null) => String(v ?? "").trim();

// ---------------------------------------------------------------- expenses
export async function createExpenseAction(_prev: State, formData: FormData): Promise<State> {
  assertContactsValid(formData);
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

  // A re-keyed expense is the commonest finance error; ask before saving it twice.
  if (str(formData.get("allowDuplicate")) !== "1") {
    const near = await prisma.expense.findMany({
      where: { branchId, category, date: { gte: new Date(date.getTime() - 3 * 86_400_000), lte: new Date(date.getTime() + 3 * 86_400_000) } },
      select: { date: true, amount: true, vatAmount: true, category: true, paidTo: true, description: true },
    });
    const candidate = { date, amount, vatAmount, category, paidTo: str(formData.get("paidTo")) || null };
    const dup = near.find((e) => isDuplicateExpense(candidate, { date: e.date, amount: Number(e.amount), vatAmount: Number(e.vatAmount), category: e.category, paidTo: e.paidTo }));
    if (dup) return { error: `DUPLICATE: an expense for the same amount, category and payee was already entered (${dup.description}). Submit again to keep both.` };
  }

  const created = await prisma.expense.create({
    data: {
      date, category, description, amount, vatAmount, projectId, branchId, submittedById: user.id,
      outOfPocket: str(formData.get("outOfPocket")) === "1",
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
    href: "/approvals?type=EXPENSE",
  });
  revalidatePath("/finance/expenses");
  revalidatePath("/finance");
  return { error: null, ok: true };
}

export async function decideExpenseAction(formData: FormData): Promise<State> {
  assertContactsValid(formData);
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
  if (decision === "APPROVED") {
    const rule = await prisma.branch.findUnique({ where: { id: e.branchId }, select: { expenseApprovalLimit: true } });
    const limit = rule?.expenseApprovalLimit ? Number(rule.expenseApprovalLimit) : null;
    const total = Number(e.amount) + Number(e.vatAmount);
    if (exceedsApprovalLimit(total, limit, user.role)) return { error: `AED ${total.toFixed(2)} is over your AED ${limit!.toLocaleString("en-AE")} approval limit. An admin has to approve this one.` };
  }
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
  assertContactsValid(formData);
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
  assertContactsValid(formData);
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
  const periodRaw = str(formData.get("periodMonth"));
  const periodMonth = /^\d{4}-\d{2}$/.test(periodRaw) ? periodRaw : null;
  // Every supplier bill is tied to the month of work it pays for, so it can be checked against that month's timesheet.
  if (!periodMonth) return { error: "Choose the month this bill covers." };
  const sheet = await loadSupplierMonthPayable(supplierId, periodMonth);
  if (str(formData.get("allowDuplicate")) !== "1") {
    const others = await prisma.supplierBill.findMany({ where: { supplierId }, select: { billNo: true, billDate: true, amount: true, vatAmount: true } });
    const dup = others.find((o) => isDuplicateBill({ billNo, billDate, amount, vatAmount }, { billNo: o.billNo, billDate: o.billDate, amount: Number(o.amount), vatAmount: Number(o.vatAmount) }));
    if (dup) return { error: `DUPLICATE: ${supplier.name} already has bill #${dup.billNo} for the same total around the same date. Submit again if this is a different bill.` };
  }
  try {
    const created = await prisma.supplierBill.create({
      data: { supplierId, billNo, billDate, dueDate, amount, vatAmount, periodMonth, timesheetAmount: sheet.entryCount > 0 ? sheet.net : null, timesheetHours: sheet.entryCount > 0 ? sheet.hours : null, approvalStatus: "PENDING", description: str(formData.get("description")) || null, branchId },
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
  assertContactsValid(formData);
  await requirePermission("finance", "edit");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const billId = str(formData.get("billId"));
  const paidOn = parseDay(str(formData.get("paidOn")));
  const amount = money(formData.get("amount"));
  if (!paidOn) return { error: "Enter the payment date." };
  if (!(amount > 0)) return { error: "Enter the amount paid." };
  const bill = await prisma.supplierBill.findUnique({ where: { id: billId }, include: { payments: { select: { amount: true } } } });
  if (!bill || isOutsideBranch(bill.branchId, branchId, isSuperAdmin)) return { error: "Bill not found." };
  if (bill.approvalStatus !== "APPROVED") return { error: "Approve the bill before paying it." };
  const t = billTotals({ amount: Number(bill.amount), vatAmount: Number(bill.vatAmount) }, bill.payments.map((p) => ({ amount: Number(p.amount) })));
  if (amount > t.balance + 0.005) return { error: `That's more than the outstanding balance (AED ${t.balance.toFixed(2)}).` };
  const created = await prisma.billPayment.create({
    data: { billId, paidOn, amount, method: str(formData.get("method")) || null, reference: str(formData.get("reference")) || null, createdById: user.id },
  });
  await logAudit({ entityType: "BILL_PAYMENT", entityId: created.id, action: "CREATE", after: { billNo: bill.billNo, amount, paidOn: paidOn.toISOString().slice(0, 10) }, userId: user.id, userName: user.name, branchId: bill.branchId });
  await notifySupplier({ supplierId: bill.supplierId, kind: "PAYMENT", title: `Payment recorded: AED ${amount.toLocaleString("en-AE", { minimumFractionDigits: 2 })}`, body: `Against invoice ${bill.billNo}.`, href: "/vendor/payments" });
  revalidatePath("/finance/bills");
  revalidatePath("/finance");
  return { error: null, ok: true };
}

export async function deleteBillAction(formData: FormData): Promise<State> {
  assertContactsValid(formData);
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

// ------------------------------------------------------- expense extras
export async function markReimbursedAction(formData: FormData): Promise<State> {
  assertContactsValid(formData);
  const user = await requirePermission("finance", "approve");
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const e = await prisma.expense.findUnique({ where: { id: str(formData.get("id")) } });
  if (!e || isOutsideBranch(e.branchId, branchId, isSuperAdmin)) return { error: "Expense not found." };
  if (!e.outOfPocket) return { error: "This expense wasn't paid out of pocket." };
  if (e.status !== "APPROVED") return { error: "Approve the expense before reimbursing it." };
  if (e.reimbursedAt) return { error: "Already reimbursed." };
  await prisma.expense.update({ where: { id: e.id }, data: { reimbursedAt: new Date() } });
  await logAudit({ entityType: "EXPENSE", entityId: e.id, action: "UPDATE", before: { reimbursed: false }, after: { reimbursed: true }, userId: user.id, userName: user.name, branchId: e.branchId });
  revalidatePath("/finance/expenses");
  return { error: null, ok: true };
}

export async function setExpenseLimitAction(_prev: State, formData: FormData): Promise<State> {
  assertContactsValid(formData);
  const user = await requirePermission("finance", "approve");
  const { branchId } = await requireUserWithBranch();
  if (!branchId) return { error: NEED_BRANCH };
  if (user.role === "STAFF") return { error: "Only an admin can change the approval limit." };
  const raw = str(formData.get("limit"));
  const value = raw === "" ? null : money(raw);
  if (value !== null && (!Number.isFinite(value) || value < 0)) return { error: "Enter an amount, or leave blank for no limit." };
  const before = await prisma.branch.findUnique({ where: { id: branchId }, select: { expenseApprovalLimit: true } });
  await prisma.branch.update({ where: { id: branchId }, data: { expenseApprovalLimit: value } });
  await logAudit({ entityType: "BRANCH", entityId: branchId, action: "UPDATE", before: { expenseApprovalLimit: before?.expenseApprovalLimit ? Number(before.expenseApprovalLimit) : null }, after: { expenseApprovalLimit: value }, userId: user.id, userName: user.name, branchId });
  revalidatePath("/finance/expenses");
  return { error: null, ok: true };
}

export async function saveBudgetAction(_prev: State, formData: FormData): Promise<State> {
  assertContactsValid(formData);
  const user = await requirePermission("finance", "approve");
  const { branchId } = await requireUserWithBranch();
  if (!branchId) return { error: NEED_BRANCH };
  const category = str(formData.get("category"));
  const raw = str(formData.get("monthlyLimit"));
  if (!category) return { error: "Choose a category." };
  if (raw === "") {
    await prisma.expenseBudget.deleteMany({ where: { branchId, category } });
    await logAudit({ entityType: "EXPENSE_BUDGET", entityId: category, action: "DELETE", before: { category }, userId: user.id, userName: user.name, branchId });
  } else {
    const monthlyLimit = money(raw);
    if (!(monthlyLimit > 0)) return { error: "Enter a monthly limit above zero, or clear it to remove the budget." };
    await prisma.expenseBudget.upsert({ where: { branchId_category: { branchId, category } }, create: { branchId, category, monthlyLimit }, update: { monthlyLimit } });
    await logAudit({ entityType: "EXPENSE_BUDGET", entityId: category, action: "UPDATE", after: { category, monthlyLimit }, userId: user.id, userName: user.name, branchId });
  }
  revalidatePath("/finance/expenses");
  revalidatePath("/finance");
  return { error: null, ok: true };
}

export async function addPettyCashTopUpAction(_prev: State, formData: FormData): Promise<State> {
  assertContactsValid(formData);
  const user = await requirePermission("finance", "create");
  const { branchId } = await requireUserWithBranch();
  if (!branchId) return { error: NEED_BRANCH };
  const amount = money(formData.get("amount"));
  const date = parseDay(str(formData.get("date")));
  if (!(amount > 0)) return { error: "Enter the amount put into the float." };
  if (!date) return { error: "Enter the date." };
  const created = await prisma.pettyCashTopUp.create({ data: { amount, date, note: str(formData.get("note")) || null, branchId, createdById: user.id } });
  await logAudit({ entityType: "PETTY_CASH", entityId: created.id, action: "CREATE", after: { amount, date: date.toISOString().slice(0, 10) }, userId: user.id, userName: user.name, branchId });
  revalidatePath("/finance/expenses");
  revalidatePath("/finance");
  return { error: null, ok: true };
}

// --------------------------------------------------------- bill extras
export async function decideBillAction(formData: FormData): Promise<State> {
  assertContactsValid(formData);
  const user = await requirePermission("finance", "approve");
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const decision = str(formData.get("decision"));
  const note = str(formData.get("note")) || null;
  if (decision !== "APPROVED" && decision !== "REJECTED") return { error: "Invalid decision." };
  const bill = await prisma.supplierBill.findUnique({ where: { id: str(formData.get("id")) }, include: { supplier: { select: { name: true } } } });
  if (!bill || isOutsideBranch(bill.branchId, branchId, isSuperAdmin)) return { error: "Bill not found." };
  if (bill.approvalStatus !== "PENDING") return { error: `Already ${bill.approvalStatus.toLowerCase()}.` };
  if (decision === "REJECTED" && !note) return { error: "Say why it's being rejected." };
  await prisma.supplierBill.update({ where: { id: bill.id }, data: { approvalStatus: decision, approvalNote: note, approvedAt: new Date(), approvedById: user.id } });
  await logAudit({ entityType: "SUPPLIER_BILL", entityId: bill.id, action: "UPDATE", before: { approvalStatus: "PENDING" }, after: { approvalStatus: decision, note, supplier: bill.supplier.name, billNo: bill.billNo }, userId: user.id, userName: user.name, branchId: bill.branchId });
  await notifySupplier({ supplierId: bill.supplierId, kind: "INVOICE_DECISION", title: decision === "APPROVED" ? `Invoice ${bill.billNo} approved` : `Invoice ${bill.billNo} needs a correction`, body: decision === "APPROVED" ? "It's approved for payment." : note, href: "/vendor/payments" });
  revalidatePath("/finance/bills");
  revalidatePath("/finance");
  return { error: null, ok: true };
}

/** A credit note or discount: settles part of a bill without any cash leaving. */
export async function applyCreditAction(_prev: State, formData: FormData): Promise<State> {
  assertContactsValid(formData);
  await requirePermission("finance", "edit");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const billId = str(formData.get("billId"));
  const amount = money(formData.get("amount"));
  const reason = str(formData.get("reason"));
  if (!(amount > 0)) return { error: "Enter the credit amount." };
  if (!reason) return { error: "Say what the credit is for (e.g. credit note number)." };
  const bill = await prisma.supplierBill.findUnique({ where: { id: billId }, include: { payments: { select: { amount: true } } } });
  if (!bill || isOutsideBranch(bill.branchId, branchId, isSuperAdmin)) return { error: "Bill not found." };
  const t = billTotals({ amount: Number(bill.amount), vatAmount: Number(bill.vatAmount) }, bill.payments.map((p) => ({ amount: Number(p.amount) })));
  if (amount > t.balance + 0.005) return { error: `That's more than the outstanding balance (AED ${t.balance.toFixed(2)}).` };
  const created = await prisma.billPayment.create({ data: { billId, paidOn: new Date(), amount, method: "CREDIT", reference: reason, createdById: user.id } });
  await logAudit({ entityType: "BILL_PAYMENT", entityId: created.id, action: "CREATE", after: { billNo: bill.billNo, credit: amount, reason }, userId: user.id, userName: user.name, branchId: bill.branchId });
  revalidatePath("/finance/bills");
  revalidatePath("/finance");
  return { error: null, ok: true };
}

/** Pay several approved bills in full with one date, method and reference. */
export async function payBatchAction(_prev: State, formData: FormData): Promise<State> {
  assertContactsValid(formData);
  await requirePermission("finance", "edit");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const ids = formData.getAll("billId").map(String).filter(Boolean);
  const paidOn = parseDay(str(formData.get("paidOn")));
  if (ids.length === 0) return { error: "Select at least one bill." };
  if (!paidOn) return { error: "Enter the payment date." };
  const bills = await prisma.supplierBill.findMany({ where: { id: { in: ids } }, include: { payments: { select: { amount: true } }, supplier: { select: { name: true } } } });
  if (bills.length !== ids.length || bills.some((b) => isOutsideBranch(b.branchId, branchId, isSuperAdmin))) return { error: "One of those bills wasn't found." };
  const notApproved = bills.filter((b) => b.approvalStatus !== "APPROVED");
  if (notApproved.length > 0) return { error: `Approve ${notApproved.map((b) => `#${b.billNo}`).slice(0, 3).join(", ")} before paying.` };
  const method = str(formData.get("method")) || null;
  const reference = str(formData.get("reference")) || null;
  let total = 0;
  const data = bills.flatMap((b) => {
    const t = billTotals({ amount: Number(b.amount), vatAmount: Number(b.vatAmount) }, b.payments.map((p) => ({ amount: Number(p.amount) })));
    if (t.balance <= 0) return [];
    total += t.balance;
    return [{ billId: b.id, paidOn, amount: t.balance, method, reference, createdById: user.id }];
  });
  if (data.length === 0) return { error: "Those bills are already settled." };
  await prisma.billPayment.createMany({ data });
  for (const d of data) {
    const b = bills.find((x) => x.id === d.billId)!;
    await notifySupplier({ supplierId: b.supplierId, kind: "PAYMENT", title: `Payment recorded: AED ${d.amount.toLocaleString("en-AE", { minimumFractionDigits: 2 })}`, body: `Against invoice ${b.billNo}.`, href: "/vendor/payments" });
  }
  await logAudit({ entityType: "BILL_PAYMENT", entityId: data[0].billId, action: "CREATE", after: { batch: data.length, total: money(String(total)), reference, bills: bills.map((b) => `${b.supplier.name} #${b.billNo}`).slice(0, 10) }, userId: user.id, userName: user.name, branchId });
  revalidatePath("/finance/bills");
  revalidatePath("/finance");
  return { error: null, ok: true };
}

/** What the timesheet says we owe a supplier for a month, for the bill form to show before the bill is saved. */
export async function previewSupplierMonthAction(supplierId: string, month: string): Promise<{ error: string | null; sheet?: SupplierMonthPayable }> {
  await requirePermission("finance", "create");
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  if (!/^\d{4}-\d{2}$/.test(month)) return { error: "Choose the month." };
  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId }, select: { branchId: true } });
  if (!supplier || isOutsideBranch(supplier.branchId, branchId, isSuperAdmin)) return { error: "Supplier not found." };
  return { error: null, sheet: await loadSupplierMonthPayable(supplierId, month) };
}
