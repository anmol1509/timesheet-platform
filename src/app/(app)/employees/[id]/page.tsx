import { notFound } from "next/navigation";
import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/Badge";
import { complianceStatus, COMPLIANCE_FIELDS } from "@/lib/compliance";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { isOutsideBranch, branchWhere } from "@/lib/branch";
import { groupLookups } from "@/lib/lookups";
import { STAGE_COLOR, STAGE_LABEL } from "@/lib/employeeStage";
import { PhotoUpload } from "./photo-upload";
import { EditForm } from "./edit-form";
import { DocumentsSection } from "./documents-section";
import { SkillsSection } from "./skills-section";
import { VisaHistorySection } from "./visa-history-section";
import { LabourCardHistorySection } from "./labour-card-history-section";
import { AccommodationSection } from "./accommodation-section";
import { NotesSection } from "./notes-section";
import { InventorySection } from "./inventory-section";

function formatShortDate(value: Date) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
}

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
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const canViewPay = can(subjectOf(user), "payroll", "view");
  const canEditPay = can(subjectOf(user), "payroll", "edit");
  const [employee, projects, sites, vehicles, vacantBeds, sponsors, suppliers, lookupValues, inventoryItems] = await Promise.all([
    prisma.employee.findUnique({
      where: { id },
      // Decimal columns can't cross into the client form (and pay is only
      // fetched below for people allowed to see it).
      omit: {
        basicSalary: true,
        housingAllowance: true,
        foodAllowance: true,
        transportAllowance: true,
        otherAllowance: true,
        flatMonthlyRate: true,
        otMultiplier: true,
      },
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
        inventoryAssignments: {
          orderBy: { issuedDate: "desc" },
          include: {
            item: { select: { id: true, name: true, category: true } },
            variant: { select: { id: true, name: true } },
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
    prisma.inventoryItem.findMany({
      where: branchWhere(branchId),
      select: {
        id: true,
        name: true,
        category: true,
        variants: {
          select: {
            id: true,
            name: true,
            stock: true,
            assignments: { where: { returnDate: null }, select: { quantity: true } },
          },
          orderBy: { name: "asc" },
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);
  if (!employee || isOutsideBranch(employee.branchId, branchId, isSuperAdmin)) notFound();

  const payRow = canViewPay
    ? await prisma.employee.findUnique({
        where: { id },
        select: {
          basicSalary: true,
          housingAllowance: true,
          foodAllowance: true,
          transportAllowance: true,
          otherAllowance: true,
          flatMonthlyRate: true,
          otMultiplier: true,
        },
      })
    : null;
  const n = (d: { toString(): string } | null | undefined) => (d == null ? "" : String(Number(d.toString())));
  const pay = payRow
    ? {
        canEdit: canEditPay,
        basicSalary: n(payRow.basicSalary),
        housingAllowance: n(payRow.housingAllowance),
        foodAllowance: n(payRow.foodAllowance),
        transportAllowance: n(payRow.transportAllowance),
        otherAllowance: n(payRow.otherAllowance),
        flatMonthlyRate: n(payRow.flatMonthlyRate),
        otMultiplier: n(payRow.otMultiplier) || "1.25",
      }
    : null;

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
                {employee.supplier?.isOwnCompany && (
                  <span title="Our worker">
                    <BadgeCheck className="h-4 w-4 shrink-0 text-blue-500" aria-label="Our worker" />
                  </span>
                )}
                <Badge color={employee.active ? "green" : "slate"}>
                  {employee.active ? "Active" : "Inactive"}
                </Badge>
                {/* Where the worker sits in the mobilisation cycle. The
                    active/inactive chip above is about the employment; this is
                    about the job, and they differ often enough to show both. */}
                <Badge color={STAGE_COLOR[employee.status] ?? "slate"}>
                  {STAGE_LABEL[employee.status] ?? employee.status}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted">
                {employee.employeeIdNo} · {employee.trade || "No trade set"} ·{" "}
                {employee.supplier?.name || "No company"}
                {employee.status === "UNDER_MOBILISATION" && employee.mobilisationDate && (
                  <> · due on site {formatShortDate(employee.mobilisationDate)}</>
                )}
                {employee.status === "ON_SITE" && employee.siteArrivalDate && (
                  <> · on site since {formatShortDate(employee.siteArrivalDate)}</>
                )}
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
        pay={pay}
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

            <InventorySection
              employeeId={employee.id}
              assignments={employee.inventoryAssignments.map((a) => ({
                id: a.id,
                quantity: a.quantity,
                issuedDate: a.issuedDate.toISOString(),
                returnDate: a.returnDate ? a.returnDate.toISOString() : null,
                condition: a.condition,
                notes: a.notes,
                item: a.item,
                variant: a.variant,
              }))}
              items={inventoryItems.map((i) => ({
                id: i.id,
                name: i.name,
                category: i.category,
                variants: i.variants.map((v) => ({
                  id: v.id,
                  name: v.name,
                  available: v.stock - v.assignments.reduce((sum, a) => sum + a.quantity, 0),
                })),
              }))}
            />
          </>
        }
      />
    </div>
  );
}
