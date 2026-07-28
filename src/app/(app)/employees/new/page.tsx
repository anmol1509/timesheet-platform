import { prisma } from "@/lib/db";
import { EmployeeWizard } from "./wizard";

export default async function AddEmployeePage() {
  const projects = await prisma.project.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Add New Employee
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Register a new worker with all required documentation.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-base font-semibold text-slate-900">
          Employee Registration
        </h2>
        <EmployeeWizard projects={projects} />
      </div>
    </div>
  );
}
