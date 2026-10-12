import type { AdvanceDoc } from "@/lib/advanceDoc";
import type { PayslipLayout } from "@/lib/payslipPrint";
import { generateDocPdf } from "@/lib/generateDocPdf";

/** The advance as a PDF: the request until the money is handed over, then the receipt. */
export function generateAdvancePdf(doc: AdvanceDoc, layout?: PayslipLayout) {
  return generateDocPdf(
    {
      title: doc.title, ref: doc.ref, date: (doc.given?.date ?? doc.requestedOn).split("-").reverse().join("-"), letterhead: doc.letterhead, bodyHtml: doc.bodyHtml,
      employeeName: doc.employee.name, approvedBy: doc.approval.status === "APPROVED" ? doc.approval.by : null, footer: doc.given ? "Receipt" : "Request",
    },
    layout,
  );
}
