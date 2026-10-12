import { notFound } from "next/navigation";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { loadRunPayslips } from "@/lib/payslipData";
import { loadPayslipIssuer } from "@/lib/payslipPrint";
import { PayslipStudio } from "./payslip-studio";

export const metadata = { title: "Payslips" };

export default async function PayslipsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ line?: string }> }) {
  const { id } = await params;
  const { line } = await searchParams;
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  // Always load the whole run: the screen is where you choose who gets one. ?line= only preselects a single person.
  const [doc, issuer] = await Promise.all([loadRunPayslips(id), loadPayslipIssuer(id)]);
  if (!doc || !issuer || isOutsideBranch(doc.branchId, branchId, isSuperAdmin)) notFound();
  const preselect = line && doc.slips.some((s) => s.lineId === line) ? line : null;

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <h1 className="text-xl font-semibold tracking-tight text-primary">Payslips — {doc.month}</h1>
        <p className="mt-1 text-sm text-muted">Choose who gets a payslip, how it is printed, check the preview, then download.</p>
      </div>
      {doc.slips.length === 0
        ? <p className="card p-6 text-sm text-muted">There are no payslips in this run yet.</p>
        : <PayslipStudio runId={id} doc={doc} issuer={issuer.issuer} preselect={preselect} />}
    </div>
  );
}
