import { r2 } from "./postings";

export type PpLine = { accountType: string; tag: string | null; debit: number; credit: number; partyType: string | null; partyId: string | null; projectId: string | null };
export type PpEntry = { lines: PpLine[] };
export type ProjectRow = { projectId: string; salaries: number; otherCosts: number };
export type ClientRow = { clientId: string | null; revenue: number; projects: ProjectRow[] };
export type ProjectProfit = { clients: ClientRow[]; revenue: number; projectCosts: number; companyCosts: number; profit: number };

/**
 * Profit cut by client and project. Revenue belongs to the client on the invoice; costs belong to the project they were
 * tagged with (payroll and expenses carry one). Costs with no project are shown as company-wide so the total always
 * matches the profit & loss.
 */
export function profitByClient(entries: PpEntry[], clientOfProject: (projectId: string) => string | null): ProjectProfit {
  const clients = new Map<string | null, { revenue: number; projects: Map<string, ProjectRow> }>();
  const get = (id: string | null) => clients.get(id) ?? (clients.set(id, { revenue: 0, projects: new Map() }), clients.get(id)!);
  let companyCosts = 0;
  for (const e of entries) {
    const clientId = e.lines.find((l) => l.tag === "RECEIVABLE" && l.partyType === "CLIENT")?.partyId ?? null;
    for (const l of e.lines) {
      if (l.accountType === "INCOME") get(clientId).revenue += l.credit - l.debit;
      else if (l.accountType === "EXPENSE") {
        const cost = l.debit - l.credit;
        if (!l.projectId) { companyCosts += cost; continue; }
        const c = get(clientOfProject(l.projectId));
        const row = c.projects.get(l.projectId) ?? { projectId: l.projectId, salaries: 0, otherCosts: 0 };
        if (l.tag === "SALARIES") row.salaries += cost; else row.otherCosts += cost;
        c.projects.set(l.projectId, row);
      }
    }
  }
  const rows: ClientRow[] = [...clients].map(([clientId, c]) => ({ clientId, revenue: r2(c.revenue), projects: [...c.projects.values()].map((p) => ({ ...p, salaries: r2(p.salaries), otherCosts: r2(p.otherCosts) })) }));
  const cost = (c: ClientRow) => c.projects.reduce((s, p) => s + p.salaries + p.otherCosts, 0);
  rows.sort((a, b) => b.revenue - a.revenue);
  const revenue = r2(rows.reduce((s, c) => s + c.revenue, 0));
  const projectCosts = r2(rows.reduce((s, c) => s + cost(c), 0));
  return { clients: rows, revenue, projectCosts, companyCosts: r2(companyCosts), profit: r2(revenue - projectCosts - companyCosts) };
}
