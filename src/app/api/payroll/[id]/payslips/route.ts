import { NextResponse } from "next/server";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { can } from "@/lib/permissions";
import { loadRunPayslips } from "@/lib/payslipData";
import { generatePayslipPdf } from "@/lib/generatePayslipPdf";

// Payslips of a run as one PDF (a page each), or a single one with ?line=. Draft runs can be previewed by people who can view payroll.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  if (!can(subjectOf(user), "payroll.payroll", "view")) return NextResponse.json({ error: "You don't have permission to view payroll." }, { status: 403 });
  const { id } = await params;
  const line = new URL(req.url).searchParams.get("line") ?? undefined;
  const doc = await loadRunPayslips(id, line);
  if (!doc || isOutsideBranch(doc.branchId, branchId, isSuperAdmin)) return NextResponse.json({ error: "Run not found." }, { status: 404 });
  if (doc.slips.length === 0) return NextResponse.json({ error: "No payslips in this run." }, { status: 404 });
  const pdf = await generatePayslipPdf(doc);
  const name = doc.slips.length === 1 ? `payslip-${doc.slips[0].employee.idNo}-${doc.month}` : `payslips-${doc.month}`;
  return new NextResponse(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${name}.pdf"`, "Cache-Control": "private, no-store" } });
}
