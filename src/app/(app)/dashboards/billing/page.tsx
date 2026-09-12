import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { DashboardTabs } from "@/components/DashboardTabs";
import { StatTile } from "@/components/StatTile";
import { Panel } from "@/components/DashboardPanel";
import { Badge } from "@/components/Badge";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { Receipt, AlertTriangle, Wallet, CheckCircle2 } from "lucide-react";

const STATUS_COLOR: Record<string, "slate" | "amber" | "green" | "red"> = {
  DRAFT: "slate",
  SENT: "amber",
  PAID: "green",
  OVERDUE: "red",
};

export default async function BillingDashboardPage() {
  const { branchId } = await requireUserWithBranch();
  const branchScope = branchWhere(branchId);

  const [statusBreakdown, outstanding, overdueInvoices] = await Promise.all([
    prisma.clientInvoice.groupBy({ by: ["status"], where: branchScope, _count: { _all: true }, _sum: { totalAmount: true } }),
    prisma.clientInvoice.aggregate({ where: { ...branchScope, status: { not: "PAID" } }, _sum: { totalAmount: true } }),
    prisma.clientInvoice.findMany({
      where: { ...branchScope, status: "OVERDUE" },
      select: { id: true, invoiceNumber: true, totalAmount: true, dueDate: true, client: { select: { name: true } } },
      orderBy: { dueDate: "asc" },
      take: 10,
    }),
  ]);

  const totalInvoices = statusBreakdown.reduce((sum, s) => sum + s._count._all, 0);
  const paidCount = statusBreakdown.find((s) => s.status === "PAID")?._count._all ?? 0;
  const overdueCount = statusBreakdown.find((s) => s.status === "OVERDUE")?._count._all ?? 0;

  return (
    <div className="space-y-5">
      <PageHeader title="Dashboard" description="Invoice status and outstanding balances." />
      <DashboardTabs />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile href="/invoices" label="Total Invoices" value={totalInvoices} icon={Receipt} />
        <StatTile href="/invoices" label="Paid" value={paidCount} icon={CheckCircle2} />
        <StatTile href="/invoices" label="Overdue" value={overdueCount} icon={AlertTriangle} tone={overdueCount > 0 ? "warning" : "default"} />
        <StatTile
          href="/invoices"
          label="Outstanding"
          value={`AED ${(outstanding._sum.totalAmount ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          icon={Wallet}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Invoices by status">
          <ul className="space-y-1.5">
            {statusBreakdown.map((row) => (
              <li key={row.status} className="flex items-center justify-between text-sm">
                <Badge color={STATUS_COLOR[row.status] ?? "slate"}>{row.status}</Badge>
                <span className="tabular font-semibold text-primary">{row._count._all}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Overdue invoices" href="/invoices">
          {overdueInvoices.length === 0 ? (
            <p className="text-sm text-muted">Nothing overdue.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {overdueInvoices.map((inv) => (
                <li key={inv.id}>
                  <Link href="/invoices" className="flex items-center justify-between gap-3 py-2 text-sm hover:underline">
                    <span className="text-primary">{inv.invoiceNumber} — {inv.client.name}</span>
                    <span className="tabular text-xs text-muted">AED {inv.totalAmount.toLocaleString()}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
