import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { can } from "@/lib/permissions";
import { compareNatural } from "@/lib/naturalSort";
import { TARGETS } from "@/lib/importer/targets";

const STATUS_LABEL: Record<string, string> = { ACTIVE: "Active", MAINTENANCE: "Maintenance", INACTIVE: "Inactive" };
const dmy = (d: Date | null) => (d ? `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}` : "");

/** Every vehicle in the layout the vehicle import reads, so the file can be edited and uploaded again. */
export async function GET() {
  const { user, branchId } = await requireUserWithBranch();
  if (!can(subjectOf(user), "facilities", "export")) return NextResponse.json({ error: "You don't have permission to export facilities data." }, { status: 403 });
  const vehicles = (await prisma.vehicle.findMany({ where: branchWhere(branchId) })).sort((a, b) => compareNatural(a.plateNumber, b.plateNumber));

  const fields = TARGETS.VEHICLES.fields;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Vehicles");
  const head = ws.addRow(fields.map((f) => f.label));
  head.font = { bold: true };
  head.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDEBFB" } }; });
  ws.views = [{ state: "frozen", ySplit: 1 }];
  fields.forEach((f, i) => { ws.getColumn(i + 1).width = Math.max(16, Math.min(34, f.label.length + 8)); });
  for (const v of vehicles) {
    const row: Record<string, string | number> = {
      plateNumber: v.plateNumber, type: v.type ?? "", capacity: v.capacity ?? "", status: STATUS_LABEL[v.status] ?? v.status,
      driverName: v.driverName ?? "", driverPhone: v.driverPhone ?? "", registrationExpiry: dmy(v.registrationExpiry), insuranceExpiry: dmy(v.insuranceExpiry), notes: v.notes ?? "",
    };
    ws.addRow(fields.map((f) => row[f.key] ?? ""));
  }
  const notes = wb.addWorksheet("Notes");
  notes.addRow(["This file is in the Vehicles import layout: edit it and upload it with Import data → Vehicles. Vehicles are matched by plate number."]);
  notes.getColumn(1).width = 110;

  const stamp = new Date().toISOString().slice(0, 10);
  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="vehicles-${stamp}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
