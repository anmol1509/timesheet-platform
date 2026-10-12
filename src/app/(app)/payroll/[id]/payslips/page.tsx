import { notFound } from "next/navigation";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { loadRunPayslips } from "@/lib/payslipData";
import { PayslipCard } from "@/components/PayslipCard";
import { PrintButton } from "./print-button";

export const metadata = { title: "Payslips" };

export default async function PayslipsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ line?: string }> }) {
  const { id } = await params;
  const { line } = await searchParams;
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const doc = await loadRunPayslips(id, line);
  if (!doc || isOutsideBranch(doc.branchId, branchId, isSuperAdmin)) notFound();
  const pdf = `/api/payroll/${id}/payslips${line ? `?line=${encodeURIComponent(line)}` : ""}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-primary">Payslips — {doc.month}</h1>
          <p className="mt-1 text-sm text-muted">{doc.slips.length} payslip{doc.slips.length === 1 ? "" : "s"}, issued in the name of {doc.letterhead.name}.</p>
        </div>
        <div className="flex gap-2">
          <a className="btn btn-primary" href={pdf} target="_blank" rel="noreferrer">Download PDF{doc.slips.length > 1 ? " (all)" : ""}</a>
          <PrintButton />
        </div>
      </div>
      {doc.slips.map((_, i) => <PayslipCard key={doc.slips[i].lineId} doc={doc} i={i} />)}
    </div>
  );
}
