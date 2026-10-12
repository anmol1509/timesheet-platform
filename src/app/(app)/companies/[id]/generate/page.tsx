import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { getSupplierMonthEntries, monthLabelFromKey } from "@/lib/timesheetSummary";
import { absenceRuleOf, gasRuleOf } from "@/lib/deductions";
import { ReviewClient } from "./review-client";

export default async function GeneratePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { id } = await params;
  const { month } = await searchParams;

  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const supplier = await prisma.supplier.findUnique({ where: { id } });
  // A guessed URL must not open another branch's supplier sheet.
  if (!supplier || !month || isOutsideBranch(supplier.branchId, branchId, isSuperAdmin)) notFound();

  const entries = await getSupplierMonthEntries(id, month);

  if (entries.length === 0) notFound();

  // Check-in dates drive the gas charge; workers without one fall back to the days on the sheet.
  const roster = await prisma.employee.findMany({
    where: { employeeIdNo: { in: entries.map((e) => e.employeeIdNo) } },
    select: { employeeIdNo: true, siteArrivalDate: true },
  });
  const checkIn = new Map(roster.map((r) => [r.employeeIdNo, r.siteArrivalDate ? r.siteArrivalDate.toISOString() : null]));

  return (
    <>
      {supplier.invoiceApprovalStatus !== "Approved" && (
        // Said up front rather than after the whole sheet has been reviewed:
        // generation is refused for an unapproved supplier, and the reason
        // used to appear only once you pressed the button.
        <p className="mb-4 rounded-control border border-[var(--warning-border)] bg-[var(--warning-soft)] px-3 py-2 text-sm text-[var(--warning)]">
          <span className="font-medium">{supplier.name}</span> is not
          invoice-approved (currently {supplier.invoiceApprovalStatus || "unset"}),
          so generating will be refused. Set Invoice Approval to Approved on the{" "}
          <Link href={`/suppliers/${supplier.id}`} className="font-medium underline">
            supplier&rsquo;s Overview tab
          </Link>
          .
        </p>
      )}
      <ReviewClient
      supplier={{ id: supplier.id, name: supplier.name, fullName: supplier.fullName }}
      absenceRule={absenceRuleOf(supplier)}
      gasRule={gasRuleOf(supplier)}
      month={month}
      monthLabel={monthLabelFromKey(month)}
      entries={entries.map((e) => ({
        id: e.id,
        employeeIdNo: e.employeeIdNo,
        employeeName: e.employeeName,
        trade: e.trade,
        rate: e.rate,
        totalHours: e.totalHours,
        absentCount: e.absentCount,
        absentDeduction: e.absentDeduction,
        dailyHours: e.dailyHours,
        clientName: e.client?.name ?? null,
        checkIn: checkIn.get(e.employeeIdNo) ?? null,
      }))}
      />
    </>
  );
}
