import { notFound, redirect } from "next/navigation";
import { FilePenLine } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { parseAdjustments } from "@/lib/quotationMath";
import { QuotationForm } from "../../quotation-form";
import { isoDay, loadQuotationFormData } from "../../form-data";

export default async function EditQuotationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const q = await prisma.quotation.findUnique({ where: { id }, include: { lines: true } });
  if (!q || isOutsideBranch(q.branchId, branchId, isSuperAdmin)) notFound();
  if (!["DRAFT", "SENT", "NEGOTIATION"].includes(q.status)) redirect(`/sales/quotations/${id}`);
  const data = await loadQuotationFormData(q.branchId);
  const str = (v: number | null) => (v == null ? "" : String(v));

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Edit ${q.quotationNumber}`}
        icon={FilePenLine}
        description={q.status === "DRAFT" ? <>A draft: changes are saved in place.</> : <>Already sent. Saving creates version {q.version + 1} and keeps version {q.version}.</>}
      />
      <QuotationForm
        {...data}
        enquiryId=""
        initial={{
          quotationId: q.id,
          status: q.status,
          version: q.version,
          clientId: q.clientId,
          contactId: q.contactId ?? "",
          validUntil: isoDay(q.validUntil),
          nextFollowUpAt: isoDay(q.nextFollowUpAt),
          terms: q.terms ?? "",
          coverIntro: q.coverIntro ?? "",
          coverClosing: q.coverClosing ?? "",
          accommodationResponsibility: q.accommodationResponsibility ?? "",
          transportationResponsibility: q.transportationResponsibility ?? "",
          ppeResponsibility: q.ppeResponsibility ?? "",
          currency: q.currency,
          showCost: q.showCost,
          adjustments: parseAdjustments(q.adjustments),
          lines: q.lines.map((l) => ({
            id: l.id,
            trade: l.trade,
            quantity: String(l.quantity),
            rate: String(l.rate),
            unit: (l.unit === "DAY" || l.unit === "HOUR" || l.unit === "CUSTOM" ? l.unit : "MONTH") as "MONTH" | "DAY" | "HOUR" | "CUSTOM",
            unitLabel: l.unitLabel ?? "",
            unitsPerMonth: String(l.unitsPerMonth),
            durationMonths: str(l.durationMonths),
            hoursPerDay: str(l.hoursPerDay),
            otRate: str(l.otRate),
            nationality: l.nationality ?? "",
            workingHours: l.workingHours ?? "",
            cost: str(l.costPerMonth),
            costParts: Array.isArray(l.costBreakdown) ? (l.costBreakdown as { label: string; amount: number }[]) : [],
          })),
        }}
      />
    </div>
  );
}
