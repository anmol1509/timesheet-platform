import { PageHeader } from "@/components/PageHeader";
import { Wallet } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { can } from "@/lib/permissions";
import { budgetStatus, pettyCashBalance } from "@/lib/financeRules";
import { ExpenseTools, type BudgetRow } from "../expense-tools";

export const metadata = { title: "Budgets & petty cash" };

export default async function ExpenseBudgetsPage() {
  const { user, branchId } = await requireUserWithBranch();
  const subject = subjectOf(user);
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const [budgets, monthApproved, branch, topUps, cashSpent] = await Promise.all([
    prisma.expenseBudget.findMany({ where: branchWhere(branchId), orderBy: { category: "asc" } }),
    prisma.expense.findMany({ where: { ...branchWhere(branchId), status: "APPROVED", date: { gte: monthStart } }, select: { category: true, amount: true, vatAmount: true } }),
    branchId ? prisma.branch.findUnique({ where: { id: branchId }, select: { expenseApprovalLimit: true } }) : null,
    prisma.pettyCashTopUp.findMany({ where: branchWhere(branchId), select: { amount: true } }),
    prisma.expense.findMany({ where: { ...branchWhere(branchId), status: "APPROVED", paymentMethod: "CASH" }, select: { amount: true, vatAmount: true } }),
  ]);
  const spentByCategory = new Map<string, number>();
  for (const e of monthApproved) spentByCategory.set(e.category, (spentByCategory.get(e.category) ?? 0) + Number(e.amount) + Number(e.vatAmount));
  const budgetRows: BudgetRow[] = budgets.map((b) => {
    const spent = spentByCategory.get(b.category) ?? 0;
    const st = budgetStatus(spent, Number(b.monthlyLimit));
    return { category: b.category, limit: Number(b.monthlyLimit), spent, pct: st.pct, state: st.state };
  });
  const toppedUp = topUps.reduce((sum, t) => sum + Number(t.amount), 0);
  const spentList = cashSpent.map((e) => Number(e.amount) + Number(e.vatAmount));
  return (
    <div className="space-y-5">
      <PageHeader title="Budgets & petty cash" icon={Wallet} breadcrumbs={[{ label: "Finance", href: "/finance/bills" }, { label: "Expenses", href: "/finance/expenses" }, { label: "Budgets & petty cash" }]} description="Monthly caps by category, the approval limit, and the petty-cash float." />
      <ExpenseTools
        budgets={budgetRows}
        limit={branch?.expenseApprovalLimit ? Number(branch.expenseApprovalLimit) : null}
        petty={{ balance: pettyCashBalance(topUps.map((t) => Number(t.amount)), spentList), toppedUp, spent: spentList.reduce((a, b) => a + b, 0) }}
        canManage={!!branchId && can(subject, "finance.expenses", "approve")}
        canTopUp={!!branchId && can(subject, "finance.expenses", "create")}
      />
    </div>
  );
}
