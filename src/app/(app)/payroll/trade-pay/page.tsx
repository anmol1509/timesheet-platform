import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/PageHeader";
import { TradePayBoard, type TradePayRow } from "./trade-pay-board";

export const metadata = { title: "Trade pay" };

export default async function TradePayPage() {
  const { user, branchId } = await requireUserWithBranch();
  const subject = subjectOf(user);
  const [companies, rows] = await Promise.all([
    prisma.supplier.findMany({ where: { ...branchWhere(branchId), isOwnCompany: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.tradePay.findMany({ where: branchWhere(branchId), orderBy: [{ trade: "asc" }] }),
  ]);
  const n = (d: { toString(): string } | null) => (d == null ? null : Number(d.toString()));
  const data: TradePayRow[] = rows.map((r) => ({
    id: r.id, supplierId: r.supplierId, trade: r.trade, payStructure: r.payStructure,
    basicSalary: n(r.basicSalary), housingAllowance: n(r.housingAllowance), foodAllowance: n(r.foodAllowance), transportAllowance: n(r.transportAllowance), otherAllowance: n(r.otherAllowance),
    flatMonthlyRate: n(r.flatMonthlyRate), hourlyRate: n(r.hourlyRate), dailyHours: Number(r.dailyHours), paysOvertime: r.paysOvertime, otMultiplier: Number(r.otMultiplier), restOtMultiplier: Number(r.restOtMultiplier),
  }));
  return (
    <div className="space-y-5">
      <PageHeader
        title="Trade pay"
        description="What each of your companies pays for a trade. Workers follow their trade's pay automatically; only set pay on a worker's own record for an exception."
      />
      <TradePayBoard companies={companies} rows={data} canEdit={can(subject, "payroll", "edit")} />
    </div>
  );
}
