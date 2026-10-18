import { NextResponse } from "next/server";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { can } from "@/lib/permissions";
import { isPayrollDocKind, loadPayrollDoc } from "@/lib/payrollDocs";
import { generateDocPdf } from "@/lib/generateDocPdf";
import { loadCompanyLayout } from "@/lib/payslipPrint";

// A letter made from payroll records (salary revision, final settlement, salary deduction notice), as a PDF with the usual
// letterhead, signature and stamp options. The wording is the company's own template, or the built-in one.
export async function GET(req: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  if (!can(subjectOf(user), "payroll.payroll", "view")) return NextResponse.json({ error: "You don't have permission to view payroll." }, { status: 403 });
  const { kind, id } = await params;
  if (!isPayrollDocKind(kind)) return NextResponse.json({ error: "Unknown document." }, { status: 404 });
  const doc = await loadPayrollDoc(kind, id);
  if (!doc || isOutsideBranch(doc.branchId, branchId, isSuperAdmin)) return NextResponse.json({ error: kind === "deduction-notice" ? "There is no deduction on that pay line to write a notice for." : "Not found." }, { status: 404 });
  const q = new URL(req.url).searchParams;
  const flag = (k: string) => q.get(k) === "1";
  // Always loaded: even a plain printout takes the company's margins.
  const layout = await loadCompanyLayout(doc.branchId, doc.companyId, { onLetterhead: flag("letterhead"), showSignature: flag("signature"), showStamp: flag("stamp"), signatoryName: (q.get("name") ?? "").slice(0, 120), signatoryTitle: (q.get("title") ?? "").slice(0, 120) });
  const pdf = await generateDocPdf(doc, layout ?? undefined);
  return new NextResponse(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${doc.fileName}.pdf"`, "Cache-Control": "private, no-store" } });
}
