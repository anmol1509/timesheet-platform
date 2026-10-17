import { notFound } from "next/navigation";
import Link from "next/link";
import { Check } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { canWrite } from "@/lib/permissions";
import { Badge } from "@/components/Badge";
import { AttachmentUploader } from "@/components/AttachmentUploader";
import { cn } from "@/lib/cn";
import { conversionNote, lineProfit, monthlyEach, monthlyTotal, parseAdjustments, parseQuoteSettings, quoteProfit, quoteTotals, unitWord, type PricedLine } from "@/lib/quotationMath";
import { QuotationStatusActions } from "./status-actions";
import { ConvertToProjectForm } from "./convert-form";
import { SendDialog } from "./send-dialog";
import { ActivityPanel } from "../../activity-panel";
import { LostButton } from "../../lost-button";

const STATUS_COLOR: Record<string, "green" | "amber" | "red" | "slate" | "blue"> = {
  DRAFT: "slate", SENT: "blue", NEGOTIATION: "amber", APPROVED: "green", ACCEPTED: "green", REJECTED: "red", CONVERTED: "green",
};
const STATUS_LABEL: Record<string, string> = { DRAFT: "Draft", SENT: "Sent", NEGOTIATION: "Negotiating", APPROVED: "Client approved", ACCEPTED: "Accepted", REJECTED: "Lost", CONVERTED: "Converted" };
const STAGES = ["Drafted", "Sent", "Negotiating", "Accepted", "Project"];
const STAGE_OF: Record<string, number> = { DRAFT: 0, SENT: 1, NEGOTIATION: 2, APPROVED: 2, ACCEPTED: 3, CONVERTED: 4 };

const fmt = (v: number, cur: string) => `${cur} ${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (d: Date | null) => (d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : null);
const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

type SnapLine = PricedLine & { trade: string };

/** Whole days from now to a date; negative once it has passed. */
function daysUntil(d: Date) {
  return Math.ceil((d.getTime() - new Date().getTime()) / 86_400_000);
}

export default async function QuotationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();

  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: {
      client: true,
      lines: true,
      project: true,
      contact: true,
      enquiry: { select: { id: true, enquiryNo: true } },
      branch: { select: { name: true, letterheadImageId: true, quoteSettings: true } },
      revisions: { orderBy: { version: "desc" } },
      activities: { orderBy: { createdAt: "desc" }, take: 60 },
    },
  });
  if (!quotation || isOutsideBranch(quotation.branchId, branchId, isSuperAdmin)) notFound();

  const [templates, attachments] = await Promise.all([
    prisma.quotationTemplate.findMany({ where: { branchId: quotation.branchId }, orderBy: { name: "asc" }, select: { id: true, name: true, intro: true, closing: true } }),
    prisma.attachment.findMany({ where: { entityType: "QUOTATION", entityId: id }, orderBy: { uploadedAt: "desc" }, select: { id: true, docType: true, filename: true, expiryDate: true, uploadedAt: true } }),
  ]);

  const writable = canWrite(subjectOf(user), "sales.quotations");
  const settings = parseQuoteSettings(quotation.branch.quoteSettings);
  const adjustments = parseAdjustments(quotation.adjustments);
  const cur = quotation.currency;
  const totals = quoteTotals(quotation.lines, adjustments, settings);
  const showCost = quotation.showCost && writable;
  const profit = showCost ? quoteProfit(quotation.lines, settings) : null;
  const showOt = quotation.lines.some((l) => l.otRate);
  const showMonths = quotation.lines.some((l) => l.durationMonths);
  const stage = STAGE_OF[quotation.status];
  const editable = ["DRAFT", "SENT", "NEGOTIATION"].includes(quotation.status);
  const canLose = ["DRAFT", "SENT", "NEGOTIATION", "APPROVED"].includes(quotation.status) && writable;
  const left = quotation.validUntil ? daysUntil(quotation.validUntil) : null;

  // Earlier versions, newest first, each with what its monthly total was and what moved into the next version.
  const versions = quotation.revisions.map((r, i) => {
    const snap = r.snapshot as unknown as { lines: SnapLine[]; adjustments: unknown };
    const next: SnapLine[] = i === 0 ? quotation.lines : ((quotation.revisions[i - 1].snapshot as unknown as { lines: SnapLine[] }).lines);
    const moved = next.flatMap((n) => {
      const o = snap.lines.find((x) => x.trade === n.trade);
      return o && o.rate !== n.rate ? [`${n.trade} ${o.rate} → ${n.rate}`] : [];
    });
    return { r, lines: snap.lines, total: quoteTotals(snap.lines, parseAdjustments(snap.adjustments), settings).total, moved };
  });

  return (
    <div className="space-y-5">
      <div>
        <Link href="/sales" className="text-sm text-muted hover:underline">← Sales pipeline</Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-semibold tracking-tight text-primary">{quotation.quotationNumber}</h1>
              <Badge color={STATUS_COLOR[quotation.status] ?? "slate"} dot>{STATUS_LABEL[quotation.status] ?? quotation.status}</Badge>
              {quotation.version > 1 && <span className="rounded-full border border-default px-2 py-0.5 text-xs font-medium text-secondary">Version {quotation.version}</span>}
              {left !== null && ["DRAFT", "SENT", "NEGOTIATION"].includes(quotation.status) && (
                <span className={cn("text-xs font-medium", left < 0 ? "text-[var(--error)]" : left <= 3 ? "text-[var(--warning)]" : "text-subtle")}>{left < 0 ? `Expired ${-left} d ago` : left === 0 ? "Expires today" : `Expires in ${left} d`}</span>
              )}
            </div>
            <p className="mt-1 text-sm text-muted">
              <Link href={`/clients/${quotation.clientId}`} className="hover:underline">{quotation.client.name}</Link>
              {quotation.contact && <> · Attn {quotation.contact.name}</>}
              {quotation.validUntil && <> · valid until {day(quotation.validUntil)}</>}
              {quotation.enquiry && <> · from <Link href="/sales/enquiries" className="hover:underline">ENQ-{quotation.enquiry.enquiryNo}</Link></>}
            </p>
            {quotation.project && (
              <p className="mt-1 text-sm text-[var(--success)]">Converted to <Link href={`/projects/${quotation.project.id}`} className="underline">{quotation.project.name}</Link></p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {editable && writable && <Link href={`/sales/quotations/${id}/edit`} className="btn btn-secondary">{quotation.status === "DRAFT" ? "Edit" : "New revision"}</Link>}
            <SendDialog
              quotationId={id}
              version={quotation.version}
              hasLetterhead={!!quotation.branch.letterheadImageId}
              companyName={quotation.branch.name}
              templates={templates}
              canSend={writable && editable}
              label={quotation.status === "DRAFT" ? "Send to client" : "PDF & send"}
            />
          </div>
        </div>
      </div>

      {quotation.status === "REJECTED" ? (
        <div className="rounded-xl border border-[var(--error-border)] bg-[var(--error-soft)] px-5 py-3 text-sm text-[var(--error)]">Lost{quotation.lostReason ? ` — ${quotation.lostReason}` : ""}</div>
      ) : (
        <div className="card flex items-center gap-2 overflow-x-auto px-5 py-3.5 text-xs">
          {STAGES.map((s, i) => (
            <div key={s} className="contents">
              <span className="flex shrink-0 items-center gap-1.5">
                <span className={cn("flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold", i < stage ? "bg-[var(--success)] text-white" : i === stage ? "bg-[var(--brand-primary)] text-white" : "bg-surface-sunken text-subtle")}>{i < stage ? <Check className="h-3 w-3" aria-hidden /> : i + 1}</span>
                <span className={cn("whitespace-nowrap", i === stage ? "font-semibold text-primary" : i < stage ? "text-secondary" : "text-subtle")}>{s}{i === 2 && quotation.status === "APPROVED" ? " · client approved" : ""}</span>
              </span>
              {i < STAGES.length - 1 && <span className={cn("h-0.5 min-w-4 flex-1", i < stage ? "bg-[var(--success)]" : "bg-surface-sunken")} />}
            </div>
          ))}
        </div>
      )}

      {writable && (quotation.status === "SENT" || quotation.status === "NEGOTIATION" || quotation.status === "APPROVED" || canLose) && (
        <div className="flex flex-wrap gap-2">
          <QuotationStatusActions quotationId={id} status={quotation.status} />
          {canLose && <LostButton entity="quotation" id={id} />}
        </div>
      )}

      {quotation.status === "ACCEPTED" && writable && <ConvertToProjectForm quotationId={id} />}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4">
              <h2 className="text-sm font-semibold text-primary">Lines</h2>
              {showCost && <span className="text-xs text-subtle">Cost and profit are private — not on the PDF</span>}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-y border-default bg-surface-subtle text-left text-xs font-medium tracking-wide text-muted uppercase">
                  <tr>
                    <th className="px-5 py-2">Trade</th>
                    <th className="px-2 py-2 text-right">Qty</th>
                    <th className="px-2 py-2 text-right">Price</th>
                    {showOt && <th className="px-2 py-2 text-right">OT</th>}
                    {showMonths && <th className="px-2 py-2 text-right">Months</th>}
                    {showCost && <th className="px-2 py-2 text-right">Cost</th>}
                    {showCost && <th className="px-2 py-2 text-right">Profit</th>}
                    <th className="px-5 py-2 text-right">Per month</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {quotation.lines.map((l) => {
                    const lp = showCost ? lineProfit(l, settings) : null;
                    const note = conversionNote(l, settings);
                    return (
                      <tr key={l.id}>
                        <td className="px-5 py-3"><span className="font-medium text-primary">{l.trade}</span>{(l.nationality || l.workingHours) && <span className="block text-xs text-subtle">{[l.nationality, l.workingHours].filter(Boolean).join(" · ")}</span>}</td>
                        <td className="tabular px-2 py-3 text-right text-secondary">{l.quantity}</td>
                        <td className="tabular px-2 py-3 text-right text-secondary">{l.rate.toFixed(2)} <span className="text-xs text-subtle">/ {unitWord(l)}</span>{note && <span className="block text-xs text-subtle">{note}</span>}</td>
                        {showOt && <td className="tabular px-2 py-3 text-right text-muted">{l.otRate?.toFixed(2) ?? "—"}</td>}
                        {showMonths && <td className="tabular px-2 py-3 text-right text-muted">{l.durationMonths ?? "—"}</td>}
                        {showCost && <td className="tabular px-2 py-3 text-right text-muted">{l.costPerMonth != null ? Math.round(l.costPerMonth).toLocaleString() : "—"}</td>}
                        {showCost && (
                          <td className={cn("tabular px-2 py-3 text-right font-medium", lp?.belowCost ? "text-[var(--error)]" : "text-[var(--success)]")}>
                            {lp ? `${lp.each < 0 ? "−" : "+"}${Math.abs(Math.round(lp.each)).toLocaleString()}` : <span className="font-normal text-subtle">—</span>}
                            {lp?.pct != null && <span className="block text-xs font-normal text-subtle">{lp.pct.toFixed(0)}%{lp.belowCost ? " ⚠" : ""}</span>}
                          </td>
                        )}
                        <td className="tabular px-5 py-3 text-right font-medium text-primary">{monthlyTotal(l, settings).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}<span className="block text-xs font-normal text-subtle">{monthlyEach(l, settings).toLocaleString(undefined, { maximumFractionDigits: 2 })} each</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="ml-auto max-w-xs space-y-1.5 border-t border-default px-5 py-4 text-sm">
              <div className="flex justify-between"><span className="text-muted">Subtotal, per month</span><span className="tabular">{fmt(totals.subtotal, cur)}</span></div>
              {totals.rows.map((r, i) => (
                <div key={i} className="flex justify-between"><span className="text-muted">{r.label}</span><span className="tabular">{r.amount < 0 ? "−" : ""}{fmt(Math.abs(r.amount), cur)}</span></div>
              ))}
              <div className="flex justify-between border-t border-default pt-2 text-base font-semibold text-primary"><span>Total per month</span><span className="tabular">{fmt(totals.total, cur)}</span></div>
              {totals.contractSubtotal != null && <div className="flex justify-between text-xs text-subtle"><span>Contract value, before extras</span><span className="tabular">{fmt(totals.contractSubtotal, cur)}</span></div>}
              {profit && profit.counted > 0 && (
                <div className={cn("flex justify-between border-t border-default pt-2 text-xs", profit.perMonth < 0 ? "text-[var(--error)]" : "text-[var(--success)]")}><span>Profit per month</span><span className="tabular font-semibold">{profit.perMonth < 0 ? "−" : "+"}{Math.abs(Math.round(profit.perMonth)).toLocaleString()}{profit.pct != null ? ` · ${profit.pct.toFixed(0)}%` : ""}</span></div>
              )}
            </div>
          </div>

          {(quotation.terms || quotation.accommodationResponsibility || quotation.transportationResponsibility || quotation.ppeResponsibility) && (
            <div className="card p-5 text-sm">
              <h2 className="mb-3 text-sm font-semibold text-primary">Terms</h2>
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {quotation.accommodationResponsibility && <div><dt className="text-xs text-subtle">Accommodation</dt><dd className="text-secondary">{quotation.accommodationResponsibility}</dd></div>}
                {quotation.transportationResponsibility && <div><dt className="text-xs text-subtle">Transport</dt><dd className="text-secondary">{quotation.transportationResponsibility}</dd></div>}
                {quotation.ppeResponsibility && <div><dt className="text-xs text-subtle">PPE</dt><dd className="text-secondary">{quotation.ppeResponsibility}</dd></div>}
                {quotation.terms && <div className="sm:col-span-3"><dt className="text-xs text-subtle">Other terms</dt><dd className="whitespace-pre-wrap text-secondary">{quotation.terms}</dd></div>}
              </dl>
            </div>
          )}

          <div className="card p-5">
            <h2 className="mb-3 text-sm font-semibold text-primary">Attachments</h2>
            {writable ? (
              <AttachmentUploader
                entityType="QUOTATION"
                entityId={id}
                entityBranchId={quotation.branchId}
                revalidate={`/sales/quotations/${id}`}
                docTypeOptions={[{ value: "RFQ", label: "Client's RFQ" }, { value: "SIGNED_ACCEPTANCE", label: "Signed acceptance" }, { value: "OTHER", label: "Other" }]}
                attachments={attachments.map((a) => ({ id: a.id, docType: a.docType, filename: a.filename, expiryDate: iso(a.expiryDate) || null, uploadedAt: a.uploadedAt.toISOString() }))}
              />
            ) : attachments.length === 0 ? <p className="text-sm text-muted">No files.</p> : (
              <ul className="space-y-1 text-sm">{attachments.map((a) => <li key={a.id}><a href={`/api/attachments/${a.id}`} className="text-[var(--brand-primary)] hover:underline">{a.filename}</a></li>)}</ul>
            )}
          </div>

          {versions.length > 0 && (
            <div className="card p-5">
              <h2 className="mb-3 text-sm font-semibold text-primary">Earlier versions</h2>
              <ul className="divide-y divide-[var(--border)]">
                {versions.map(({ r, lines, total, moved }) => (
                  <li key={r.id}>
                    <details className="group py-2.5">
                      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                        <span className="font-medium text-primary">Version {r.version}</span>
                        <span className="text-xs text-subtle">{day(r.createdAt)}{r.createdByName ? ` · ${r.createdByName}` : ""}</span>
                        <span className="tabular ml-auto text-secondary">{fmt(total, cur)} / month</span>
                      </summary>
                      <div className="mt-2 space-y-2 text-xs text-muted">
                        {moved.length > 0 && <p>Changed in the next version: {moved.join(", ")}.</p>}
                        {r.note && <p>{r.note}</p>}
                        <ul className="space-y-0.5">{lines.map((l, i) => <li key={i}>{l.quantity} × {l.trade} at {l.rate} / {unitWord(l)}</li>)}</ul>
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <ActivityPanel
          entity="quotation"
          id={id}
          nextFollowUp={iso(quotation.nextFollowUpAt)}
          canWrite={writable}
          activities={quotation.activities.map((a) => ({ id: a.id, kind: a.kind, body: a.body, userName: a.userName, createdAt: a.createdAt.toISOString() }))}
        />
      </div>
    </div>
  );
}
