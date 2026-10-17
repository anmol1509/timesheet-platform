import { prisma } from "@/lib/db";
import { branchWhere } from "@/lib/branch";
import { groupLookups } from "@/lib/lookups";
import { parseQuoteSettings } from "@/lib/quotationMath";

/** Everything the quotation form needs besides the quotation itself. */
export async function loadQuotationFormData(branchId: string | null) {
  const [clients, contacts, lookupValues, branch, pay] = await Promise.all([
    prisma.client.findMany({ where: branchWhere(branchId), select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.clientContact.findMany({ where: { client: branchWhere(branchId) }, select: { id: true, clientId: true, name: true, designation: true, email: true }, orderBy: { name: "asc" } }),
    prisma.lookupValue.findMany({
      where: { ...branchWhere(branchId), category: "TRADE", isActive: true },
      orderBy: [{ sortOrder: "asc" }, { value: "asc" }],
      select: { category: true, value: true },
    }),
    branchId ? prisma.branch.findUnique({ where: { id: branchId }, select: { quoteSettings: true } }) : null,
    prisma.employee.findMany({
      where: { ...branchWhere(branchId), active: true, trade: { not: null } },
      select: { trade: true, payStructure: true, basicSalary: true, housingAllowance: true, foodAllowance: true, transportAllowance: true, otherAllowance: true, flatMonthlyRate: true, hourlyRate: true, dailyHours: true },
    }),
  ]);

  const contactsByClient: Record<string, { id: string; name: string; designation: string | null; email: string | null }[]> = {};
  for (const c of contacts) (contactsByClient[c.clientId] ??= []).push({ id: c.id, name: c.name, designation: c.designation, email: c.email });

  const settings = parseQuoteSettings(branch?.quoteSettings);

  // Average monthly pay per trade, so a cost can be suggested. Hourly workers are priced at a month of working days.
  const sums = new Map<string, { total: number; count: number }>();
  for (const e of pay) {
    const monthly =
      e.payStructure === "FLAT" ? Number(e.flatMonthlyRate ?? 0)
      : e.payStructure === "HOURLY" ? Number(e.hourlyRate ?? 0) * Number(e.dailyHours ?? 8) * settings.daysPerMonth
      : Number(e.basicSalary ?? 0) + Number(e.housingAllowance ?? 0) + Number(e.foodAllowance ?? 0) + Number(e.transportAllowance ?? 0) + Number(e.otherAllowance ?? 0);
    if (!(monthly > 0)) continue;
    const key = (e.trade as string).trim().toLowerCase();
    const cur = sums.get(key) ?? { total: 0, count: 0 };
    sums.set(key, { total: cur.total + monthly, count: cur.count + 1 });
  }
  const salaryHints: Record<string, number> = {};
  for (const [k, v] of sums) salaryHints[k] = v.total / v.count;

  return { clients, contacts: contactsByClient, tradeOptions: groupLookups(lookupValues).TRADE, settings, salaryHints };
}

export const isoDay = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");
