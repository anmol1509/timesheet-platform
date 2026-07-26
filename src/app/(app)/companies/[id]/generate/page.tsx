import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSupplierMonthEntries, monthLabelFromKey } from "@/lib/timesheetSummary";
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

  const supplier = await prisma.supplier.findUnique({ where: { id } });
  if (!supplier || !month) notFound();

  const [entries, settings] = await Promise.all([
    getSupplierMonthEntries(id, month),
    prisma.settings.upsert({
      where: { id: "singleton" },
      update: {},
      create: { id: "singleton" },
    }),
  ]);

  if (entries.length === 0) notFound();

  return (
    <ReviewClient
      supplier={{ id: supplier.id, name: supplier.name, fullName: supplier.fullName }}
      month={month}
      monthLabel={monthLabelFromKey(month)}
      issuedTo={settings.issuedTo}
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
      }))}
    />
  );
}
