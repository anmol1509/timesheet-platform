import { settleDueCheckouts } from "@/lib/accommodationCheckout";
import { byNameNatural } from "@/lib/naturalSort";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { StatTile } from "@/components/StatTile";
import { BedAllocationTable } from "./bed-allocation-table";

export const metadata = { title: "Bed allocation" };

export default async function BedAllocationPage() {
  const { user, branchId } = await requireUserWithBranch();
  await settleDueCheckouts(branchId, user);

  const checkIns = await prisma.campCheckIn.findMany({
    where: {
      status: { in: ["CHECKED_IN", "BED_ALLOCATED"] },
      camp: { ownerType: "OWN" },
      ...(branchId ? { employee: { branchId } } : {}),
    },
    include: {
      employee: { select: { id: true, name: true, employeeIdNo: true, nationality: true, photoMimeType: true, supplier: { select: { id: true, name: true } }, project: { select: { client: { select: { id: true, name: true } } } } } },
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
  const campChoicesRaw = await prisma.camp.findMany({
    where: { ...branchWhere(branchId), ownerType: "OWN" },
    select: { id: true, name: true, rooms: { select: { id: true, name: true, beds: { select: { id: true, label: true, employeeId: true } } }, orderBy: { name: "asc" } } },
    orderBy: { name: "asc" },
  });

  // Rooms in number order (2 before 10).
  const campChoices = campChoicesRaw.map((c) => ({ ...c, rooms: byNameNatural(c.rooms) }));

  const [suppliers, clients] = await Promise.all([
    prisma.supplier.findMany({ where: branchWhere(branchId), select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.client.findMany({ where: branchWhere(branchId), select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const rows = checkIns.map((c) => ({
    checkInId: c.id,
    checkInNo: c.checkInNo,
    employeeName: c.employee.name,
    employeeIdNo: c.employee.employeeIdNo,
    employeeRecordId: c.employee.id,
    employeeHasPhoto: !!c.employee.photoMimeType,
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
  const allBeds = campChoices.flatMap((c) => c.rooms.flatMap((r) => r.beds));
  const vacant = allBeds.filter((b) => !b.employeeId).length;
  // The camp closest to full, so a crowded camp is noticed before it blocks a move.
  const fullest = campChoices
    .map((c) => { const beds = c.rooms.flatMap((r) => r.beds); return { name: c.name, pct: beds.length ? Math.round((beds.filter((b) => b.employeeId).length / beds.length) * 100) : 0 }; })
    .sort((a, b) => b.pct - a.pct)[0];
  const campCount = new Set(rows.map((r) => r.campId)).size;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Bed Allocation"
        description="Where everyone sleeps. Move a worker to another room or camp in two clicks."
        meta={<span className="tabular rounded-md bg-surface-sunken px-1.5 py-0.5 text-xs font-medium text-secondary">{allocated} placed</span>}
        actions={<Link href="/accommodation/checkin" className="btn btn-secondary btn-sm">Check-In →</Link>}
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile label="Checked in" value={rows.length} hint={`across ${campCount} camp${campCount === 1 ? "" : "s"}`} />
        <StatTile label="Bed allocated" value={allocated} hint={awaiting === 0 && rows.length > 0 ? "everyone is placed" : undefined} />
        <StatTile label="Waiting for a bed" value={awaiting} tone={awaiting > 0 ? "warning" : "default"} hint={awaiting === 0 ? "nobody waiting" : "need a bed"} />
        <StatTile label="Vacant beds" value={<>{vacant} <span className="text-sm font-normal text-muted">of {allBeds.length}</span></>} hint={fullest && fullest.pct >= 80 ? `fullest: ${fullest.name} · ${fullest.pct}%` : undefined} tone={fullest && fullest.pct >= 95 ? "warning" : "default"} />
      </div>

      <BedAllocationTable rows={rows} camps={campChoices} suppliers={suppliers} clients={clients} />
    </div>
  );
}
