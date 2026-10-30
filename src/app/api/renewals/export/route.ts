import { canSeeRenewal } from "@/lib/renewalAccess";
import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getRenewals, type RenewalItem } from "@/lib/renewals";
import { renewalKey, renewalStatusLabel, type RenewalRef } from "@/lib/renewalCases";

const dmy = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

/**
 * One sheet to hand to whoever processes the renewals (the PRO): who, which document, its number and expiry, and what
 * is already in hand. The renewals are looked up again here from the keys sent, so only this branch's current
 * renewals can appear and the details always come from the records, not from the browser.
 */
const KIND_LABEL: Record<RenewalItem["kind"], string> = { employee: "Employee", supplier: "Supplier", party: "Owner / sponsor", vehicle: "Vehicle", record: "Record" };

export async function POST(request: Request) {
  const { user, branchId } = await requireUserWithBranch();
  if (!can(subjectOf(user), "workforce.renewals", "export")) return NextResponse.json({ error: "You don't have permission to export renewals." }, { status: 403 });
  const body = (await request.json().catch(() => null)) as { refs?: RenewalRef[] } | null;
  const wanted = new Set((body?.refs ?? []).filter((r) => r && typeof r.subjectId === "string" && typeof r.expiry === "string").map((r) => renewalKey(r)));
  if (wanted.size === 0) return NextResponse.json({ error: "Choose at least one renewal." }, { status: 400 });

  const subject = subjectOf(user);
  const items = (await getRenewals(branchId)).filter((i) => wanted.has(renewalKey(i)) && canSeeRenewal(subject, i));
  if (items.length === 0) return NextResponse.json({ error: "None of those renewals are due any more." }, { status: 404 });

  const employeeIds = [...new Set(items.filter((i) => i.kind === "employee").map((i) => i.subjectId))];
  const supplierIds = [...new Set(items.filter((i) => i.kind === "supplier").map((i) => i.subjectId))];
  const [employees, suppliers, cases] = await Promise.all([
    prisma.employee.findMany({ where: { id: { in: employeeIds } }, select: { id: true, nationality: true, passportNumber: true, emiratesId: true, visaNumber: true, laborCardNumber: true, mobileNumber: true } }),
    prisma.supplier.findMany({ where: { id: { in: supplierIds } }, select: { id: true, tradeLicenseNumber: true, contactPhone: true } }),
    prisma.renewalCase.findMany({ where: { OR: items.map((i) => ({ kind: i.kind, subjectId: i.subjectId, document: i.document, expiry: new Date(`${i.expiry.slice(0, 10)}T00:00:00Z`) })) }, include: { owner: { select: { name: true } } } }),
  ]);
  const emp = new Map(employees.map((e) => [e.id, e]));
  const sup = new Map(suppliers.map((s) => [s.id, s]));
  const caseOf = new Map(cases.map((c) => [renewalKey({ kind: c.kind as RenewalItem["kind"], subjectId: c.subjectId, document: c.document, expiry: c.expiry.toISOString() }), c]));

  const docNumber = (i: (typeof items)[number]) => {
    if (i.kind === "supplier") return sup.get(i.subjectId)?.tradeLicenseNumber ?? "";
    const e = emp.get(i.subjectId);
    if (!e) return "";
    return i.document === "Visa" ? e.visaNumber ?? "" : i.document === "Labour Card" ? e.laborCardNumber ?? "" : i.document === "Passport" ? e.passportNumber ?? "" : i.document === "Emirates ID" ? e.emiratesId ?? "" : "";
  };

  // Grouped by document type, soonest first within each.
  const sorted = [...items].sort((a, b) => a.document.localeCompare(b.document) || a.days - b.days);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Renewals");
  const columns: [string, number][] = [["Document", 20], ["Name", 28], ["ID", 14], ["Belongs to", 14], ["Nationality", 16], ["Passport no.", 16], ["Emirates ID", 22], ["Document no.", 20], ["Expires", 13], ["Days left", 10], ["Status", 14], ["Owner", 18], ["Note", 36], ["Project", 30], ["Supplier", 26], ["Mobile", 16]];
  const head = ws.addRow(columns.map(([h]) => h));
  head.font = { bold: true };
  head.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDEBFB" } }; });
  columns.forEach(([, w], n) => { ws.getColumn(n + 1).width = w; });
  ws.views = [{ state: "frozen", ySplit: 1 }];
  for (const i of sorted) {
    const e = i.kind === "employee" ? emp.get(i.subjectId) : undefined;
    const s = i.kind === "supplier" ? sup.get(i.subjectId) : undefined;
    const c = caseOf.get(renewalKey(i));
    const row = ws.addRow([
      i.document, i.subjectName, i.kind === "employee" ? i.subjectRef : "", KIND_LABEL[i.kind], e?.nationality ?? "", e?.passportNumber ?? "", e?.emiratesId ?? "",
      docNumber(i), dmy(i.expiry), i.days, renewalStatusLabel(c?.status ?? "NOT_STARTED"), c?.owner?.name ?? "", c?.note ?? "", i.project ?? "", i.supplier ?? "", e?.mobileNumber ?? s?.contactPhone ?? "",
    ]);
    if (i.days < 0) row.getCell(10).font = { color: { argb: "FFB42318" }, bold: true };
  }
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };

  const sum = wb.addWorksheet("Summary");
  sum.addRow(["Document", "Renewals", "Overdue"]).font = { bold: true };
  for (const doc of [...new Set(sorted.map((i) => i.document))]) {
    const of = sorted.filter((i) => i.document === doc);
    sum.addRow([doc, of.length, of.filter((i) => i.days < 0).length]);
  }
  sum.addRow(["Total", sorted.length, sorted.filter((i) => i.days < 0).length]).font = { bold: true };
  sum.getColumn(1).width = 26;

  const stamp = new Date().toISOString().slice(0, 10);
  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  return new NextResponse(buffer as unknown as BodyInit, {
    headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="renewals-${stamp}.xlsx"`, "Cache-Control": "private, no-store" },
  });
}
