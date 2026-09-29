import { NextResponse } from "next/server";
import JSZip from "jszip";
import { z } from "zod";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { prisma } from "@/lib/db";
import { getSupplierMonthEntries, monthLabelFromKey } from "@/lib/timesheetSummary";
import { generateTimesheetPdf, DEFAULT_TIMESHEET_NOTES } from "@/lib/generateTimesheetPdf";
import { buildLetterhead } from "@/lib/letterhead";

export const maxDuration = 60;

const bodySchema = z.object({
  supplierIds: z.array(z.string().min(1)).min(1).max(60),
  month: z.string().regex(/^\d{4}-\d{2}$/),
});

/**
 * One PDF per selected company, zipped. Each sheet uses what's already saved
 * (absence deductions, the company's letterhead name) with no gas deduction —
 * the same defaults the review screen opens with. Companies that can't be
 * generated (not invoice-approved, no hours that month) are left out and listed
 * in a note inside the zip instead of failing the whole download.
 */
export async function POST(request: Request) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { supplierIds, month } = parsed.data;
  if (!branchId) {
    return NextResponse.json(
      { error: isSuperAdmin ? "Pick a branch from the switcher first." : "Your account has no branch assigned — contact an admin." },
      { status: 400 },
    );
  }

  const [suppliers, branch] = await Promise.all([
    prisma.supplier.findMany({ where: { id: { in: supplierIds } }, orderBy: { name: "asc" } }),
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

  const zip = new JSZip();
  const skipped: string[] = [];
  const usedNames = new Set<string>();

  for (const supplier of mine) {
    if (supplier.invoiceApprovalStatus !== "Approved") {
      skipped.push(`${supplier.name} — not invoice-approved (currently ${supplier.invoiceApprovalStatus || "unset"})`);
      continue;
    }
    const entries = await getSupplierMonthEntries(supplier.id, month);
    if (entries.length === 0) {
      skipped.push(`${supplier.name} — no employees this month`);
      continue;
    }
    const roster = await prisma.employee.findMany({
      where: { employeeIdNo: { in: entries.map((e) => e.employeeIdNo) } },
      select: { employeeIdNo: true, project: { select: { code: true } } },
    });
    const projectById = new Map(roster.filter((r) => r.project).map((r) => [r.employeeIdNo, r.project!.code] as const));

    const pdf = await generateTimesheetPdf({
      letterhead,
      subContractor: issuedTo,
      subContractorCode: supplier.mohrePermitNumber ?? null,
      periodFrom: dmy(1),
      periodTo: dmy(lastDay),
      entries: entries.map((e) => ({
        employeeIdNo: e.employeeIdNo,
        employeeName: e.employeeName,
        trade: e.trade,
        rate: e.rate,
        dailyHours: e.dailyHours,
        absentDeduction: e.absentDeduction,
        projectCode: e.project?.code ?? projectById.get(e.employeeIdNo) ?? null,
      })),
      additions: 0,
      safetyDeduction: 0,
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

    let base = `${supplier.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "company"}-${month}`;
    for (let n = 2; usedNames.has(base); n++) base = `${base.replace(/-\d+$/, "")}-${n}`;
    usedNames.add(base);
    zip.file(`${base}.pdf`, pdf);

    await prisma.generatedSheet.create({
      data: { month, monthLabel, format: "pdf", gasDeduction: 0, issuedTo, supplierId: supplier.id, generatedById: user.id, branchId },
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
  const buffer = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="timesheets-${month}.zip"`,
      "X-Skipped": String(skipped.length),
    },
  });
}
