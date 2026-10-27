import { toPlain } from "@/lib/plain";
import { settleDueCheckouts } from "@/lib/accommodationCheckout";
import { dayKey } from "@/lib/checkoutReasons";
import { notFound } from "next/navigation";
import Link from "next/link";
import { BadgeCheck, CalendarDays, ChevronRight, Hash, Home, MapPin, Phone } from "lucide-react";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/Badge";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { isOutsideBranch, branchWhere } from "@/lib/branch";
import { groupLookups } from "@/lib/lookups";
import { stagesFor } from "@/lib/lookupCategories";
import { stageBadge } from "@/lib/employeeStage";
import { PhotoUpload } from "./photo-upload";
import { EditForm } from "./edit-form";
import { DocumentsSection } from "./documents-section";
import { SkillsSection } from "./skills-section";
import { HistorySection } from "./history-section";
import { readinessItem } from "./readiness-card";
import { DocumentFixes } from "./profile-fixes";
import { StatusRow, type StatusItem } from "@/components/StatusRow";
import { COMPLIANCE_FIELDS, complianceStatus, daysUntil } from "@/lib/compliance";
import { VisaHistorySection } from "./visa-history-section";
import { SalaryHistorySection, type RevisionRow } from "./salary-history-section";
import { arrearsFor } from "@/lib/payrollSchedule";
import { LabourCardHistorySection } from "./labour-card-history-section";
import { AccommodationSection } from "./accommodation-section";
import { NotesSection } from "./notes-section";
import { InventorySection } from "./inventory-section";
import { ProfileSummary } from "./profile-summary";
import { EmployeeTimesheetSection } from "./timesheet-section";

export const metadata = { title: "Employee" };

function formatShortDate(value: Date) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
}

export default async function EmployeeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { id } = await params;
  const { month: monthParam } = await searchParams;
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const canViewPay = can(subjectOf(user), "payroll", "view");
  const canEditPay = can(subjectOf(user), "payroll", "edit");
  // Free any bed whose scheduled checkout date has arrived before reading this worker.
  await settleDueCheckouts(branchId, user);
  const pendingAssignment = await prisma.projectAssignmentRequest.findFirst({ where: { employeeId: id, status: "PENDING" }, orderBy: { requestedAt: "desc" } });
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
        hourlyRate: true,
        otMultiplier: true,
        dailyHours: true,
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
          orderBy: [{ noteDate: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
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
    prisma.project.findMany({ where: branchWhere(branchId), orderBy: { name: "asc" } }),
    prisma.site.findMany({
      where: { project: branchWhere(branchId) },
      select: { id: true, name: true, projectId: true },
      orderBy: { name: "asc" },
    }),
    prisma.vehicle.findMany({ where: branchWhere(branchId), orderBy: { plateNumber: "asc" } }),
    prisma.bed.findMany({
      where: { employeeId: null },
      include: { room: { include: { camp: true } } },
      orderBy: [{ room: { camp: { name: "asc" } } }, { room: { name: "asc" } }, { label: "asc" }],
    }),
    prisma.supplier.findMany({ where: branchWhere(branchId), orderBy: { name: "asc" }, select: { id: true, name: true, parentSupplierId: true } }),
    prisma.supplier.findMany({ where: branchWhere(branchId), select: { id: true, name: true, parentSupplierId: true }, orderBy: { name: "asc" } }),
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
  const openStay = employee.bed
    ? await prisma.accommodationHistory.findFirst({ where: { employeeId: employee.id, checkOutDate: null }, orderBy: { checkInDate: "desc" }, select: { checkInDate: true, plannedCheckOutDate: true, plannedCheckOutReason: true } })
    : null;
  const stay = openStay ? { checkInDate: dayKey(openStay.checkInDate), planned: openStay.plannedCheckOutDate ? { date: dayKey(openStay.plannedCheckOutDate), reason: openStay.plannedCheckOutReason ?? "" } : null } : null;

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
          hourlyRate: true,
          otMultiplier: true,
        dailyHours: true,
          leaveDaysPerYear: true,
          airTicketAmount: true,
          airTicketEveryMonths: true,
          skipGratuity: true,
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
        hourlyRate: n(payRow.hourlyRate),
        otMultiplier: n(payRow.otMultiplier) || "1.25",
        dailyHours: n(payRow.dailyHours) || "8",
        leaveDaysPerYear: n(payRow.leaveDaysPerYear),
        airTicketAmount: n(payRow.airTicketAmount),
        airTicketEveryMonths: n(payRow.airTicketEveryMonths),
        skipGratuity: payRow.skipGratuity,
      }
    : null;

  const revisions = canViewPay ? await prisma.salaryRevision.findMany({ where: { employeeId: id }, orderBy: { effectiveFrom: "desc" }, take: 20 }) : [];
  const closedRuns = revisions.length > 0 ? await prisma.payrollRun.findMany({ where: { branchId: employee.branchId, status: { in: ["APPROVED", "PAID"] }, lines: { some: { employeeId: id } } }, select: { month: true } }) : [];
  const closedMonths = [...new Set(closedRuns.map((r) => r.month))];
  const arrearsAdded = revisions.length > 0 ? await prisma.payrollAdjustment.findMany({ where: { employeeId: id, category: "ARREARS" }, select: { label: true } }) : [];
  const revisionRows: RevisionRow[] = revisions.map((r) => {
    const increase = Number(r.fixedAfter.toString()) - Number(r.fixedBefore.toString());
    const a = increase > 0 ? arrearsFor(increase, r.effectiveFrom, closedMonths) : null;
    const label = a && a.months.length > 0 ? `Salary arrears ${a.months[0]} to ${a.months[a.months.length - 1]}` : null;
    return { id: r.id, effectiveFrom: r.effectiveFrom.toISOString().slice(0, 10), reason: r.reason, fixedBefore: Number(r.fixedBefore.toString()), fixedAfter: Number(r.fixedAfter.toString()), by: r.createdByName, arrears: a && a.months.length > 0 && !arrearsAdded.some((x) => x.label === label) ? { months: a.months.length, amount: a.amount } : null };
  });

  const lookups = groupLookups(lookupValues);
  const documentOptions = employee.documents.map((d) => ({ id: d.id, filename: d.filename }));

  const latest = await prisma.timesheetEntry.findFirst({
    where: { employeeIdNo: employee.employeeIdNo },
    orderBy: { month: "desc" },
  });

  // What needs attention on this profile, as chips: payroll readiness (for people who see pay) and documents.
  const statusItems: StatusItem[] = [];
  if (canViewPay) {
    const r = await readinessItem(employee.id);
    if (r.item) statusItems.push(r.item);
  }
  const docStatuses = COMPLIANCE_FIELDS.slice(0, 5).map((f) => {
    const value = (employee as unknown as Record<string, unknown>)[f.key] as Date | null;
    return { field: f.key as string, label: f.label, state: complianceStatus(value), status: complianceStatus(value), days: value ? daysUntil(value) : null, current: value ? value.toISOString().slice(0, 10) : "" };
  });
  const docsToFix = docStatuses.filter((d) => d.status === "expired" || d.status === "expiring" || d.status === "not_set");
  if (docsToFix.length > 0) {
    statusItems.push({
      key: "documents", tone: docStatuses.some((d) => d.status === "expired") ? "danger" : "warn", label: `${docsToFix.length} document${docsToFix.length === 1 ? "" : "s"} need attention`, title: "Documents that need attention", description: "Set the new expiry date here once a document is renewed.",
      content: <DocumentFixes employeeId={employee.id} docs={docStatuses} />,
    });
  }

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-muted">
        <Link href="/" aria-label="Dashboard" className="transition hover:text-primary">
          <Home className="h-3.5 w-3.5" aria-hidden />
        </Link>
        <ChevronRight className="h-3 w-3 text-subtle" aria-hidden />
        <Link href="/employees" className="font-medium transition hover:text-primary">Employees</Link>
        <ChevronRight className="h-3 w-3 text-subtle" aria-hidden />
        <span className="truncate font-medium text-secondary">{employee.name}</span>
      </nav>

      <section className="card relative overflow-hidden">
        {/* Soft brand wash behind the identity block — the one decorative
            touch on the page, so the person reads first. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-r from-[var(--brand-primary-soft)] via-[var(--surface)] to-[var(--surface)]" aria-hidden />
        <div className="relative flex flex-wrap items-center justify-between gap-6 p-5 sm:p-6">
          <div className="flex min-w-0 items-center gap-5">
            <PhotoUpload
              employeeId={employee.id}
              hasPhoto={!!employee.photoMimeType}
              name={employee.name}
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-page-title text-primary">{employee.name}</h1>
                {employee.supplier?.isOwnCompany && (
                  <span title="Our worker">
                    <BadgeCheck className="h-5 w-5 shrink-0 text-[var(--brand-primary)]" aria-label="Our worker" />
                  </span>
                )}
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
                <span className="tabular font-medium text-secondary">{employee.employeeIdNo}</span>
                <span aria-hidden>·</span>
                <span>
                  {employee.category === "STAFF"
                    ? [employee.position, employee.department].filter(Boolean).join(" · ") || "No position set"
                    : employee.trade || "No trade set"}
                </span>
                <span aria-hidden>·</span>
                <span>{employee.supplier?.name || "No company"}</span>
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge color={employee.active ? "green" : "slate"} dot>
                  {employee.active ? "Active" : "Inactive"}
                </Badge>
                {/* Where the worker sits in the mobilisation cycle. The
                    active/inactive chip is about the employment; this is
                    about the job, and they differ often enough to show both. */}
                <Badge color={stageBadge(employee.status, !!employee.project).color}>
                  {stageBadge(employee.status, !!employee.project).label}
                </Badge>
                {employee.category !== "STAFF" && employee.project && (
                  <Link href={`/projects/${employee.project.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-secondary hover:text-primary">
                    <MapPin className="h-3.5 w-3.5 text-subtle" aria-hidden />
                    {employee.project.name}
                  </Link>
                )}
                {pendingAssignment && (
                  <Link href="/approvals?type=DEPLOYMENT" className="inline-flex items-center gap-1 rounded-full bg-[var(--warning-soft)] px-2.5 py-0.5 text-xs font-medium text-[var(--warning)]" title={`Requested by ${pendingAssignment.requestedByName ?? "someone"}`}>
                    Awaiting approval: move to {pendingAssignment.projectName}
                  </Link>
                )}
                {employee.status === "UNDER_MOBILISATION" && employee.mobilisationDate && (
                  <span className="text-xs text-muted">due on site {formatShortDate(employee.mobilisationDate)}</span>
                )}
                {employee.status === "ON_SITE" && employee.siteArrivalDate && (
                  <span className="text-xs text-muted">on site since {formatShortDate(employee.siteArrivalDate)}</span>
                )}
              </div>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm sm:grid-cols-3">
            <HeaderFact icon={CalendarDays} label="Joined" value={employee.joinDate ? formatShortDate(employee.joinDate) : "—"} />
            <HeaderFact icon={Hash} label="Category" value={employee.category === "STAFF" ? "Staff" : "Site staff"} />
            <HeaderFact icon={Phone} label="Mobile" value={employee.mobileNumber || "—"} />
          </dl>
        </div>
      </section>

      <div className="flex justify-end">
        <Link href={`/employees/instant-view?employeeId=${employee.id}`} className="btn btn-secondary text-sm">Instant view</Link>
      </div>

      {canViewPay && employee.supplier?.isOwnCompany && (
        <div className="flex justify-end">
          <Link href={`/letters?employee=${employee.id}&template=salary`} className="btn btn-secondary text-sm">Salary certificate</Link>
        </div>
      )}
      <ProfileSummary
        employee={toPlain(employee)}
        project={
          employee.project
            ? { id: employee.project.id, name: employee.project.name, manager: employee.project.manager, managerPhone: employee.project.managerPhone, client: { name: employee.project.client.name } }
            : null
        }
        bed={employee.bed ? { label: employee.bed.label, roomName: employee.bed.room.name, campName: employee.bed.room.camp.name } : null}
        supplier={employee.supplier ? { id: employee.supplier.id, name: employee.supplier.name, contactPerson: employee.supplier.contactPerson, contactPhone: employee.supplier.contactPhone } : null}
        latest={latest ? { monthLabel: latest.monthLabel, totalHours: latest.totalHours, rate: latest.rate, status: latest.status } : null}
        ppeOut={employee.inventoryAssignments.filter((a) => !a.returnDate).length}
        documentCount={employee.documents.length}
      />

      <StatusRow items={statusItems} hideWhenClear={!canViewPay} clearText="Ready for payroll: pay, bank details and documents are in order" label="Needs attention on this profile" />

      <EditForm
        ownRateOnly={!employee.skills.some((s) => (Number(s.rate) || 0) > 0)}
        employee={toPlain(employee)}
        pay={pay}
        projects={projects}
        sites={sites}
        vehicles={vehicles}
        sponsors={toPlain(sponsors)}
        suppliers={toPlain(suppliers)}
        documents={employee.documents}
        lookups={lookups}
        // Read-only month view of attendance beside the client timesheet; only for people who may see timesheets.
        timesheetContent={
          can(subjectOf(user), "timesheets", "view") ? (
            <EmployeeTimesheetSection
              employee={{ id: employee.id, employeeIdNo: employee.employeeIdNo, branchId: employee.branchId, supplierId: employee.supplierId, joinDate: employee.joinDate, exitDate: employee.exitDate, project: employee.project ? { weeklyOffDays: employee.project.weeklyOffDays } : null }}
              month={monthParam ?? null}
              canViewRates={canViewPay}
              canEditAttendance={can(subjectOf(user), "timesheets.attendance", "edit")}
            />
          ) : null
        }
        tradesContent={
          <>
            {canViewPay && <SalaryHistorySection rows={revisionRows} canAddArrears={canEditPay} />}
            <SkillsSection
              employeeId={employee.id}
              workerRate={pay && !employee.skills.some((s) => (Number(s.rate) || 0) > 0) ? Number(pay.hourlyRate) || null : null}
              workerTrade={employee.trade}
              skills={employee.skills.map((s) => ({
                id: s.skill.id,
                name: s.skill.name,
                proficiencyPercent: s.proficiencyPercent,
                rate: s.rate,
                rateType: s.rateType,
              }))}
            />
          </>
        }
        recordsContent={
          <>
<NotesSection
              employeeId={employee.id}
              notes={employee.noteEntries.map((note) => ({
                id: note.id,
                remarks: note.remarks,
                createdAt: note.createdAt.toISOString(),
                noteDate: (note.noteDate ?? note.createdAt).toISOString().slice(0, 10),
                createdByName: note.createdBy.name,
                documents: note.documents,
              }))}
            />
            <HistorySection employeeId={employee.id} employeeName={employee.name} canSeePay={canViewPay} />
          </>
        }
        siteContent={
          <>
            {/* Below the identity form, not above it: a camp and bed matter less
                than who this is, and this card is empty for most workers. */}
            <AccommodationSection
              employeeId={employee.id}
              employeeName={employee.name}
              stay={stay}
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
        documentsContent={
          <>
            <VisaHistorySection
              employeeId={employee.id}
              entries={employee.visaApplications}
              stages={stagesFor("VISA_APPLICATION_STAGE", lookups.VISA_APPLICATION_STAGE)}
              documents={documentOptions}
            />
            <LabourCardHistorySection
              employeeId={employee.id}
              entries={employee.labourCardApplications}
              stages={stagesFor("LABOUR_CARD_APPLICATION_STAGE", lookups.LABOUR_CARD_APPLICATION_STAGE)}
              documents={documentOptions}
            />
            <DocumentsSection employeeId={employee.id} documents={employee.documents} />
          </>
        }
      />
    </div>
  );
}

function HeaderFact({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-sunken text-muted">
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </span>
      <div className="min-w-0">
        <dt className="text-[11px] font-medium text-subtle">{label}</dt>
        <dd className="truncate font-semibold text-primary">{value}</dd>
      </div>
    </div>
  );
}
