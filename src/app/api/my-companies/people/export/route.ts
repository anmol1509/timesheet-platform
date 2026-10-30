import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { canMyCompanies } from "@/lib/permissions";
import { PARTY_ROLE_LABEL } from "@/lib/documentTypes";
import { loadPeopleRegister } from "@/lib/peopleRegister";
import { problemLabels } from "@/lib/peopleFlags";

function addSheet(wb: ExcelJS.Workbook, name: string, headings: string[], widths: number[], rows: (string | number)[][]) {
  const ws = wb.addWorksheet(name);
  const head = ws.addRow(headings);
  head.font = { bold: true };
  head.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDEBFB" } }; });
  ws.views = [{ state: "frozen", ySplit: 1 }];
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  for (const r of rows) ws.addRow(r);
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headings.length } };
}

/** The owners and sponsors register as a workbook: one row per person, and one row per person-and-company link. */
export async function GET(request: Request) {
  const { user, branchId } = await requireUserWithBranch();
  if (!canMyCompanies(subjectOf(user))) return NextResponse.json({ error: "You don't have access to My Companies." }, { status: 403 });
  const people = await loadPeopleRegister(branchId);

  const wb = new ExcelJS.Workbook();
  addSheet(
    wb,
    "People",
    ["Name", "Nationality", "Phone", "Companies linked", "Roles and companies", "Files on record", "Expired", "Expiring soon", "Required missing", "Without expiry", "Next expiry in (days)", "Status"],
    [28, 16, 18, 12, 60, 10, 9, 12, 14, 14, 14, 44],
    people.map((p) => [
      p.name, p.nationality ?? "", p.phone ?? "", p.companyCount,
      p.companies.map((c) => `${PARTY_ROLE_LABEL[c.role] ?? c.role}${c.percent != null ? ` ${c.percent}%` : ""} of ${c.name}`).join("; "),
      p.docs, p.flags.expired, p.flags.expiring, p.flags.missing, p.flags.noExpiry, p.nextDays ?? "",
      problemLabels(p).join("; ") || "In order",
    ]),
  );
  addSheet(
    wb,
    "By company",
    ["Company", "Person", "Role", "Share %", "Nationality", "Phone", "Document status"],
    [34, 28, 12, 9, 16, 18, 44],
    people
      .flatMap((p) => p.companies.map((c) => [c.name, p.name, PARTY_ROLE_LABEL[c.role] ?? c.role, c.percent ?? "", p.nationality ?? "", p.phone ?? "", problemLabels(p).join("; ") || "In order"] as (string | number)[]))
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])) || String(a[1]).localeCompare(String(b[1]))),
  );
  const stamp = new Date().toISOString().slice(0, 10);
  // A CSV holds one table, so it is the People sheet.
  if (new URL(request.url).searchParams.get("format") === "csv") {
    const csv = Buffer.from(await wb.csv.writeBuffer({ sheetName: "People" }));
    return new NextResponse(new Uint8Array(csv), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="owners-and-sponsors-${stamp}.csv"` } });
  }
  const buf = Buffer.from(await wb.xlsx.writeBuffer());
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="owners-and-sponsors-${stamp}.xlsx"`,
    },
  });
}
