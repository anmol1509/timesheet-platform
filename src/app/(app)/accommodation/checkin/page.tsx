import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { PageHeader } from "@/components/PageHeader";
import { StatTile } from "@/components/StatTile";
import { Users, LogIn, Clock } from "lucide-react";
import { CheckInTable } from "./checkin-table";

export default async function CheckInPage() {
  const { branchId } = await requireUserWithBranch();

  const [employees, camps] = await Promise.all([
    prisma.employee.findMany({
      where: { ...branchWhere(branchId), bed: null },
      select: {
        id: true,
        name: true,
        employeeIdNo: true,
        nationality: true,
        supplier: { select: { name: true, code: true } },
        project: { select: { code: true, name: true } },
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
  ]);

  const employeeIds = employees.map((e) => e.id);
  const openCheckIns =
    employeeIds.length > 0
      ? await prisma.campCheckIn.findMany({
          where: { employeeId: { in: employeeIds }, status: "CHECKED_IN" },
          include: { camp: { select: { name: true } } },
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
      checkInId: openCheckIn?.id ?? null,
      campName: openCheckIn?.camp.name ?? null,
      campId: openCheckIn?.campId ?? null,
    };
  });

  const campOptions = camps.map((c) => {
    const beds = c.rooms.flatMap((r) => r.beds);
    return {
      id: c.id,
      name: c.name,
      ownerType: c.ownerType,
      supplierName: c.owningSupplier?.name ?? null,
      roomCount: c.rooms.length,
      vacantBeds: beds.filter((b) => !b.employeeId).length,
      totalBeds: beds.length,
    };
  });

  const notCheckedIn = rows.filter((r) => !r.checkInId).length;
  const awaitingBed = rows.length - notCheckedIn;

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

      <CheckInTable rows={rows} camps={campOptions} />
    </div>
  );
}
