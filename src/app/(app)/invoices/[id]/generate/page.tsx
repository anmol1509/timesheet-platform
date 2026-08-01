import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getClientMonthEntries } from "@/lib/clientInvoice";
import { monthLabelFromKey } from "@/lib/timesheetSummary";
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

  const client = await prisma.client.findUnique({ where: { id } });
  if (!client || !month) notFound();

  const entries = await getClientMonthEntries(id, month);
  if (entries.length === 0) notFound();

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
    />
  );
}
