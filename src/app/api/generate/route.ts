import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { prisma } from "@/lib/db";
import { getSupplierMonthEntries, monthLabelFromKey } from "@/lib/timesheetSummary";
import { generateSupplierXlsx } from "@/lib/generateXlsx";
import {
  generateTimesheetPdf,
} from "@/lib/generateTimesheetPdf";
import { resolveIssuer } from "@/lib/issuer";
import { letterheadContactLine } from "@/lib/letterhead";
import { absenceRuleOf, clientAbsenceRule, startingAbsentDeduction } from "@/lib/deductions";
import { resolveTemplate, maskLetterhead, standardExtras } from "@/lib/timesheetTemplateApply";
import { generateTemplatedPdf, generateTemplatedXlsx } from "@/lib/generateTemplatedTimesheet";

const bodySchema = z.object({
  supplierId: z.string().min(1),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  format: z.enum(["xlsx", "pdf"]),
  template: z.string().max(80).default("standard"),
  gasDeductions: z.record(z.string(), z.number()),
  deductions: z.record(z.string(), z.number()),
  /** The own company whose header and logo the sheet carries; absent or null = the branch's own details. */
  issuerId: z.string().max(80).nullish(),
});

export async function POST(request: Request) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { supplierId, month, format, template: templateValue, gasDeductions, deductions, issuerId } = parsed.data;
  const gasDeduction = Object.values(gasDeductions).reduce((s, v) => s + (v || 0), 0);

  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId },
    include: { parent: { select: { name: true, fullName: true, mohrePermitNumber: true } } },
  });
  if (!supplier || isOutsideBranch(supplier.branchId, branchId, isSuperAdmin)) {
    return NextResponse.json({ error: "Company not found." }, { status: 404 });
  }
  if (supplier.invoiceApprovalStatus !== "Approved") {
    // Naming the supplier and where to change it — the bare message left you
    // guessing which of the two approval fields was blocking, and where.
    return NextResponse.json(
      {
        error: `${supplier.name} is not invoice-approved (currently ${
          supplier.invoiceApprovalStatus || "unset"
        }). Set Invoice Approval to Approved on the supplier's Overview tab.`,
        supplierId: supplier.id,
      },
      { status: 400 }
    );
  }

  if (!branchId) {
    return NextResponse.json(
      {
        error: isSuperAdmin
          ? "Pick a branch from the switcher before generating a timesheet."
          : "Your account has no branch assigned — contact an admin.",
      },
      { status: 400 }
    );
  }

  const chosen = await resolveTemplate(templateValue, branchId, isSuperAdmin);
  if (!chosen) return NextResponse.json({ error: "That template isn't available any more. Pick another one." }, { status: 400 });
  const template = chosen.base;
  const cfg = chosen.config;

  const entryIds = Object.keys(deductions);
  const owned = await prisma.timesheetEntry.count({
    where: { id: { in: entryIds }, supplierId, month },
  });
  if (owned !== entryIds.length) {
    return NextResponse.json({ error: "Deduction data mismatch." }, { status: 400 });
  }

  await Promise.all(
    entryIds.map((id) =>
      prisma.timesheetEntry.update({
        where: { id },
        data: { absentDeduction: deductions[id] },
      })
    )
  );

  // Nothing to type on this screen any more: the supplier's own name goes on
  // the Excel, the branch it bills is "Issued To", and the PDF's sub-contractor
  // is the main (parent) supplier, or the supplier itself when it has no parent.
  const fullName = supplier.fullName || supplier.name;
  const issuer = await resolveIssuer({ branchId, isSuperAdmin, companyId: issuerId, fallbackName: fullName });
  if ("error" in issuer) return NextResponse.json({ error: issuer.error }, { status: 400 });
  const issuedTo = issuer.issuedTo;
  const mainSupplier = supplier.parent ?? supplier;
  const subContractor = mainSupplier.fullName || mainSupplier.name;

  const entries = await getSupplierMonthEntries(supplierId, month);
  if (entries.length === 0) {
    return NextResponse.json({ error: "No employees for this month." }, { status: 404 });
  }

  // Timesheet rows are matched to the roster by employee ID so a project can
  // be resolved for uploads that carry none.
  const rosterProjects = await prisma.employee.findMany({
    where: { employeeIdNo: { in: entries.map((e) => e.employeeIdNo) } },
    select: { employeeIdNo: true, project: { select: { code: true } } },
  });
  const projectByEmployeeId = new Map(
    rosterProjects
      .filter((r) => r.project)
      .map((r) => [r.employeeIdNo, r.project!.code] as const)
  );

  const monthLabel = monthLabelFromKey(month);
  const genInput = {
    fullName,
    monthLabel,
    issuedTo,
    gasDeduction,
    entries: entries.map((e) => ({
      employeeIdNo: e.employeeIdNo,
      employeeName: e.employeeName,
      trade: e.trade,
      rate: e.rate,
      dailyHours: e.dailyHours,
      absentDeduction: deductions[e.id] ?? startingAbsentDeduction(e.absentDeduction, e.absentCount, absenceRuleOf(supplier), clientAbsenceRule(e.client)),
    })),
  };

  let buffer: Buffer;
  let contentType: string;
  if (template !== "standard") {
    const [year, monthNo] = month.split("-").map(Number);
    const lastDay = new Date(Date.UTC(year, monthNo, 0)).getUTCDate();
    const dmy = (day: number) => `${String(day).padStart(2, "0")}/${String(monthNo).padStart(2, "0")}/${year}`;
    const input = {
      template,
      config: cfg,
      letterhead: issuer.letterhead,
      xlsxLogo: issuer.xlsxLogo,
      subContractor,
      monthLabel,
      periodFrom: dmy(1),
      periodTo: dmy(lastDay),
      issuedTo,
      entries: genInput.entries.map((e, i) => ({ ...e, projectCode: entries[i]?.project?.code ?? projectByEmployeeId.get(e.employeeIdNo) ?? null })),
      gasDeduction,
      vatPercent: 5,
      preparedBy: user.name,
    };
    if (format === "xlsx") {
      buffer = await generateTemplatedXlsx(input);
      contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    } else {
      buffer = await generateTemplatedPdf(input);
      contentType = "application/pdf";
    }
  } else if (format === "xlsx") {
    buffer = await generateSupplierXlsx({ ...genInput, titleText: cfg?.title || undefined, logo: issuer.xlsxLogo, contactLine: issuer.companyId ? letterheadContactLine(maskLetterhead(issuer.letterhead, cfg)) : null });
    contentType =
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  } else {
    // The PDF now follows the letterhead format the client's contractors issue
    // and accept; the XLSX above is unchanged.
    const [year, monthNo] = month.split("-").map(Number);
    const lastDay = new Date(Date.UTC(year, monthNo, 0)).getUTCDate();
    const dmy = (day: number) =>
      `${String(day).padStart(2, "0")}/${String(monthNo).padStart(2, "0")}/${year}`;

    buffer = await generateTimesheetPdf({
      letterhead: maskLetterhead(issuer.letterhead, cfg),
      subContractor,
      subContractorCode: mainSupplier.mohrePermitNumber ?? null,
      periodFrom: dmy(1),
      periodTo: dmy(lastDay),
      entries: genInput.entries.map((e, i) => ({
        ...e,
        // The entry's own project first; Excel uploads have none, so fall back
        // to the project the worker is currently deployed on.
        projectCode:
          entries[i]?.project?.code ?? projectByEmployeeId.get(e.employeeIdNo) ?? null,
      })),
      additions: 0,
      gasDeduction: gasDeduction,
      otherDeduction: 0,
      ...standardExtras(cfg, 5),
      preparedBy: user.name,
      preparedByRole: null,
      // Left blank so the verifier signs by hand; preparing and verifying are
      // deliberately not the same person.
      verifiedBy: null,
      verifiedByRole: null,
      approvedBy: null,
      approvedByRole: null,
    });
    contentType = "application/pdf";
  }

  await prisma.generatedSheet.create({
    data: {
      month,
      monthLabel,
      format,
      gasDeduction,
      issuedTo,
      supplierId,
      issuedCompanyId: issuer.companyId,
      generatedById: user.id,
      branchId,
    },
  });

  const safeName = supplier.name.replace(/[^a-z0-9]+/gi, "-");
  const filename = `${safeName}-${month}${templateValue === "standard" ? "" : `-${chosen.name.replace(/[^a-z0-9]+/gi, "-")}`}.${format}`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
