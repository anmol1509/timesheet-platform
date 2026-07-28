import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/Badge";
import { complianceStatus, COMPLIANCE_FIELDS } from "@/lib/compliance";
import { PhotoUpload } from "./photo-upload";
import { EditForm } from "./edit-form";
import { DocumentsSection } from "./documents-section";
import { SkillsSection } from "./skills-section";

const STATUS_BADGE = {
  valid: { label: "Valid", color: "green" as const },
  expiring: { label: "Expiring soon", color: "amber" as const },
  expired: { label: "Expired", color: "red" as const },
  not_set: { label: "Not on file", color: "slate" as const },
};

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [employee, projects] = await Promise.all([
    prisma.employee.findUnique({
      where: { id },
      include: {
        supplier: true,
        project: { include: { client: true } },
        documents: { orderBy: { uploadedAt: "desc" } },
        skills: { include: { skill: true } },
        bed: { include: { room: { include: { camp: true } } } },
      },
    }),
    prisma.project.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!employee) notFound();

  const latest = await prisma.timesheetEntry.findFirst({
    where: { employeeIdNo: employee.employeeIdNo },
    orderBy: { month: "desc" },
  });

  return (
    <div className="space-y-8">
      <div>
        <Link href="/employees" className="text-sm text-slate-500 hover:underline">
          ← Employees
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <PhotoUpload
              employeeId={employee.id}
              hasPhoto={!!employee.photoData}
              name={employee.name}
            />
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">
                {employee.name}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                {employee.employeeIdNo} · {employee.trade || "No trade set"} ·{" "}
                {employee.supplier?.name || "No company"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {COMPLIANCE_FIELDS.map((f) => {
              const status = complianceStatus(
                employee[f.key as keyof typeof employee] as Date | null
              );
              const badge = STATUS_BADGE[status];
              return (
                <div key={f.key} className="text-center">
                  <Badge color={badge.color}>{f.label}</Badge>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {latest && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
          Latest on-record rate:{" "}
          <span className="font-medium text-slate-900">
            AED {latest.rate.toFixed(2)}
          </span>{" "}
          ({latest.monthLabel}, from uploaded timesheets — not editable here)
        </div>
      )}

      {employee.bed && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
          Accommodation:{" "}
          <span className="font-medium text-slate-900">
            {employee.bed.room.camp.name} · {employee.bed.room.name} ·{" "}
            {employee.bed.label}
          </span>
        </div>
      )}

      <EditForm employee={employee} projects={projects} />

      <SkillsSection
        employeeId={employee.id}
        skills={employee.skills.map((s) => ({ id: s.skill.id, name: s.skill.name }))}
      />

      <DocumentsSection employeeId={employee.id} documents={employee.documents} />
    </div>
  );
}
