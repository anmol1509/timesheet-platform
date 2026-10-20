import { settleDueCheckouts } from "@/lib/accommodationCheckout";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { PageHeader } from "@/components/PageHeader";
import { StatTile } from "@/components/StatTile";
import { Insights } from "@/components/ListSummary";
import { complianceStatus } from "@/lib/compliance";
import { Users, Clock, BedDouble } from "lucide-react";
import { CheckInTable } from "./checkin-table";
import { CheckInHistory } from "./checkin-history";

export const metadata = { title: "Check-in" };

function stayDays(from: Date, to: Date | null) {
  return Math.max(0, Math.floor(((to ?? new Date()).getTime() - from.getTime()) / 86_400_000));
}

export default async function CheckInPage() {
  const { user, branchId } = await requireUserWithBranch();
  await settleDueCheckouts(branchId, user);

  const [employees, camps, suppliers, clients] = await Promise.all([
    prisma.employee.findMany({
      where: { ...branchWhere(branchId), bed: null },
      select: {
        id: true,
        name: true,
        employeeIdNo: true,
        nationality: true,
        photoMimeType: true,
        visaExpiry: true,
        supplier: { select: { name: true, code: true } },
        supplierId: true,
        project: { select: { code: true, name: true, clientId: true, client: { select: { name: true } } } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.camp.findMany({
      where: branchWhere(branchId),
      include: {
        owningSupplier: { select: { name: true } },
        rooms: { select: { name: true, beds: { select: { id: true, label: true, employeeId: true } } } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.supplier.findMany({ where: branchWhere(branchId), select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.client.findMany({ where: branchWhere(branchId), select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const employeeIds = employees.map((e) => e.id);
  const openCheckIns =
    employeeIds.length > 0
      ? await prisma.campCheckIn.findMany({
          where: { employeeId: { in: employeeIds }, status: "CHECKED_IN" },
          include: { camp: { select: { name: true, ownerType: true } } },
        })
      : [];
  const openCheckInByEmployee = Object.fromEntries(openCheckIns.map((c) => [c.employeeId, c]));

  const rows = employees.map((e) => {
    const openCheckIn = openCheckInByEmployee[e.id];
    return {
      id: e.id,
      name: e.name,
      employeeIdNo: e.employeeIdNo,
      hasPhoto: !!e.photoMimeType,
      nationality: e.nationality,
      supplierName: e.supplier?.name ?? null,
      supplierCode: e.supplier?.code ?? null,
      projectCode: e.project?.code ?? null,
      projectName: e.project?.name ?? null,
      supplierId: e.supplierId,
      clientId: e.project?.clientId ?? null,
      clientName: e.project?.client.name ?? null,
      campKind: openCheckIn?.camp.ownerType ?? null,
      checkInId: openCheckIn?.id ?? null,
      campName: openCheckIn?.camp.name ?? null,
      campId: openCheckIn?.campId ?? null,
      visaStatus: complianceStatus(e.visaExpiry),
    };
  });

  const campOptions = camps
    .filter((c) => c.ownerType === "OWN")
    .map((c) => {
      const beds = c.rooms.flatMap((r) => r.beds);
      // Vacant beds in the order a check-in fills them: room by room.
      const natural = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });
      const vacant = c.rooms
        .flatMap((r) => r.beds.filter((b) => !b.employeeId).map((b) => ({ id: b.id, room: r.name, label: b.label })))
        .sort((a, b) => natural(a.room, b.room) || natural(a.label, b.label));
      return { id: c.id, name: c.name, ownerType: c.ownerType, supplierName: null as string | null, roomCount: c.rooms.length, vacantBeds: vacant.length, totalBeds: beds.length, vacant };
    });
  const notCheckedIn = rows.filter((r) => !r.checkInId).length;
  const awaitingBed = rows.filter((r) => r.checkInId && r.campKind === "OWN").length;
  const vacantTotal = campOptions.reduce((n, c) => n + c.vacantBeds, 0);
  const bedsTotal = campOptions.reduce((n, c) => n + c.totalBeds, 0);

  const history = await prisma.campCheckIn.findMany({
    where: branchId ? { employee: { branchId } } : {},
    include: {
      employee: { select: { id: true, name: true, employeeIdNo: true, nationality: true, photoMimeType: true } },
      camp: { select: { id: true, name: true } },
      bed: { select: { label: true, room: { select: { name: true } } } },
    },
    orderBy: { checkInNo: "desc" },
    take: 300,
  });

  const historyRows = history.map((c) => ({
    checkInId: c.id,
    checkInNo: c.checkInNo,
    employeeId: c.employee.id,
    employeeName: c.employee.name,
    employeeIdNo: c.employee.employeeIdNo,
    employeeHasPhoto: !!c.employee.photoMimeType,
    nationality: c.employee.nationality,
    campId: c.camp.id,
    campName: c.camp.name,
    checkInDate: c.checkInDate.toISOString(),
    status: c.status,
    checkOutDate: c.checkOutDate ? c.checkOutDate.toISOString() : null,
    bedLabel: c.bed ? `${c.bed.room.name} · ${c.bed.label}` : null,
    stayDays: stayDays(c.checkInDate, c.checkOutDate),
  }));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Check-In"
        description="Move workers into a camp and give them a bed in one go."
        meta={
          <span className="tabular rounded-md bg-surface-sunken px-1.5 py-0.5 text-xs font-medium text-secondary">
            {notCheckedIn + awaitingBed} waiting
          </span>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="Not checked in" value={notCheckedIn} icon={Users} />
        <StatTile label="Waiting for a bed" value={awaitingBed} icon={Clock} tone={awaitingBed > 0 ? "warning" : "default"} />
        <StatTile
          label="Vacant beds"
          value={<>{vacantTotal} <span className="text-base font-normal text-muted">of {bedsTotal}</span></>}
          icon={BedDouble}
          hint={campOptions.map((c) => `${c.name.split(" — ")[0]} ${c.vacantBeds}`).join(" · ") || undefined}
        />
      </div>

      <CheckInTable rows={rows} camps={campOptions} suppliers={suppliers} clients={clients} />

      <Insights id="checkin-history" title="Past check-ins" hint="Search them, and reprint a check-in slip">
        <CheckInHistory rows={historyRows} camps={campOptions.map((c) => ({ id: c.id, name: c.name }))} />
      </Insights>
    </div>
  );
}
