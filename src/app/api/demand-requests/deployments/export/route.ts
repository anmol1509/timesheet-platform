import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { can } from "@/lib/permissions";
import { ON_WORK_STAGES } from "@/lib/employeeStage";
import { TARGETS } from "@/lib/importer/targets";

const STAGE_LABEL: Record<string, string> = { UNDER_MOBILISATION: "Under mobilisation", ON_SITE: "On site", ACTIVE: "Active" };
const dmy = (d: Date | null) => (d ? `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}` : "");

/** Current deployments in the layout the Mobilisation import reads, so the file can be edited and uploaded again. */
export async function GET() {
  const { user, branchId } = await requireUserWithBranch();
  if (!can(subjectOf(user), "demand", "export")) return NextResponse.json({ error: "You don't have permission to export demand data." }, { status: 403 });
  const people = await prisma.employee.findMany({
    where: { ...branchWhere(branchId), active: true, projectId: { not: null }, status: { in: [...ON_WORK_STAGES] } },
    select: { name: true, employeeIdNo: true, trade: true, mobileNumber: true, status: true, mobilisationDate: true, siteArrivalDate: true, project: { select: { code: true, name: true, client: { select: { name: true } } } } },
    orderBy: { name: "asc" },
  });

  const fields = TARGETS.MOBILISATION.fields;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Mobilisation");
  const head = ws.addRow(fields.map((f) => f.label));
  head.font = { bold: true };
  head.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDEBFB" } }; });
  ws.views = [{ state: "frozen", ySplit: 1 }];
  fields.forEach((f, i) => { ws.getColumn(i + 1).width = Math.max(16, Math.min(34, f.label.length + 8)); });
  for (const p of people) {
    const row: Record<string, string> = {
      employee: p.name, employeeCode: p.employeeIdNo, client: p.project?.client?.name ?? "", project: p.project?.name ?? "",
      stage: STAGE_LABEL[p.status] ?? p.status, mobilisedOn: dmy(p.mobilisationDate), arrivedOn: dmy(p.siteArrivalDate), trade: p.trade ?? "", mobile: p.mobileNumber ?? "",
    };
    ws.addRow(fields.map((f) => row[f.key] ?? ""));
  }
  const notes = wb.addWorksheet("Notes");
  notes.addRow(["This file is in the Mobilisation import layout: edit it and upload it with Import data → Mobilisation. Workers are matched by employee code, then by name."]);
  notes.getColumn(1).width = 110;

  const stamp = new Date().toISOString().slice(0, 10);
  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="deployments-${stamp}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
