import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { can } from "@/lib/permissions";
import { TARGETS } from "@/lib/importer/targets";

/**
 * Every camp, room and bed in the same layout the camp import reads, so the file can be
 * edited and uploaded again. Occupants are included unless ?workers=0 (a layout-only copy).
 */
export async function GET(request: Request) {
  const { user, branchId } = await requireUserWithBranch();
  if (!can(subjectOf(user), "facilities", "export")) return NextResponse.json({ error: "You don't have permission to export facilities data." }, { status: 403 });
  const q = new URL(request.url).searchParams;
  const withWorkers = q.get("workers") !== "0";
  const campId = q.get("camp");

  const camps = await prisma.camp.findMany({
    where: { ...branchWhere(branchId), ...(campId ? { id: campId } : {}) },
    orderBy: { name: "asc" },
    include: {
      owningSupplier: { select: { name: true } },
      owningClient: { select: { name: true } },
      rooms: { orderBy: { name: "asc" }, include: { beds: { orderBy: { label: "asc" }, include: { employee: { select: { name: true, employeeIdNo: true } } } } } },
    },
  });

  const fields = TARGETS.CAMPS.fields;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Camps");
  const head = ws.addRow(fields.map((f) => f.label));
  head.font = { bold: true };
  head.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDEBFB" } }; });
  ws.views = [{ state: "frozen", ySplit: 1 }];
  fields.forEach((f, i) => { ws.getColumn(i + 1).width = Math.max(16, Math.min(34, f.label.length + 8)); });

  const typeLabel = (t: string) => (t === "SUPPLIER" ? "Supplier" : t === "CLIENT" ? "Client" : "Own");
  const add = (v: Record<string, string | number>) => ws.addRow(fields.map((f) => v[f.key] ?? ""));
  for (const c of camps) {
    const base = { camp: c.name, campType: typeLabel(c.ownerType), owner: c.owningSupplier?.name ?? c.owningClient?.name ?? "" };
    if (c.rooms.length === 0) { add(base); continue; }
    for (const r of c.rooms) {
      const roomBase = { ...base, room: r.name, roomType: r.roomType ?? "", nationality: r.nationality ?? "" };
      const occupied = withWorkers ? r.beds.filter((b) => b.employee) : [];
      if (occupied.length === 0) { add({ ...roomBase, beds: r.beds.length || (r.bedSpace ?? "") }); continue; }
      // The bed count goes on the room's first line only, so re-importing doesn't repeat it.
      occupied.forEach((b, i) => add({ ...roomBase, beds: i === 0 ? r.beds.length : "", employee: b.employee!.name, employeeCode: b.employee!.employeeIdNo, bed: b.label }));
    }
  }

  const notes = wb.addWorksheet("Notes");
  notes.addRow(["This file is in the Camps import layout: edit it and upload it with Import data → Camps."]);
  notes.addRow(["Beds are only added, never removed, and workers already in a bed are left where they are."]);
  notes.getColumn(1).width = 100;

  const stamp = new Date().toISOString().slice(0, 10);
  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="camps-${stamp}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
