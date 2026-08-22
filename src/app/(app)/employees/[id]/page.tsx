import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/Badge";
import { complianceStatus, COMPLIANCE_FIELDS } from "@/lib/compliance";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch, branchWhere } from "@/lib/branch";
import { groupLookups } from "@/lib/lookups";
import { PhotoUpload } from "./photo-upload";
import { EditForm } from "./edit-form";
import { DocumentsSection } from "./documents-section";
import { SkillsSection } from "./skills-section";
import { VisaHistorySection } from "./visa-history-section";
import { LabourCardHistorySection } from "./labour-card-history-section";
import { AccommodationSection } from "./accommodation-section";
import { NotesSection } from "./notes-section";

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
  const [employee, projects, sites, vehicles, vacantBeds, sponsors, suppliers, lookupValues] = await Promise.all([
    prisma.employee.findUnique({
      where: { id },
      include: {
        supplier: true,
        project: { include: { client: true } },
        documents: { orderBy: { uploadedAt: "desc" } },
        skills: { include: { skill: true } },
        visaApplications: { orderBy: { createdAt: "desc" } },
        labourCardApplications: { orderBy: { createdAt: "desc" } },
        bed: { include: { room: { include: { camp: true } } } },
        noteEntries: {
          orderBy: { createdAt: "desc" },
          include: {
            createdBy: { select: { name: true } },
            documents: { select: { id: true, filename: true } },
          },
        },
      },
    }),
    prisma.project.findMany({ orderBy: { name: "asc" } }),
    prisma.site.findMany({
      where: { project: branchWhere(branchId) },
      select: { id: true, name: true, projectId: true },
      orderBy: { name: "asc" },
    }),
    prisma.vehicle.findMany({ orderBy: { plateNumber: "asc" } }),
    prisma.bed.findMany({
      where: { employeeId: null },
      include: { room: { include: { camp: true } } },
      orderBy: [{ room: { camp: { name: "asc" } } }, { room: { name: "asc" } }, { label: "asc" }],
    }),
    prisma.supplier.findMany({ where: branchWhere(branchId), orderBy: { name: "asc" } }),
    prisma.supplier.findMany({ where: branchWhere(branchId), select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.lookupValue.findMany({
      where: { ...branchWhere(branchId), isActive: true },
      orderBy: [{ sortOrder: "asc" }, { value: "asc" }],
      select: { category: true, value: true },
    }),
  ]);
  if (!employee || isOutsideBranch(employee.branchId, branchId, isSuperAdmin)) notFound();

  const lookups = groupLookups(lookupValues);
  const documentOptions = employee.documents.map((d) => ({ id: d.id, filename: d.filename }));

  const latest = await prisma.timesheetEntry.findFirst({
    where: { employeeIdNo: employee.employeeIdNo },
    orderBy: { month: "desc" },
  });

  return (
    <div className="space-y-8">
      <div>
        <Link href="/employees" className="text-sm text-muted hover:underline">
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
                <h1 className="text-xl tracking-tight text-primary font-semibold">
                  {employee.name}
                </h1>
                <Badge color={employee.active ? "green" : "slate"}>
                  {employee.active ? "Active" : "Inactive"}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted">
                {employee.employeeIdNo} · {employee.trade || "No trade set"} ·{" "}
                {employee.supplier?.name || "No company"}
              </p>
            </div>
          </div>
          {/* The colour was the whole message and nothing explained it — a
              grey chip read as a label rather than "no date on file". */}
          <div className="flex flex-wrap items-center gap-2">
            {COMPLIANCE_FIELDS.map((f) => {
              const value = employee[f.key as keyof typeof employee] as Date | null;
              const status = complianceStatus(value);
              const badge = STATUS_BADGE[status];
              return (
                <Badge key={f.key} color={badge.color}>
                  {f.label}
                  <span className="ml-1 opacity-75">
                    {value
                      ? new Date(value).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "2-digit",
                        })
                      : "not set"}
                  </span>
                </Badge>
              );
            })}
          </div>
        </div>
      </div>

      {latest && (
        <div className="card p-5 text-sm text-secondary">
          Latest on-record rate:{" "}
          <span className="font-medium text-primary">
            AED {latest.rate.toFixed(2)}
          </span>{" "}
          ({latest.monthLabel}, from uploaded timesheets — not editable here)
        </div>
      )}


      <EditForm
        employee={employee}
        projects={projects}
        sites={sites}
        vehicles={vehicles}
        sponsors={sponsors}
        suppliers={suppliers}
        documents={employee.documents}
        lookups={lookups}
        recordsContent={
          <>
            <SkillsSection
              employeeId={employee.id}
              skills={employee.skills.map((s) => ({
                id: s.skill.id,
                name: s.skill.name,
                proficiencyPercent: s.proficiencyPercent,
                rate: s.rate,
              }))}
            />

<NotesSection
              employeeId={employee.id}
              notes={employee.noteEntries.map((note) => ({
                id: note.id,
                remarks: note.remarks,
                createdAt: note.createdAt.toISOString(),
                createdByName: note.createdBy.name,
                documents: note.documents,
              }))}
            />

            {/* Below the identity form, not above it: a camp and bed matter less
                than who this is, and this card is empty for most workers. */}
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

            <VisaHistorySection
              employeeId={employee.id}
              entries={employee.visaApplications}
              stages={lookups.VISA_APPLICATION_STAGE}
              documents={documentOptions}
            />

            <LabourCardHistorySection
              employeeId={employee.id}
              entries={employee.labourCardApplications}
              stages={lookups.LABOUR_CARD_APPLICATION_STAGE}
              documents={documentOptions}
            />

            <DocumentsSection employeeId={employee.id} documents={employee.documents} />
          </>
        }
      />
    </div>
  );
}
