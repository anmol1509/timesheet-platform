import { prisma } from "@/lib/db";

export const VAT_RATE = 0.05; // UAE standard VAT

export async function getClientMonthEntries(clientId: string, month: string) {
  const [entries, client, tradeRates] = await Promise.all([
    prisma.timesheetEntry.findMany({
      where: { clientId, month, status: "CLIENT_APPROVED" },
      include: { supplier: true },
      orderBy: [{ trade: "asc" }, { employeeName: "asc" }],
    }),
    prisma.client.findUnique({ where: { id: clientId } }),
    // All rates for this client — both client-wide (projectId null) and
    // project-scoped overrides — resolved per line below.
    prisma.clientTradeRate.findMany({ where: { clientId } }),
  ]);
  const fallbackRate = client?.hourlyRate ?? client?.basicRate ?? null;
  return entries.map((e) => {
    const projectRate = e.projectId
      ? tradeRates.find((r) => r.projectId === e.projectId && r.trade === e.trade)?.rate
      : undefined;
    const clientRate = tradeRates.find((r) => r.projectId === null && r.trade === e.trade)?.rate;
    const resolvedRate = projectRate ?? clientRate ?? fallbackRate ?? null;
    return {
      id: e.id,
      employeeIdNo: e.employeeIdNo,
      employeeName: e.employeeName,
      trade: e.trade,
      totalHours: e.totalHours,
      costRate: e.rate, // what's paid to the supplier
      supplierName: e.supplier.name,
      billRate: resolvedRate ?? 0, // editable per line before saving
      rateSet: resolvedRate != null, // false when no rate at any level exists
    };
  });
}

export type InvoiceLine = ReturnType<typeof lineFromEntry>;

function lineFromEntry(e: {
  id: string;
  totalHours: number;
  costRate: number;
  billRate: number;
}) {
  const amount = e.totalHours * e.billRate;
  const cost = e.totalHours * e.costRate;
  return { amount, cost, margin: amount - cost };
}

export function summarizeInvoice(
  entries: { id: string; totalHours: number; costRate: number }[],
  billRates: Record<string, number>
) {
  let subtotal = 0;
  let cost = 0;
  for (const e of entries) {
    const billRate = billRates[e.id] ?? 0;
    const line = lineFromEntry({ ...e, billRate });
    subtotal += line.amount;
    cost += line.cost;
  }
  const vatAmount = subtotal * VAT_RATE;
  const totalAmount = subtotal + vatAmount;
  return { subtotal, vatAmount, totalAmount, cost, margin: subtotal - cost };
}

export async function nextInvoiceNumber(): Promise<string> {
  const count = await prisma.clientInvoice.count();
  return `INV-${String(count + 1).padStart(6, "0")}`;
}
