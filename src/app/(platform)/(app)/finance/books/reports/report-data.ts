import { prisma } from "@/lib/db";
import { ageParties, ageTotals, termsDays, type AgeRow } from "@/lib/books/ageing";
import { cashFlow } from "@/lib/books/cashflow";
import { isMoneyAccount } from "@/lib/books/ledger";
import { profitByClient } from "@/lib/books/projectProfit";
import { vatReturn, type Manual } from "@/lib/books/vat";

/** Receivables or payables aged by due date, with the names of the parties. */
export async function loadAgeing(branchId: string, asOf: Date, side: "RECEIVABLE" | "PAYABLE") {
  const rec = side === "RECEIVABLE";
  const lines = await prisma.journalLine.findMany({
    where: { account: { branchId, tag: side }, entry: { branchId, status: "POSTED", date: { lte: asOf } } },
    select: { debit: true, credit: true, partyId: true, entry: { select: { date: true } } },
  });
  const ids = [...new Set(lines.map((l) => l.partyId).filter((x): x is string => !!x))];
  const parties = ids.length
    ? rec
      ? await prisma.client.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, paymentTerms: true } })
      : await prisma.supplier.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, paymentTerms: true } })
    : [];
  const info = new Map(parties.map((p) => [p.id, p]));
  const rows = ageParties(
    lines.map((l) => ({ date: l.entry.date, debit: Number(l.debit), credit: Number(l.credit), partyId: l.partyId })),
    asOf, rec ? "debit" : "credit",
    (id) => termsDays(id ? info.get(id)?.paymentTerms : null),
  );
  const t = ageTotals(rows);
  const late = rows.filter((r) => r.buckets.d90 + r.buckets.over > 0).sort((a, b) => b.buckets.d90 + b.buckets.over - (a.buckets.d90 + a.buckets.over));
  return { rec, rows, t, late, info } as { rec: boolean; rows: AgeRow[]; t: ReturnType<typeof ageTotals>; late: AgeRow[]; info: Map<string, { id: string; name: string; paymentTerms: string | null }> };
}

/** Direct-method cash flow for a period, with the cash balance at its start. */
export async function loadCashFlow(branchId: string, from: Date, asOf: Date) {
  const accounts = await prisma.account.findMany({ where: { branchId }, select: { id: true, type: true, tag: true, name: true, bankId: true } });
  const money = new Set(accounts.filter(isMoneyAccount).map((a) => a.id));
  const entries = await prisma.journalEntry.findMany({
    where: { branchId, status: "POSTED", date: { lte: asOf }, lines: { some: { accountId: { in: [...money] } } } },
    select: { date: true, type: true, lines: { select: { debit: true, credit: true, account: { select: { id: true, type: true, tag: true } } } } },
  });
  const cf = (list: typeof entries) => cashFlow(list.map((e) => ({ type: e.type, lines: e.lines.map((l) => ({ money: money.has(l.account.id), debit: Number(l.debit), credit: Number(l.credit), accountType: l.account.type, tag: l.account.tag })) })));
  const opening = entries.filter((e) => e.date < from || e.type === "OPENING").reduce((s, e) => s + e.lines.filter((l) => money.has(l.account.id)).reduce((n, l) => n + Number(l.debit) - Number(l.credit), 0), 0);
  const c = cf(entries.filter((e) => e.date >= from && e.type !== "OPENING"));
  const close = Math.round((opening + c.net) * 100) / 100;
  return { opening, c, close };
}

/** Revenue by client and the costs of each project, for a period. */
export async function loadProjectProfit(branchId: string, from: Date, asOf: Date) {
  const entries = await prisma.journalEntry.findMany({
    where: { branchId, status: "POSTED", type: { not: "CLOSING" }, date: { gte: from, lte: asOf } },
    select: { lines: { select: { debit: true, credit: true, partyType: true, partyId: true, projectId: true, account: { select: { type: true, tag: true } } } } },
  });
  const projectIds = [...new Set(entries.flatMap((e) => e.lines.map((l) => l.projectId)).filter((x): x is string => !!x))];
  const projects = projectIds.length ? await prisma.project.findMany({ where: { id: { in: projectIds } }, select: { id: true, name: true, code: true, clientId: true } }) : [];
  const pById = new Map(projects.map((p) => [p.id, p]));
  const result = profitByClient(entries.map((e) => ({ lines: e.lines.map((l) => ({ accountType: l.account.type, tag: l.account.tag, debit: Number(l.debit), credit: Number(l.credit), partyType: l.partyType, partyId: l.partyId, projectId: l.projectId })) })), (id) => pById.get(id)?.clientId ?? null);
  const clientIds = result.clients.map((c) => c.clientId).filter((x): x is string => !!x);
  const clients = clientIds.length ? await prisma.client.findMany({ where: { id: { in: clientIds } }, select: { id: true, name: true } }) : [];
  const cName = new Map(clients.map((c) => [c.id, c.name]));
  return { result, cName, pById };
}

/** The VAT return for a period, with the company's details. */
export async function loadVat(branchId: string, from: Date, asOf: Date, manual: Manual) {
  const [entries, branch] = await Promise.all([
    prisma.journalEntry.findMany({
      where: { branchId, status: "POSTED", type: { notIn: ["CLOSING", "OPENING"] }, date: { gte: from, lte: asOf }, lines: { some: { account: { tag: { in: ["VAT_OUTPUT", "VAT_INPUT", "INCOME_SALES"] } } } } },
      select: { type: true, lines: { select: { debit: true, credit: true, account: { select: { tag: true, type: true } } } } },
    }),
    prisma.branch.findUnique({ where: { id: branchId }, select: { name: true, trn: true, emirate: true } }),
  ]);
  const r = vatReturn(entries.map((e) => ({ type: e.type, lines: e.lines.map((l) => ({ tag: l.account.tag, accountType: l.account.type, debit: Number(l.debit), credit: Number(l.credit) })) })), branch?.emirate ?? "Dubai", manual);
  return { r, branch };
}
