import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { BedAllocationTable } from "./bed-allocation-table";

export default async function BedAllocationPage() {
  const { branchId } = await requireUserWithBranch();

  const checkIns = await prisma.campCheckIn.findMany({
    where: {
      status: { in: ["CHECKED_IN", "BED_ALLOCATED"] },
      ...(branchId ? { employee: { branchId } } : {}),
    },
    include: {
      employee: { select: { id: true, name: true, employeeIdNo: true, nationality: true } },
      camp: {
        select: {
          id: true,
          name: true,
          rooms: {
            select: { id: true, name: true, beds: { select: { id: true, label: true, employeeId: true } } },
            orderBy: { name: "asc" },
          },
        },
      },
      bed: { select: { id: true, label: true, room: { select: { id: true, name: true } } } },
    },
    orderBy: { checkInNo: "desc" },
  });

  const rows = checkIns.map((c) => ({
    checkInId: c.id,
    checkInNo: c.checkInNo,
    employeeName: c.employee.name,
    employeeIdNo: c.employee.employeeIdNo,
    nationality: c.employee.nationality,
    campId: c.camp.id,
    campName: c.camp.name,
    roomName: c.bed?.room.name ?? null,
    bedLabel: c.bed?.label ?? null,
    bedId: c.bed?.id ?? null,
    checkInDate: c.checkInDate.toISOString().slice(0, 10),
    rooms: c.camp.rooms.map((r) => ({
      id: r.id,
      name: r.name,
      beds: r.beds.map((b) => ({ id: b.id, label: b.label, vacant: !b.employeeId || b.id === c.bed?.id })),
    })),
  }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl tracking-tight text-primary font-semibold">
          Bed Allocation
        </h1>
        <p className="mt-1 text-sm text-muted">
          Everyone checked into a camp. Pick a room, then a bed, to place them.
        </p>
      </div>

      <BedAllocationTable rows={rows} />
    </div>
  );
}
