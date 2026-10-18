import { NextResponse } from "next/server";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { can } from "@/lib/permissions";
import { loadAdvanceDoc } from "@/lib/advanceDoc";
import { generateAdvancePdf } from "@/lib/generateAdvancePdf";
import { loadCompanyLayout } from "@/lib/payslipPrint";

// The advance as a document: a request to sign until the money is handed over, then a receipt. Options as on payslips and letters.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  if (!can(subjectOf(user), "payroll.payroll", "view")) return NextResponse.json({ error: "You don't have permission to view payroll." }, { status: 403 });
  const { id } = await params;
  const doc = await loadAdvanceDoc(id);
  if (!doc || isOutsideBranch(doc.branchId, branchId, isSuperAdmin)) return NextResponse.json({ error: "Advance not found." }, { status: 404 });
  const q = new URL(req.url).searchParams;
  const flag = (k: string) => q.get(k) === "1";
  // Always loaded: even a plain printout takes the company's margins.
  const layout = await loadCompanyLayout(doc.branchId, doc.companyId, { onLetterhead: flag("letterhead"), showSignature: flag("signature"), showStamp: flag("stamp"), signatoryName: (q.get("name") ?? "").slice(0, 120), signatoryTitle: (q.get("title") ?? "").slice(0, 120) });
  const pdf = await generateAdvancePdf(doc, layout ?? undefined);
  return new NextResponse(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${doc.ref}.pdf"`, "Cache-Control": "private, no-store" } });
}
