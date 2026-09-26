import { PageHeader } from "@/components/PageHeader";
import Link from "next/link";
import { FileSignature, Plus } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { Badge } from "@/components/Badge";
import { DeleteButton } from "@/components/DeleteButton";
import { KanbanBoard } from "@/components/KanbanBoard";
import { ViewToggle } from "@/components/ViewToggle";
import { QUOTATION_COLUMNS, QUOTATION_TRANSITIONS } from "@/lib/salesPipeline";
import { deleteQuotationAction, moveQuotationAction } from "./actions";

const STATUS_COLOR: Record<string, "green" | "amber" | "red" | "slate"> = {
  DRAFT: "slate",
  SENT: "amber",
  NEGOTIATION: "amber",
  APPROVED: "green",
  ACCEPTED: "green",
  REJECTED: "red",
  CONVERTED: "green",
};

function daysBetween(a: Date, b: Date) {
  return Math.ceil((a.getTime() - b.getTime()) / 86_400_000);
}
const fmtDate = (d: Date) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
const OPEN_STATES = ["DRAFT", "SENT", "NEGOTIATION"];

export default async function QuotationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; view?: string }>;
}) {
  const { error, view: viewParam } = await searchParams;
  const view = viewParam === "board" ? "board" : "list";
  const { branchId } = await requireUserWithBranch();
  const now = new Date();
  const quotations = await prisma.quotation.findMany({
    where: branchWhere(branchId),
    include: { client: true, lines: true, enquiry: { select: { enquiryNo: true } }, project: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader
          title="Quotations"
          icon={FileSignature}
          description={<>Formal quotations with trade/quantity/rate line items.</>}
        />
        <div className="flex items-center gap-3">
          <ViewToggle base="/sales/quotations" view={view} />
          <Link
            href="/sales/quotations/new"
            className="btn btn-primary"
          >
            <Plus className="h-4 w-4" aria-hidden />

            New Quotation
          </Link>
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-[var(--error-border)] bg-[var(--error-soft)] px-4 py-2 text-sm text-[var(--error)]">
          {error}
        </p>
      )}

      {quotations.length === 0 ? (
        <EmptyState
          icon={FileSignature}
          title="No quotations yet"
          description="Quotations turn an enquiry into priced trade line items. Once a client accepts one, it converts straight into a project and its LPOs."
          action={
            <Link href="/sales/quotations/new" className="btn btn-primary btn-sm">
              New quotation
            </Link>
          }
        />
      ) : view === "board" ? (
        <KanbanBoard
          columns={QUOTATION_COLUMNS.map((c) => ({
            id: c,
            title: c.charAt(0) + c.slice(1).toLowerCase(),
            tone: c === "ACCEPTED" || c === "CONVERTED" ? "green" : c === "REJECTED" ? "red" : c === "DRAFT" ? "slate" : c === "APPROVED" ? "blue" : "amber",
          }))}
          weightLabel="workers"
          transitions={QUOTATION_TRANSITIONS}
          onMove={moveQuotationAction}
          cards={quotations.map((q) => {
            const headcount = q.lines.reduce((n, l) => n + l.quantity, 0);
            const left = q.validUntil ? daysBetween(q.validUntil, now) : null;
            return {
              id: q.id,
              columnId: q.status,
              weight: headcount,
              content: (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Link href={`/sales/quotations/${q.id}`} className="text-sm font-medium text-primary hover:underline" draggable={false}>{q.quotationNumber}</Link>
                    <span className="tabular text-xs text-muted">{headcount} workers</span>
                  </div>
                  <p className="truncate text-sm text-secondary">{q.client.name}</p>
                  <p className="truncate text-xs text-muted">{q.lines.map((l) => `${l.quantity} ${l.trade}`).join(" · ")}</p>
                  {left !== null && OPEN_STATES.includes(q.status) && (
                    <p className={`text-xs ${left < 0 ? "font-medium text-[var(--error)]" : left <= 7 ? "font-medium text-[var(--warning)]" : "text-subtle"}`}>{left < 0 ? `Expired ${-left}d ago` : `${left}d left`}</p>
                  )}
                </div>
              ),
            };
          })}
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium tracking-wide text-muted uppercase">
              <tr>
                <th className="px-4 py-3">Quotation</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Trades</th>
                <th className="px-4 py-3 text-right">Headcount</th>
                <th className="px-4 py-3 text-right">Rate / hr (AED)</th>
                <th className="px-4 py-3">Valid until</th>
                <th className="px-4 py-3">Linked to</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {quotations.map((q) => {
                const headcount = q.lines.reduce((n, l) => n + l.quantity, 0);
                const rates = q.lines.map((l) => l.rate);
                const lo = rates.length ? Math.min(...rates) : 0;
                const hi = rates.length ? Math.max(...rates) : 0;
                const left = q.validUntil ? daysBetween(q.validUntil, now) : null;
                const open = OPEN_STATES.includes(q.status);
                return (
                <tr key={q.id} className="hover:bg-surface-hover">
                  <td className="px-4 py-3">
                    <Link href={`/sales/quotations/${q.id}`} className="font-medium text-primary hover:underline">
                      {q.quotationNumber}
                    </Link>
                    <div className="text-xs text-muted">{fmtDate(q.createdAt)}</div>
                  </td>
                  <td className="px-4 py-3 text-secondary">{q.client.name}</td>
                  <td className="px-4 py-3 text-secondary">
                    {q.lines.slice(0, 2).map((l) => (
                      <div key={l.id}>
                        <span className="tabular font-medium text-primary">{l.quantity}</span> {l.trade}
                      </div>
                    ))}
                    {q.lines.length > 2 && <div className="text-xs text-muted">+{q.lines.length - 2} more</div>}
                  </td>
                  <td className="px-4 py-3 text-right tabular font-medium text-primary">{headcount}</td>
                  <td className="px-4 py-3 text-right tabular text-secondary">
                    {rates.length === 0 ? "—" : lo === hi ? lo.toFixed(2) : `${lo.toFixed(2)} – ${hi.toFixed(2)}`}
                  </td>
                  <td className="px-4 py-3">
                    {q.validUntil ? (
                      <>
                        <div className="text-secondary">{fmtDate(q.validUntil)}</div>
                        {open && left !== null && (
                          <div className={`text-xs ${left < 0 ? "font-medium text-[var(--error)]" : left <= 7 ? "font-medium text-[var(--warning)]" : "text-muted"}`}>
                            {left < 0 ? `Expired ${-left}d ago` : left === 0 ? "Expires today" : `${left}d left`}
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-secondary">
                    {q.enquiry && <div>ENQ-{q.enquiry.enquiryNo}</div>}
                    {q.project && <div className="text-[var(--success)]">Project: {q.project.name}</div>}
                    {!q.enquiry && !q.project && <span className="text-muted">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={STATUS_COLOR[q.status] ?? "slate"} dot>{q.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <DeleteButton
                      action={deleteQuotationAction}
                      hiddenFields={{ quotationId: q.id }}
                      confirmMessage={`Delete quotation ${q.quotationNumber} for ${q.client.name}? Its ${q.lines.length} line item(s) go too.`}
                    />
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
