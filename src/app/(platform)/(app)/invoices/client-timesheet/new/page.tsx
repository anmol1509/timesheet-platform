import { FilePlus2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { ManualEntryForm } from "./manual-entry-form";
import { BulkSaves } from "../bulk-saves";
import { loadBulkSaves } from "@/lib/bulkSaves";

export const metadata = { title: "New client timesheet" };

export default async function NewClientTimesheetEntryPage() {
  const { branchId } = await requireUserWithBranch();
  const recentSaves = await loadBulkSaves(branchId);
  const [suppliers, clients, projects, sites, roster, rateRows, tradePay, lastRows] = await Promise.all([
    prisma.supplier.findMany({ where: branchWhere(branchId), select: { name: true, isOwnCompany: true }, orderBy: { name: "asc" } }),
    prisma.client.findMany({ where: branchWhere(branchId), select: { name: true, hourlyRate: true }, orderBy: { name: "asc" } }),
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
      select: { employeeIdNo: true, name: true, trade: true, nationality: true, status: true, hourlyRate: true, skills: { select: { rate: true, rateType: true, skill: { select: { name: true } } } }, supplier: { select: { name: true, fullName: true } }, project: { select: { id: true, name: true, client: { select: { name: true } } } } },
      orderBy: { name: "asc" },
      take: 3000,
    }),
    // What each client is billed per hour for a trade: one rate for the whole client, or a project's own.
    prisma.clientTradeRate.findMany({ where: { client: branchWhere(branchId) }, select: { trade: true, rate: true, projectId: true, client: { select: { name: true } } } }),
    // What each supplier is paid per hour for a trade (the cost side).
    prisma.tradePay.findMany({ where: { ...branchWhere(branchId), hourlyRate: { not: null } }, select: { trade: true, hourlyRate: true, supplier: { select: { name: true } } } }),
    // The rate on each worker's most recent timesheet row for a trade and supplier: rates repeat month to month.
    prisma.timesheetEntry.findMany({
      where: { ...branchWhere(branchId), rate: { gt: 0 } },
      orderBy: { month: "desc" },
      distinct: ["employeeIdNo", "trade", "supplierId"],
      select: { employeeIdNo: true, trade: true, rate: true, projectId: true, supplier: { select: { name: true } } },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Timesheet Entry"
        icon={FilePlus2}
        description={<>Enter a whole month for many workers without an Excel file: add people from your roster in one go, fill the days with a pattern, then adjust any day by hand.</>}
      />

      <BulkSaves saves={recentSaves} heading="Recent saves you can undo" />

      <ManualEntryForm
        supplierNames={suppliers.map((s) => s.name)}
        ownSupplierNames={suppliers.filter((s) => s.isOwnCompany).map((s) => s.name)}
        clientNames={clients.map((c) => c.name)}
        projects={projects.map((p) => ({ id: p.id, code: p.code, name: p.name, clientName: p.client?.name ?? "" }))}
        rates={[...rateRows.map((r) => ({ client: r.client.name, projectId: r.projectId, trade: r.trade, rate: r.rate })), ...clients.filter((c) => (c.hourlyRate ?? 0) > 0).map((c) => ({ client: c.name, projectId: null, trade: "", rate: c.hourlyRate as number }))]}
        sites={sites}
        lastRates={lastRows.map((l) => ({ idNo: l.employeeIdNo, trade: l.trade, supplier: l.supplier.name, projectId: l.projectId ?? "", rate: l.rate }))}
        supplierPay={tradePay.map((t) => ({ supplier: t.supplier.name, trade: t.trade, rate: Number(t.hourlyRate) }))}
        roster={roster.map((e) => ({ usualRate: Number(e.hourlyRate ?? 0), tradeRates: e.skills.filter((k) => (k.rate ?? 0) > 0 && (!k.rateType || k.rateType === "HOURLY")).map((k) => ({ trade: k.skill.name, rate: k.rate as number })), employeeIdNo: e.employeeIdNo, name: e.name, trade: e.trade ?? "", supplierName: e.supplier?.name ?? "", nationality: e.nationality ?? "", projectId: e.project?.id ?? "", projectName: e.project?.name ?? "", clientName: e.project?.client?.name ?? "", onWork: ["UNDER_MOBILISATION", "ON_SITE", "ACTIVE"].includes(e.status) && !!e.project }))}
      />
    </div>
  );
}
