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
        description="Default pay for a trade. It fills in a new worker's pay form (and pays workers who have none of their own yet); each worker's own figures, set on their record, are what is paid."
      />
      <TradePayBoard companies={companies} rows={data} canEdit={can(subject, "payroll", "edit")} />
    </div>
  );
}
