import { NextResponse } from "next/server";
import { getEssEmployee } from "@/lib/ess/session";
import { loadEssPayslip } from "@/lib/payslipData";
import { generatePayslipPdf } from "@/lib/generatePayslipPdf";

// The signed-in employee's own payslip, only once its run is approved.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const employee = await getEssEmployee();
  if (!employee) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const { id } = await params;
  const doc = await loadEssPayslip(employee.id, id);
  if (!doc || doc.slips.length === 0) return NextResponse.json({ error: "Payslip not found." }, { status: 404 });
  const pdf = await generatePayslipPdf(doc);
  return new NextResponse(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="payslip-${doc.month}.pdf"`, "Cache-Control": "private, no-store" } });
}
