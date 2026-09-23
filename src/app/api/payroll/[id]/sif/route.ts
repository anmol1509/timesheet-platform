import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { can } from "@/lib/permissions";
import { isCashMode, monthBounds, wpsGaps } from "@/lib/payroll";
import { buildSif } from "@/lib/wps";
import { logAudit } from "@/lib/audit";

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

// WPS salary file for an approved run. Cash-paid workers are left out (they
// aren't paid through the bank), everything else must have complete details.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  if (!can(subjectOf(user), "payroll", "export")) return fail("You don't have permission to export payroll.", 403);

  const { id } = await params;
  const run = await prisma.payrollRun.findUnique({
    where: { id },
    include: { lines: { include: { employee: { select: { name: true } } } }, branch: true, payerBank: true },
  });
  if (!run || isOutsideBranch(run.branchId, branchId, isSuperAdmin)) return fail("Run not found.", 404);
  if (run.status === "DRAFT") return fail("Approve the run before generating the WPS file.");

  if (!run.branch.wpsEstablishmentId) return fail("Add the MOHRE establishment ID under Settings → Company profile → Payroll / WPS.");
  const bank = run.payerBank ?? (run.branch.wpsPayerBankId ? await prisma.bank.findUnique({ where: { id: run.branch.wpsPayerBankId } }) : null);
  const payerIban = bank?.ibanNo ?? bank?.accountNo;
  if (!bank || !bank.routingCode || !payerIban) return fail("The salary payer bank account needs a routing code and IBAN (Business Partners → Banks).");

  const bounds = monthBounds(run.month)!;
  const day = (d: Date) => d.toISOString().slice(0, 10);
  const bankLines = run.lines.filter((l) => !isCashMode(l.paymentMode));
  const problems = bankLines.filter((l) => wpsGaps(l).length > 0);
  if (problems.length > 0) {
    return fail(`Incomplete bank details for: ${problems.slice(0, 5).map((l) => l.employee.name).join(", ")}${problems.length > 5 ? "…" : ""}.`);
  }
  if (bankLines.length === 0) return fail("No bank-paid employees in this run.");

  const sif = buildSif({
    establishmentId: run.branch.wpsEstablishmentId,
    payerRoutingCode: bank.routingCode,
    payerIban,
    month: run.month,
    lines: bankLines.map((l) => ({
      personCode: l.personCode!,
      routingCode: l.routingCode!.trim(),
      account: l.account!,
      periodStart: day(bounds.start),
      periodEnd: day(bounds.end),
      days: bounds.days,
      net: Number(l.net),
      overtimePay: Number(l.overtimePay),
      adjustment: Number(l.adjustment),
      leaveDays: l.absentDays + l.unpaidLeaveDays,
    })),
  });

  await logAudit({
    entityType: "PAYROLL_RUN",
    entityId: run.id,
    action: "UPDATE",
    after: { exported: "WPS SIF", file: sif.filename, employees: sif.count, total: sif.total },
    userId: user.id,
    userName: user.name,
    branchId: run.branchId,
  });
  return new NextResponse(sif.content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${sif.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
