import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { can } from "@/lib/permissions";
import { isCashMode, monthBounds, wpsGaps } from "@/lib/payroll";
import { buildSif } from "@/lib/wps";
import { logAudit } from "@/lib/audit";

const fail = (error: string, status = 400, extra: Record<string, unknown> = {}) => NextResponse.json({ error, ...extra }, { status });

// WPS salary file for an approved run. Cash-paid workers are left out (they
// aren't paid through the bank). A worker without complete bank details stops the file, with their names, unless
// ?skip=1 is given: then the file is made without them and the names are returned in the X-Left-Out header.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  if (!can(subjectOf(user), "payroll.payroll", "export")) return fail("You don't have permission to export payroll.", 403);

  const { id } = await params;
  const run = await prisma.payrollRun.findUnique({
    where: { id },
    include: { lines: { include: { employee: { select: { name: true } } } }, branch: true, payerBank: true, company: { select: { name: true, wpsEstablishmentId: true } } },
  });
  if (!run || isOutsideBranch(run.branchId, branchId, isSuperAdmin)) return fail("Run not found.", 404);
  if (run.status === "DRAFT") return fail("Approve the run before generating the WPS file.");

  // Each own company files under its own MOHRE establishment; older runs use the branch's.
  const establishmentId = run.company?.wpsEstablishmentId ?? run.branch.wpsEstablishmentId;
  if (!establishmentId) return fail(run.company ? `Add ${run.company.name}'s MOHRE establishment ID on its company page (Suppliers).` : "Add the MOHRE establishment ID under Settings → Company profile → Payroll / WPS.");
  const bank = run.payerBank ?? (run.branch.wpsPayerBankId ? await prisma.bank.findUnique({ where: { id: run.branch.wpsPayerBankId } }) : null);
  const payerIban = bank?.ibanNo ?? bank?.accountNo;
  if (!bank || !bank.routingCode || !payerIban) return fail("The salary payer bank account needs a routing code and IBAN (Business Partners → Banks).");

  const bounds = monthBounds(run.month)!;
  const day = (d: Date) => d.toISOString().slice(0, 10);
  // ?only=resubmit sends just the lines the bank bounced and whose details have since been fixed.
  const onlyResubmit = new URL(req.url).searchParams.get("only") === "resubmit";
  const bankLines = run.lines.filter((l) => !isCashMode(l.paymentMode) && (!onlyResubmit || l.paymentStatus === "RESUBMIT"));
  const skip = new URL(req.url).searchParams.get("skip") === "1";
  const problems = bankLines.filter((l) => wpsGaps(l).length > 0);
  if (problems.length > 0 && !skip) {
    return fail(`${problems.length} worker${problems.length === 1 ? " has" : "s have"} incomplete bank details: ${problems.slice(0, 5).map((l) => l.employee.name).join(", ")}${problems.length > 5 ? "…" : ""}. Fix them on the worker's Payroll & WPS tab (or set them to cash), or download the file without them.`, 400, { incomplete: problems.map((l) => l.employee.name) });
  }
  const sending = bankLines.filter((l) => wpsGaps(l).length === 0);
  if (sending.length === 0) return fail(problems.length > 0 ? "Nobody in this run has complete bank details yet." : "No bank-paid employees in this run.");

  const sif = buildSif({
    establishmentId,
    payerRoutingCode: bank.routingCode,
    payerIban,
    month: run.month,
    lines: sending.map((l) => ({
      personCode: l.personCode!,
      routingCode: l.routingCode!.trim(),
      account: l.account!,
      // A joiner or leaver is paid for the days they were on the payroll, and the file says so.
      periodStart: day(l.periodStart ?? bounds.start),
      periodEnd: day(l.periodEnd ?? bounds.end),
      days: l.employedDays ?? bounds.days,
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
    after: { exported: "WPS SIF", file: sif.filename, employees: sif.count, total: sif.total, leftOut: problems.length > 0 ? problems.map((l) => l.employee.name) : undefined },
    userId: user.id,
    userName: user.name,
    branchId: run.branchId,
  });
  return new NextResponse(sif.content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${sif.filename}"`,
      "Cache-Control": "no-store",
      ...(problems.length > 0 ? { "X-Left-Out": encodeURIComponent(problems.map((l) => l.employee.name).join(", ")) } : {}),
    },
  });
}
