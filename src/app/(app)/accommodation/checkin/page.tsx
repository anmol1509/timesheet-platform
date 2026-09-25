import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { PageHeader } from "@/components/PageHeader";
import { StatTile } from "@/components/StatTile";
import { Users, LogIn, Clock } from "lucide-react";
import { CheckInTable } from "./checkin-table";
import { CheckInHistory } from "./checkin-history";

function stayDays(from: Date, to: Date | null) {
  return Math.max(0, Math.floor(((to ?? new Date()).getTime() - from.getTime()) / 86_400_000));
}

export default async function CheckInPage() {
  const { branchId } = await requireUserWithBranch();

  const [employees, camps, suppliers, clients] = await Promise.all([
    prisma.employee.findMany({
      where: { ...branchWhere(branchId), bed: null },
      select: {
        id: true,
        name: true,
        employeeIdNo: true,
        nationality: true,
        supplier: { select: { name: true, code: true } },
        supplierId: true,
        project: { select: { code: true, name: true, clientId: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.camp.findMany({
      include: {
        owningSupplier: { select: { name: true } },
        rooms: { select: { beds: { select: { employeeId: true } } } },
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
      nationality: e.nationality,
      supplierName: e.supplier?.name ?? null,
      supplierCode: e.supplier?.code ?? null,
      projectCode: e.project?.code ?? null,
      projectName: e.project?.name ?? null,
      supplierId: e.supplierId,
      clientId: e.project?.clientId ?? null,
      campKind: openCheckIn?.camp.ownerType ?? null,
      checkInId: openCheckIn?.id ?? null,
      campName: openCheckIn?.camp.name ?? null,
      campId: openCheckIn?.campId ?? null,
    };
  });

  const campOptions = camps
    .filter((c) => c.ownerType === "OWN")
    .map((c) => {
      const beds = c.rooms.flatMap((r) => r.beds);
      return { id: c.id, name: c.name, ownerType: c.ownerType, supplierName: null as string | null, roomCount: c.rooms.length, vacantBeds: beds.filter((b) => !b.employeeId).length, totalBeds: beds.length };
    });
  const notCheckedIn = rows.filter((r) => !r.checkInId).length;
  const awaitingBed = rows.filter((r) => r.checkInId && r.campKind === "OWN").length;

  const history = await prisma.campCheckIn.findMany({
    where: branchId ? { employee: { branchId } } : {},
    include: {
      employee: { select: { name: true, employeeIdNo: true, nationality: true } },
      camp: { select: { id: true, name: true } },
      bed: { select: { label: true, room: { select: { name: true } } } },
    },
    orderBy: { checkInNo: "desc" },
    take: 300,
  });

  const historyRows = history.map((c) => ({
    checkInId: c.id,
    checkInNo: c.checkInNo,
    employeeName: c.employee.name,
    employeeIdNo: c.employee.employeeIdNo,
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
        title="Create Check-In"
        description="Registered employees with no bed allocated yet. Check them into a camp, then allocate a bed under Bed Allocation."
        meta={
          <span className="tabular rounded-md bg-surface-sunken px-1.5 py-0.5 text-xs font-medium text-secondary">
            {rows.length}
          </span>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="Without a Bed" value={rows.length} icon={Users} />
        <StatTile label="Not Checked In" value={notCheckedIn} icon={LogIn} />
        <StatTile
          label="Awaiting Bed"
          value={awaitingBed}
          icon={Clock}
          tone={awaitingBed > 0 ? "warning" : "default"}
        />
      </div>

      <CheckInTable rows={rows} camps={campOptions} suppliers={suppliers} clients={clients} />

      <CheckInHistory rows={historyRows} camps={campOptions.map((c) => ({ id: c.id, name: c.name }))} />
    </div>
  );
}
