import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { DemandRequestForm } from "./demand-request-form";

export default async function NewDemandRequestPage() {
  const { branchId } = await requireUserWithBranch();
  const [clients, projects, taxonomy, rosterTrades] = await Promise.all([
    prisma.client.findMany({ where: branchWhere(branchId), select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.project.findMany({
      where: branchWhere(branchId),
      select: { id: true, name: true, code: true, clientId: true },
      orderBy: { name: "asc" },
    }),
    prisma.skill.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
    // The taxonomy holds 8 trades; the roster records ~dozens as plain strings
    // on Employee.trade. Offering only the taxonomy meant demanding a trade
    // nobody is recorded as holding — 0 available while 84 idle Helpers sat
    // there. The dropdown is the union of both, so what can be demanded matches
    // what can actually be supplied.
    prisma.employee.findMany({
      where: { ...branchWhere(branchId), active: true, NOT: { trade: null } },
      select: { trade: true },
      distinct: ["trade"],
    }),
  ]);

  // Deduped case-insensitively, first spelling wins.
  const seen = new Map<string, string>();
  for (const name of [...taxonomy.map((t) => t.name), ...rosterTrades.map((r) => r.trade!)]) {
    const key = name.trim().toLowerCase();
    if (key && !seen.has(key)) seen.set(key, name.trim());
  }
  const tradeOptions = [...seen.values()].sort((a, b) => a.localeCompare(b));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl tracking-tight text-primary font-semibold">Raise Demand</h1>
        <p className="mt-1 text-sm text-muted">
          Request staffing for a client project, broken down by trade.
        </p>
      </div>
      <DemandRequestForm clients={clients} projects={projects} tradeOptions={tradeOptions} />
    </div>
  );
}
