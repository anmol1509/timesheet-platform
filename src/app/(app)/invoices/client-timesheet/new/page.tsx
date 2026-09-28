import { FilePlus2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { ManualEntryForm } from "./manual-entry-form";

export default async function NewClientTimesheetEntryPage() {
  const { branchId } = await requireUserWithBranch();
  const [suppliers, clients, projects, sites] = await Promise.all([
    prisma.supplier.findMany({ where: branchWhere(branchId), select: { name: true }, orderBy: { name: "asc" } }),
    prisma.client.findMany({ where: branchWhere(branchId), select: { name: true }, orderBy: { name: "asc" } }),
    prisma.project.findMany({
      where: branchWhere(branchId),
      select: { id: true, code: true, name: true },
      orderBy: { name: "asc" },
    }),
    // Site has no branch of its own — it inherits its project's.
    prisma.site.findMany({
      where: { project: branchWhere(branchId) },
      select: { id: true, name: true, projectId: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Timesheet Entry"
        icon={FilePlus2}
        description={<>Add timesheet rows by hand instead of uploading an Excel file. The columns match the Excel format — ID, name, trade, rate, supplier, client, and one column per day. Pick a Project to tag the location.</>}
      />

      <ManualEntryForm
        supplierNames={suppliers.map((s) => s.name)}
        clientNames={clients.map((c) => c.name)}
        projects={projects}
        sites={sites}
      />
    </div>
  );
}
