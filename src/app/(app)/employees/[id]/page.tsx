import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/Badge";
import { complianceStatus, COMPLIANCE_FIELDS } from "@/lib/compliance";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch, branchWhere } from "@/lib/branch";
import { PhotoUpload } from "./photo-upload";
import { EditForm } from "./edit-form";
import { DocumentsSection } from "./documents-section";
import { SkillsSection } from "./skills-section";
import { VaccinationsSection } from "./vaccinations-section";
import { AccommodationSection } from "./accommodation-section";

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
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const [employee, projects, vehicles, vacantBeds, sponsorshipCompanies] = await Promise.all([
    prisma.employee.findUnique({
      where: { id },
      include: {
        supplier: true,
        project: { include: { client: true } },
        documents: { orderBy: { uploadedAt: "desc" } },
        skills: { include: { skill: true } },
        vaccinations: { orderBy: { date: "desc" } },
        bed: { include: { room: { include: { camp: true } } } },
      },
    }),
    prisma.project.findMany({ orderBy: { name: "asc" } }),
    prisma.vehicle.findMany({ orderBy: { plateNumber: "asc" } }),
    prisma.bed.findMany({
      where: { employeeId: null },
      include: { room: { include: { camp: true } } },
      orderBy: [{ room: { camp: { name: "asc" } } }, { room: { name: "asc" } }, { label: "asc" }],
    }),
    prisma.sponsorshipCompany.findMany({ where: branchWhere(branchId), orderBy: { name: "asc" } }),
  ]);
  if (!employee || isOutsideBranch(employee.branchId, branchId, isSuperAdmin)) notFound();

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
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold text-slate-900">
                  {employee.name}
                </h1>
                <Badge color={employee.active ? "green" : "slate"}>
                  {employee.active ? "Active" : "Inactive"}
                </Badge>
              </div>
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
        <div className="rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
          Latest on-record rate:{" "}
          <span className="font-medium text-slate-900">
            AED {latest.rate.toFixed(2)}
          </span>{" "}
          ({latest.monthLabel}, from uploaded timesheets — not editable here)
        </div>
      )}

      <AccommodationSection
        employeeId={employee.id}
        currentBed={
          employee.bed
            ? {
                id: employee.bed.id,
                label: employee.bed.label,
                roomName: employee.bed.room.name,
                campName: employee.bed.room.camp.name,
              }
            : null
        }
        vacantBeds={vacantBeds.map((b) => ({
          id: b.id,
          label: b.label,
          roomName: b.room.name,
          campName: b.room.camp.name,
        }))}
      />

      <EditForm
        employee={employee}
        projects={projects}
        vehicles={vehicles}
        sponsorshipCompanies={sponsorshipCompanies}
        documents={employee.documents}
      />

      <SkillsSection
        employeeId={employee.id}
        skills={employee.skills.map((s) => ({
          id: s.skill.id,
          name: s.skill.name,
          proficiencyPercent: s.proficiencyPercent,
          rate: s.rate,
        }))}
      />

      <VaccinationsSection
        employeeId={employee.id}
        vaccinations={employee.vaccinations.map((v) => ({
          id: v.id,
          vaccineName: v.vaccineName,
          doseNumber: v.doseNumber,
          date: v.date,
          expiryDate: v.expiryDate,
        }))}
      />

      <DocumentsSection employeeId={employee.id} documents={employee.documents} />
    </div>
  );
}
