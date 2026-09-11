import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
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
        supplier: { select: { name: true } },
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

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl tracking-tight text-primary font-semibold">
          Create Check-In
        </h1>
        <p className="mt-1 text-sm text-muted">
          Registered employees with no bed allocated yet. Check them into a camp, then allocate a bed under Bed Allocation.
        </p>
      </div>

      <CheckInTable rows={rows} camps={campOptions} />
    </div>
  );
}
