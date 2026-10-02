import { NextResponse } from "next/server";
import JSZip from "jszip";
import { z } from "zod";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { prisma } from "@/lib/db";
import { getSupplierMonthEntries, monthLabelFromKey } from "@/lib/timesheetSummary";
import { generateTimesheetPdf, DEFAULT_TIMESHEET_NOTES } from "@/lib/generateTimesheetPdf";
import { buildLetterhead } from "@/lib/letterhead";
import { TEMPLATE_KEYS } from "@/lib/timesheetTemplates";
import { generateTemplatedPdf } from "@/lib/generateTemplatedTimesheet";
import { calculateGasDeduction, gasRuleOf } from "@/lib/deductions";

export const maxDuration = 60;

const bodySchema = z.object({
  supplierIds: z.array(z.string().min(1)).min(1).max(60),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  /** supplierId → true when that company's gas charge is waived. A company not listed is charged. */
  gasWaived: z.record(z.string(), z.boolean()).default({}),
  template: z.enum(TEMPLATE_KEYS).default("standard"),
  /** When set, only these employees (by employee ID number) appear on the sheets. */
  employeeIds: z.array(z.string().min(1)).max(500).optional(),
  /** With employeeIds: one sheet per person instead of one per company. */
  perEmployee: z.boolean().default(false),
  /** With employeeIds: one sheet holding every selected person, across all their companies. */
  combined: z.boolean().default(false),
});

/**
 * One PDF per selected company, zipped. Each sheet uses what's already saved
 * (absence deductions, the company's letterhead name) and the gas charge the
 * review screen opens with, unless the company is waived. Companies that can't be
 * generated (not invoice-approved, no hours that month) are left out and listed
 * in a note inside the zip instead of failing the whole download.
 */
export async function POST(request: Request) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { supplierIds, month, gasWaived, template, employeeIds, perEmployee, combined } = parsed.data;
  if (!branchId) {
    return NextResponse.json(
      { error: isSuperAdmin ? "Pick a branch from the switcher first." : "Your account has no branch assigned — contact an admin." },
      { status: 400 },
    );
  }

  const [suppliers, branch] = await Promise.all([
    prisma.supplier.findMany({ where: { id: { in: supplierIds } }, include: { parent: { select: { name: true, fullName: true, mohrePermitNumber: true } } }, orderBy: { name: "asc" } }),
    prisma.branch.findUnique({ where: { id: branchId } }),
  ]);
  const mine = suppliers.filter((s) => !isOutsideBranch(s.branchId, branchId, isSuperAdmin));
  if (mine.length === 0) return NextResponse.json({ error: "Companies not found." }, { status: 404 });

  const [year, monthNo] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthNo, 0)).getUTCDate();
  const dmy = (day: number) => `${String(day).padStart(2, "0")}/${String(monthNo).padStart(2, "0")}/${year}`;
  const letterhead = await buildLetterhead({
    name: branch?.name ?? "",
    address: branch?.address ?? null,
    emirate: branch?.emirate ?? null,
    country: branch?.country ?? null,
    phone: branch?.phone ?? null,
    fax: branch?.fax ?? null,
    email: branch?.email ?? null,
    poBox: branch?.poBox ?? null,
    trn: branch?.trn ?? null,
  });
  const issuedTo = branch?.issuedTo || branch?.name || "";
  const monthLabel = monthLabelFromKey(month);

  type Entry = Awaited<ReturnType<typeof getSupplierMonthEntries>>[number];
  const makePdf = async (a: { list: Entry[]; gasTotal: number; subContractor: string; subContractorCode: string | null; projectById: Map<string, string>; issuedToName: string }) => {
    const { list, gasTotal, subContractor, subContractorCode, projectById, issuedToName } = a;
    return template !== "standard" ? await generateTemplatedPdf({
      template,
      letterhead,
      subContractor,
      monthLabel,
      periodFrom: dmy(1),
      periodTo: dmy(lastDay),
      issuedTo: issuedToName,
      entries: list.map((e) => ({
        employeeIdNo: e.employeeIdNo,
        employeeName: e.employeeName,
        trade: e.trade,
        rate: e.rate,
        dailyHours: e.dailyHours,
        absentDeduction: e.absentDeduction,
        projectCode: e.project?.code ?? projectById.get(e.employeeIdNo) ?? null,
      })),
      gasDeduction: gasTotal,
      vatPercent: 5,
      preparedBy: user.name,
    }) : await generateTimesheetPdf({
      letterhead,
      // The main (parent) supplier, or the supplier itself when it has none.
      subContractor,
      subContractorCode,
      periodFrom: dmy(1),
      periodTo: dmy(lastDay),
      entries: list.map((e) => ({
        employeeIdNo: e.employeeIdNo,
        employeeName: e.employeeName,
        trade: e.trade,
        rate: e.rate,
        dailyHours: e.dailyHours,
        absentDeduction: e.absentDeduction,
        projectCode: e.project?.code ?? projectById.get(e.employeeIdNo) ?? null,
      })),
      additions: 0,
      safetyDeduction: gasTotal,
      otherDeduction: 0,
      vatPercent: 5,
      preparedBy: user.name,
      preparedByRole: null,
      verifiedBy: null,
      verifiedByRole: null,
      approvedBy: null,
      approvedByRole: null,
      notes: DEFAULT_TIMESHEET_NOTES,
    });
  };

  const zip = new JSZip();
  const skipped: string[] = [];
  const usedNames = new Set<string>();
  const combinedParts: { supplier: (typeof mine)[number]; list: Entry[]; gasTotal: number }[] = [];
  const combinedProjects = new Map<string, string>();

  for (const supplier of mine) {
    if (supplier.invoiceApprovalStatus !== "Approved") {
      skipped.push(`${supplier.name} — not invoice-approved (currently ${supplier.invoiceApprovalStatus || "unset"})`);
      continue;
    }
    const allEntries = await getSupplierMonthEntries(supplier.id, month);
    const entries = employeeIds ? allEntries.filter((e) => employeeIds.includes(e.employeeIdNo)) : allEntries;
    if (entries.length === 0) {
      skipped.push(`${supplier.name} — ${employeeIds ? "none of the selected employees have hours this month" : "no employees this month"}`);
      continue;
    }

    const issuedToName = issuedTo || supplier.name;
    const roster = await prisma.employee.findMany({
      where: { employeeIdNo: { in: entries.map((e) => e.employeeIdNo) } },
      select: { employeeIdNo: true, siteArrivalDate: true, project: { select: { code: true } } },
    });
    const projectById = new Map(roster.filter((r) => r.project).map((r) => [r.employeeIdNo, r.project!.code] as const));
    const checkInById = new Map(roster.map((r) => [r.employeeIdNo, r.siteArrivalDate] as const));
    const waived = gasWaived[supplier.id] === true;
    // Gas: the company's rate from each worker's check-in date, capped per worker per month; nothing when waived.
    const gasFor = (list: typeof entries) =>
      waived ? 0 : list.reduce((sum, e) => sum + calculateGasDeduction(e.dailyHours, gasRuleOf(supplier), { checkIn: checkInById.get(e.employeeIdNo) ?? null, month }), 0);
    const render = async (list: typeof entries) => {
      const gasTotal = gasFor(list);
      const pdf = await makePdf({ list, gasTotal, subContractor: (supplier.parent ?? supplier).fullName || (supplier.parent ?? supplier).name, subContractorCode: (supplier.parent ?? supplier).mohrePermitNumber ?? null, projectById, issuedToName });
      return { pdf, gasTotal };
    };

    if (combined && employeeIds) {
      for (const e of entries) { const code = projectById.get(e.employeeIdNo); if (code) combinedProjects.set(e.employeeIdNo, code); }
      combinedParts.push({ supplier, list: entries, gasTotal: gasFor(entries) });
      continue;
    }

    const groups = employeeIds && perEmployee ? entries.map((e) => ({ list: [e], tag: e.employeeIdNo })) : [{ list: entries, tag: "" }];
    for (const g of groups) {
      const { pdf, gasTotal } = await render(g.list);
      let base = `${supplier.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "company"}-${month}${g.tag ? `-${g.tag.replace(/[^a-z0-9]+/gi, "-")}` : ""}`;
      for (let n = 2; usedNames.has(base); n++) base = `${base.replace(/-\d+$/, "")}-${n}`;
      usedNames.add(base);
      zip.file(`${base}.pdf`, pdf);
      await prisma.generatedSheet.create({
        data: { month, monthLabel, format: "pdf", gasDeduction: gasTotal, issuedTo, supplierId: supplier.id, generatedById: user.id, branchId },
      });
    }
  }

  if (combined && combinedParts.length > 0) {
    const names = combinedParts.map((p) => (p.supplier.parent ?? p.supplier).fullName || (p.supplier.parent ?? p.supplier).name);
    const distinct = [...new Set(names)];
    const list = combinedParts.flatMap((p) => p.list).sort((x, y) => x.employeeName.localeCompare(y.employeeName));
    const gasTotal = combinedParts.reduce((sum, p) => sum + p.gasTotal, 0);
    const pdf = await makePdf({
      list, gasTotal,
      subContractor: distinct.length === 1 ? distinct[0] : `Selected employees (${distinct.length} suppliers)`,
      subContractorCode: distinct.length === 1 ? (combinedParts[0].supplier.parent ?? combinedParts[0].supplier).mohrePermitNumber ?? null : null,
      projectById: combinedProjects,
      issuedToName: issuedTo || combinedParts[0].supplier.name,
    });
    usedNames.add("selected");
    zip.file(`timesheet-selected-employees-${month}.pdf`, pdf);
    await prisma.generatedSheet.create({
      data: { month, monthLabel, format: "pdf", gasDeduction: gasTotal, issuedTo, supplierId: combinedParts[0].supplier.id, generatedById: user.id, branchId },
    });
  }

  if (usedNames.size === 0) {
    return NextResponse.json(
      { error: `Nothing could be generated.\n${skipped.map((s) => `• ${s}`).join("\n")}` },
      { status: 400 },
    );
  }
  if (skipped.length > 0) {
    zip.file("NOT-GENERATED.txt", `These companies were left out of ${monthLabel}:\n\n${skipped.map((s) => `- ${s}`).join("\n")}\n`);
  }
  if (combined && combinedParts.length > 0) {
    const only = zip.file(/\.pdf$/)[0];
    return new NextResponse((await only.async("uint8array")) as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="timesheet-selected-employees-${month}.pdf"`,
        "X-Skipped": String(skipped.length),
      },
    });
  }
  const buffer = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="timesheets-${month}.zip"`,
      "X-Skipped": String(skipped.length),
    },
  });
}
