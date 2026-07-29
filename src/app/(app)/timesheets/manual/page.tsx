import { prisma } from "@/lib/db";
import { ManualEntryForm } from "./manual-entry-form";

export default async function ManualTimesheetEntryPage() {
  const [suppliers, clients, sites] = await Promise.all([
    prisma.supplier.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
    prisma.client.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
    prisma.site.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Manual Timesheet Entry
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Add timesheet rows by hand instead of uploading an Excel file. The
          columns match the Excel format — ID, name, trade, rate, supplier,
          client, site, and one column per day.
        </p>
      </div>

      <ManualEntryForm
        supplierNames={suppliers.map((s) => s.name)}
        clientNames={clients.map((c) => c.name)}
        siteNames={sites.map((s) => s.name)}
      />
    </div>
  );
}
