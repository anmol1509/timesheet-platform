import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { prisma } from "@/lib/db";
import { getSupplierMonthEntries, monthLabelFromKey } from "@/lib/timesheetSummary";
import { generateSupplierXlsx } from "@/lib/generateXlsx";
import {
  generateTimesheetPdf,
  DEFAULT_TIMESHEET_NOTES,
} from "@/lib/generateTimesheetPdf";
import { buildLetterhead } from "@/lib/letterhead";

const bodySchema = z.object({
  supplierId: z.string().min(1),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  format: z.enum(["xlsx", "pdf"]),
  fullName: z.string().min(1),
  issuedTo: z.string().min(1),
  gasDeductions: z.record(z.string(), z.number()),
  deductions: z.record(z.string(), z.number()),
});

export async function POST(request: Request) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { supplierId, month, format, fullName, issuedTo, gasDeductions, deductions } =
    parsed.data;
  const gasDeduction = Object.values(gasDeductions).reduce((s, v) => s + (v || 0), 0);

  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier || isOutsideBranch(supplier.branchId, branchId, isSuperAdmin)) {
    return NextResponse.json({ error: "Company not found." }, { status: 404 });
  }
  if (supplier.invoiceApprovalStatus !== "Approved") {
    return NextResponse.json({ error: "This supplier isn't invoice-approved yet." }, { status: 400 });
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

  if (fullName !== (supplier.fullName || supplier.name)) {
    await prisma.supplier.update({ where: { id: supplierId }, data: { fullName } });
  }

  const entries = await getSupplierMonthEntries(supplierId, month);
  if (entries.length === 0) {
    return NextResponse.json({ error: "No employees for this month." }, { status: 404 });
  }

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
      absentDeduction: deductions[e.id] ?? e.absentDeduction,
    })),
  };

  let buffer: Buffer;
  let contentType: string;
  if (format === "xlsx") {
    buffer = await generateSupplierXlsx(genInput);
    contentType =
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  } else {
    // The PDF now follows the letterhead format the client's contractors issue
    // and accept; the XLSX above is unchanged.
    const branch = await prisma.branch.findUnique({ where: { id: branchId } });
    const [year, monthNo] = month.split("-").map(Number);
    const lastDay = new Date(Date.UTC(year, monthNo, 0)).getUTCDate();
    const dmy = (day: number) =>
      `${String(day).padStart(2, "0")}/${String(monthNo).padStart(2, "0")}/${year}`;

    buffer = await generateTimesheetPdf({
      letterhead: await buildLetterhead({
        name: branch?.name ?? fullName,
        address: branch?.address ?? null,
        emirate: branch?.emirate ?? null,
        country: branch?.country ?? null,
        phone: branch?.phone ?? null,
        fax: branch?.fax ?? null,
        email: branch?.email ?? null,
        poBox: branch?.poBox ?? null,
        trn: branch?.trn ?? null,
      }),
      subContractor: issuedTo,
      subContractorCode: supplier.mohrePermitNumber ?? null,
      periodFrom: dmy(1),
      periodTo: dmy(lastDay),
      entries: genInput.entries.map((e, i) => ({
        ...e,
        projectCode: entries[i]?.project?.code ?? null,
      })),
      additions: 0,
      safetyDeduction: gasDeduction,
      otherDeduction: 0,
      vatPercent: 5,
      preparedBy: user.name,
      preparedByRole: null,
      notes: DEFAULT_TIMESHEET_NOTES,
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
      generatedById: user.id,
      branchId,
    },
  });

  const safeName = supplier.name.replace(/[^a-z0-9]+/gi, "-");
  const filename = `${safeName}-${month}.${format}`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
