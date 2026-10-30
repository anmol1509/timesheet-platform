import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { canMyCompanies } from "@/lib/permissions";
import { TARGETS } from "@/lib/importer/targets";

const day = (d: Date | null | undefined) => (d ? `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}` : "");

/** The company's own companies as a workbook with the same headings as the import template, so it can be edited and imported back. */
export async function GET(request: Request) {
  const { user, branchId } = await requireUserWithBranch();
  if (!canMyCompanies(subjectOf(user))) return NextResponse.json({ error: "You don't have access to My Companies." }, { status: 403 });
  const companies = await prisma.supplier.findMany({
    where: { ...branchWhere(branchId), isOwnCompany: true },
    orderBy: { name: "asc" },
    include: { parent: { select: { name: true } }, partyLinks: { orderBy: { createdAt: "asc" }, include: { party: { select: { name: true } } } } },
  });
  const fields = TARGETS.COMPANIES.fields;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("My Companies");
  const head = ws.addRow(fields.map((f) => f.label));
  head.font = { bold: true };
  head.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDEBFB" } }; });
  ws.views = [{ state: "frozen", ySplit: 1 }];
  fields.forEach((f, i) => { ws.getColumn(i + 1).width = Math.max(16, Math.min(34, f.label.length + 8)); });
  for (const c of companies) {
    const owners = c.partyLinks.filter((l) => l.role === "OWNER");
    const sponsors = c.partyLinks.filter((l) => l.role === "SPONSOR");
    const v: Record<string, string> = {
      name: c.name, code: c.code ?? "", fullName: c.fullName ?? "", parent: c.parent?.name ?? "", trn: c.trn ?? "",
      activeFrom: day(c.activeFrom), tradeLicenseNumber: c.tradeLicenseNumber ?? "", tradeLicenseExpiry: day(c.tradeLicenseExpiry),
      mohrePermitNumber: c.mohrePermitNumber ?? "", country: c.country ?? "", emirate: c.emirate ?? "", location: c.location ?? "", poBox: c.poBox ?? "",
      phone: c.phone ?? "", contactEmail: c.contactEmail ?? "", contactPerson: c.contactPerson ?? "", contactPhone: c.contactPhone ?? "",
      signatoryName: c.signatoryName ?? "", signatoryTitle: c.signatoryTitle ?? "",
    };
    owners.slice(0, 3).forEach((o, i) => { v[`owner${i + 1}`] = o.party.name; v[`owner${i + 1}Percent`] = o.ownershipPercent == null ? "" : String(o.ownershipPercent); });
    sponsors.slice(0, 2).forEach((s, i) => { v[`sponsor${i + 1}`] = s.party.name; });
    ws.addRow(fields.map((f) => v[f.key] ?? ""));
  }
  const stamp = new Date().toISOString().slice(0, 10);
  if (new URL(request.url).searchParams.get("format") === "csv") {
    const csv = Buffer.from(await wb.csv.writeBuffer());
    return new NextResponse(new Uint8Array(csv), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="my-companies-${stamp}.csv"` } });
  }
  const buf = Buffer.from(await wb.xlsx.writeBuffer());
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="my-companies-${stamp}.xlsx"`,
    },
  });
}
