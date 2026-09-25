import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { PageHeader } from "@/components/PageHeader";
import { StatTile } from "@/components/StatTile";
import { ListChecks, BedDouble, Clock } from "lucide-react";
import { BedAllocationTable } from "./bed-allocation-table";

export default async function BedAllocationPage() {
  const { branchId } = await requireUserWithBranch();

  const checkIns = await prisma.campCheckIn.findMany({
    where: {
      status: { in: ["CHECKED_IN", "BED_ALLOCATED"] },
      camp: { ownerType: "OWN" },
      ...(branchId ? { employee: { branchId } } : {}),
    },
    include: {
      employee: { select: { id: true, name: true, employeeIdNo: true, nationality: true, supplier: { select: { id: true, name: true } }, project: { select: { client: { select: { id: true, name: true } } } } } },
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

  // Every own camp with its rooms and beds, so a placement can be made in any of them.
  const campChoices = await prisma.camp.findMany({
    where: { ownerType: "OWN" },
    select: { id: true, name: true, rooms: { select: { id: true, name: true, beds: { select: { id: true, label: true, employeeId: true } } }, orderBy: { name: "asc" } } },
    orderBy: { name: "asc" },
  });

  const [suppliers, clients] = await Promise.all([
    prisma.supplier.findMany({ where: branchWhere(branchId), select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.client.findMany({ where: branchWhere(branchId), select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const rows = checkIns.map((c) => ({
    checkInId: c.id,
    checkInNo: c.checkInNo,
    employeeName: c.employee.name,
    employeeIdNo: c.employee.employeeIdNo,
    nationality: c.employee.nationality,
    supplierId: c.employee.supplier?.id ?? null,
    supplierName: c.employee.supplier?.name ?? null,
    clientId: c.employee.project?.client.id ?? null,
    clientName: c.employee.project?.client.name ?? null,
    campId: c.camp.id,
    campName: c.camp.name,
    roomName: c.bed?.room.name ?? null,
    bedLabel: c.bed?.label ?? null,
    bedId: c.bed?.id ?? null,
    checkInDate: c.checkInDate.toISOString().slice(0, 10),
  }));

  const allocated = rows.filter((r) => r.bedId).length;
  const awaiting = rows.length - allocated;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Bed Allocation"
        description="Everyone checked into a camp. Pick a room, then a bed, to place them."
        meta={
          <span className="tabular rounded-md bg-surface-sunken px-1.5 py-0.5 text-xs font-medium text-secondary">
            {rows.length}
          </span>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="Checked In" value={rows.length} icon={ListChecks} />
        <StatTile label="Bed Allocated" value={allocated} icon={BedDouble} />
        <StatTile
          label="Awaiting Allocation"
          value={awaiting}
          icon={Clock}
          tone={awaiting > 0 ? "warning" : "default"}
        />
      </div>

      <BedAllocationTable rows={rows} camps={campChoices} suppliers={suppliers} clients={clients} />
    </div>
  );
}
