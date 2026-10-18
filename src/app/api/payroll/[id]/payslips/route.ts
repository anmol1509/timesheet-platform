import { NextResponse } from "next/server";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { can } from "@/lib/permissions";
import { hiddenDefault, loadRunPayslips } from "@/lib/payslipData";
import { applyPayslipView, parseHidden } from "@/lib/payslipView";
import { generatePayslipPdf } from "@/lib/generatePayslipPdf";
import { loadPayslipLayout } from "@/lib/payslipPrint";

// Payslips of a run as one PDF (a page each), or only the chosen ones with ?lines=id1,id2. Draft runs can be previewed by people who can view payroll.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  if (!can(subjectOf(user), "payroll.payroll", "view")) return NextResponse.json({ error: "You don't have permission to view payroll." }, { status: 403 });
  const { id } = await params;
  const q = new URL(req.url).searchParams;
  // ?lines=a,b picks some employees (?line= is the old single form); no selection means the whole run.
  const picked = (q.get("lines") ?? q.get("line") ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  const doc = await loadRunPayslips(id, picked.length > 0 ? picked : undefined);
  if (!doc || isOutsideBranch(doc.branchId, branchId, isSuperAdmin)) return NextResponse.json({ error: "Run not found." }, { status: 404 });
  if (doc.slips.length === 0) return NextResponse.json({ error: "No payslips in this run." }, { status: 404 });
  // Printing choices, as on the Letters screen. Nothing is signed, stamped or put on letterhead unless asked for.
  const flag = (k: string) => q.get(k) === "1";
  // Always loaded: even a plain printout takes the company's margins.
  const layout = await loadPayslipLayout(id, { onLetterhead: flag("letterhead"), showSignature: flag("signature"), showStamp: flag("stamp"), signatoryName: (q.get("name") ?? "").slice(0, 120), signatoryTitle: (q.get("title") ?? "").slice(0, 120) });
  // ?hide=gas,ytd names the lines to fold away (empty = show everything); without it the company's own choice applies.
  const hidden = q.has("hide") ? parseHidden(q.get("hide")) : await hiddenDefault(doc.branchId);
  const pdf = await generatePayslipPdf(applyPayslipView(doc, hidden), layout ?? undefined);
  const name = doc.slips.length === 1 ? `payslip-${doc.slips[0].employee.idNo}-${doc.month}` : `payslips-${doc.month}`;
  return new NextResponse(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${name}.pdf"`, "Cache-Control": "private, no-store" } });
}
