import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getClientMonthEntries } from "@/lib/clientInvoice";
import { monthLabelFromKey } from "@/lib/timesheetSummary";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { ReviewInvoice } from "./review-invoice";

export default async function GenerateInvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { id } = await params;
  const { month } = await searchParams;
  const { branchId, isSuperAdmin } = await requireUserWithBranch();

  const client = await prisma.client.findUnique({ where: { id } });
  if (!client || !month || isOutsideBranch(client.branchId, branchId, isSuperAdmin)) notFound();

  const entries = await getClientMonthEntries(id, month);
  if (entries.length === 0) notFound();

  const activeLpos = await prisma.lpo.findMany({
    where: { clientId: id, status: "ACTIVE" },
    select: { id: true, lpoNumber: true, value: true, billedAmount: true, validTo: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <ReviewInvoice
      client={{
        id: client.id,
        name: client.name,
        trn: client.trn,
        billingAddress: client.billingAddress,
      }}
      month={month}
      monthLabel={monthLabelFromKey(month)}
      entries={entries}
      activeLpos={activeLpos.map((l) => ({
        id: l.id,
        lpoNumber: l.lpoNumber,
        remaining: l.value != null ? l.value - l.billedAmount : null,
        expired: l.validTo ? l.validTo.getTime() < Date.now() : false,
      }))}
    />
  );
}
