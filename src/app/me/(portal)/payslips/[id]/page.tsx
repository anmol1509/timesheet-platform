import Link from "next/link";
import { notFound } from "next/navigation";
import { getEssEmployee } from "@/lib/ess/session";
import { loadEssPayslip } from "@/lib/payslipData";
import { PayslipCard } from "@/components/PayslipCard";
import { PrintButton } from "./print-button";

export const metadata = { title: "Payslip" };

export default async function EssPayslipPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const employee = (await getEssEmployee())!;
  // Scoped to the signed-in employee AND to runs that have been approved.
  const doc = await loadEssPayslip(employee.id, id);
  if (!doc || doc.slips.length === 0) notFound();

  return (
    <>
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link href="/me/payslips" className="text-sm text-muted hover:text-secondary">← Payslips</Link>
        <div className="flex gap-2">
          <a className="btn btn-primary" href={`/me/payslips/${id}/pdf`}>Download PDF</a>
          <PrintButton />
        </div>
      </div>
      <PayslipCard doc={doc} i={0} />
    </>
  );
}
