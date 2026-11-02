import { FilePlus2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { ManualEntryForm } from "./manual-entry-form";

export const metadata = { title: "New client timesheet" };

export default async function NewClientTimesheetEntryPage() {
  const { branchId } = await requireUserWithBranch();
  const [suppliers, clients, projects, sites, roster, rateRows] = await Promise.all([
    prisma.supplier.findMany({ where: branchWhere(branchId), select: { name: true }, orderBy: { name: "asc" } }),
    prisma.client.findMany({ where: branchWhere(branchId), select: { name: true }, orderBy: { name: "asc" } }),
    prisma.project.findMany({
      where: branchWhere(branchId),
      select: { id: true, code: true, name: true, client: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    // Site has no branch of its own — it inherits its project's.
    prisma.site.findMany({
      where: { project: branchWhere(branchId) },
      select: { id: true, name: true, projectId: true },
      orderBy: { name: "asc" },
    }),
    // Everyone who can still work, so a month can be started for a whole company in one go.
    prisma.employee.findMany({
      where: { ...branchWhere(branchId), active: true, status: { notIn: ["TERMINATED", "ABSCONDING"] } },
      select: { employeeIdNo: true, name: true, trade: true, supplier: { select: { name: true, fullName: true } } },
      orderBy: { name: "asc" },
      take: 3000,
    }),
    // What each client is billed per hour for a trade: one rate for the whole client, or a project's own.
    prisma.clientTradeRate.findMany({ where: { client: branchWhere(branchId) }, select: { trade: true, rate: true, projectId: true, client: { select: { name: true } } } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Timesheet Entry"
        icon={FilePlus2}
        description={<>Enter a whole month for many workers without an Excel file: add people from your roster in one go, fill the days with a pattern, then adjust any day by hand.</>}
      />

      <ManualEntryForm
        supplierNames={suppliers.map((s) => s.name)}
        clientNames={clients.map((c) => c.name)}
        projects={projects.map((p) => ({ id: p.id, code: p.code, name: p.name, clientName: p.client?.name ?? "" }))}
        rates={rateRows.map((r) => ({ client: r.client.name, projectId: r.projectId, trade: r.trade, rate: r.rate }))}
        sites={sites}
        roster={roster.map((e) => ({ employeeIdNo: e.employeeIdNo, name: e.name, trade: e.trade ?? "", supplierName: e.supplier?.name ?? "" }))}
      />
    </div>
  );
}
