import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { Badge } from "@/components/Badge";
import { QuotationStatusActions } from "./status-actions";
import { ConvertToProjectForm } from "./convert-form";

const STATUS_COLOR: Record<string, "green" | "amber" | "red" | "slate"> = {
  DRAFT: "slate",
  SENT: "amber",
  NEGOTIATION: "amber",
  APPROVED: "green",
  ACCEPTED: "green",
  REJECTED: "red",
  CONVERTED: "green",
};

export default async function QuotationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { branchId, isSuperAdmin } = await requireUserWithBranch();

  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: { client: true, lines: true, project: true },
  });
  if (!quotation || isOutsideBranch(quotation.branchId, branchId, isSuperAdmin)) notFound();

  const subtotal = quotation.lines.reduce((sum, l) => sum + l.quantity * l.rate, 0);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/sales/quotations" className="text-sm text-muted hover:underline">
          ← Quotations
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-xl tracking-tight text-primary font-semibold">{quotation.quotationNumber}</h1>
            <Badge color={STATUS_COLOR[quotation.status] ?? "slate"}>{quotation.status}</Badge>
          </div>
          <a
            href={`/api/quotations/${quotation.id}`}
            className="btn btn-secondary"
          >
            Download PDF
          </a>
        </div>
        <p className="mt-1 text-sm text-muted">{quotation.client.name}</p>
        {quotation.project && (
          <p className="mt-1 text-sm text-emerald-600">
            Converted to{" "}
            <Link href={`/projects/${quotation.project.id}`} className="underline">
              {quotation.project.name}
            </Link>
          </p>
        )}
      </div>

      <QuotationStatusActions quotationId={quotation.id} status={quotation.status} />

      {quotation.status === "ACCEPTED" && <ConvertToProjectForm quotationId={quotation.id} />}

      <div className="card p-5">
        <h2 className="mb-3 text-sm font-semibold text-primary">Line Items</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-default text-left text-xs font-medium tracking-wide text-muted uppercase">
              <tr>
                <th className="px-2 py-2">Trade</th>
                <th className="px-2 py-2 text-right">Quantity</th>
                <th className="px-2 py-2 text-right">Rate</th>
                <th className="px-2 py-2 text-right">OT rate</th>
                <th className="px-2 py-2">Nationality</th>
                <th className="px-2 py-2">Hours</th>
                <th className="px-2 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {quotation.lines.map((l) => (
                <tr key={l.id}>
                  <td className="px-2 py-2 font-medium text-primary">{l.trade}</td>
                  <td className="px-2 py-2 text-right text-secondary">{l.quantity}</td>
                  <td className="px-2 py-2 text-right text-secondary">{l.rate.toFixed(2)}</td>
                  <td className="px-2 py-2 text-right text-muted">{l.otRate?.toFixed(2) || "—"}</td>
                  <td className="px-2 py-2 text-muted">{l.nationality || "—"}</td>
                  <td className="px-2 py-2 text-muted">{l.workingHours || "—"}</td>
                  <td className="px-2 py-2 text-right font-medium text-primary">
                    {(l.quantity * l.rate).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 border-t border-default pt-3 text-right text-sm font-semibold text-primary">
          Subtotal: AED {subtotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </div>
      </div>

      {(quotation.terms ||
        quotation.accommodationResponsibility ||
        quotation.transportationResponsibility ||
        quotation.ppeResponsibility) && (
        <div className="card p-5 text-sm">
          <h2 className="mb-3 text-sm font-semibold text-primary">Terms</h2>
          <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {quotation.accommodationResponsibility && (
              <div>
                <dt className="text-xs text-subtle">Accommodation</dt>
                <dd className="text-secondary">{quotation.accommodationResponsibility}</dd>
              </div>
            )}
            {quotation.transportationResponsibility && (
              <div>
                <dt className="text-xs text-subtle">Transportation</dt>
                <dd className="text-secondary">{quotation.transportationResponsibility}</dd>
              </div>
            )}
            {quotation.ppeResponsibility && (
              <div>
                <dt className="text-xs text-subtle">PPE</dt>
                <dd className="text-secondary">{quotation.ppeResponsibility}</dd>
              </div>
            )}
            {quotation.terms && (
              <div className="sm:col-span-2">
                <dt className="text-xs text-subtle">Other terms</dt>
                <dd className="text-secondary">{quotation.terms}</dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </div>
  );
}
