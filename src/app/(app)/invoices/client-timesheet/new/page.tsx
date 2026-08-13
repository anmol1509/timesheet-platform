import { prisma } from "@/lib/db";
import { ManualEntryForm } from "./manual-entry-form";

export default async function NewClientTimesheetEntryPage() {
  const [suppliers, clients, projects, sites] = await Promise.all([
    prisma.supplier.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
    prisma.client.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
    prisma.project.findMany({
      select: { id: true, code: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.site.findMany({
      select: { id: true, name: true, projectId: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">New Timesheet Entry</h1>
        <p className="mt-1 text-sm text-slate-500">
          Add timesheet rows by hand instead of uploading an Excel file. The
          columns match the Excel format — ID, name, trade, rate, supplier,
          client, and one column per day. Pick a Project to tag the location.
        </p>
      </div>

      <ManualEntryForm
        supplierNames={suppliers.map((s) => s.name)}
        clientNames={clients.map((c) => c.name)}
        projects={projects}
        sites={sites}
      />
    </div>
  );
}
