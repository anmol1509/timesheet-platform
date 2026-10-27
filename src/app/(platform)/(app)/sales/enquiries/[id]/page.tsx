import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { canWrite } from "@/lib/permissions";
import { Badge } from "@/components/Badge";
import { AttachmentUploader } from "@/components/AttachmentUploader";
import { ActivityPanel } from "../../activity-panel";
import { LostButton } from "../../lost-button";

export const metadata = { title: "Enquiry" };

const COLOR: Record<string, "green" | "amber" | "red" | "slate"> = { Open: "amber", Quoted: "slate", Lost: "red", Converted: "green" };
const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export default async function EnquiryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const e = await prisma.enquiry.findUnique({
    where: { id },
    include: {
      client: true,
      quotations: { select: { id: true, quotationNumber: true, status: true, version: true }, orderBy: { createdAt: "desc" } },
      activities: { orderBy: { createdAt: "desc" }, take: 60 },
    },
  });
  if (!e || isOutsideBranch(e.branchId, branchId, isSuperAdmin)) notFound();
  const attachments = await prisma.attachment.findMany({ where: { entityType: "ENQUIRY", entityId: id }, orderBy: { uploadedAt: "desc" }, select: { id: true, docType: true, filename: true, expiryDate: true, uploadedAt: true } });
  const sub = subjectOf(user);
  const writable = canWrite(sub, "sales.enquiries");
  const canQuote = canWrite(sub, "sales.quotations");
  const live = e.status === "Open" || e.status === "Quoted";

  return (
    <div className="space-y-5">
      <div>
        <Link href="/sales" className="text-sm text-muted hover:underline">← Sales pipeline</Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold tracking-tight text-primary">ENQ-{e.enquiryNo}</h1>
              <Badge color={COLOR[e.status] ?? "slate"} dot>{e.status}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted"><Link href={`/clients/${e.clientId}`} className="hover:underline">{e.client.name}</Link>{e.projectHint && <> · {e.projectHint}</>} · received {e.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
            {e.status === "Lost" && e.lostReason && <p className="mt-1 text-sm text-[var(--error)]">Lost: {e.lostReason}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {live && canQuote && <Link href={`/sales/quotations/new?enquiryId=${e.id}&clientId=${e.clientId}`} className="btn btn-primary">{e.quotations.length ? "Another quotation" : "Create quotation"}</Link>}
            {live && writable && e.quotations.length === 0 && <LostButton entity="enquiry" id={id} />}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <div className="card p-5 text-sm">
            <h2 className="mb-3 text-sm font-semibold text-primary">What they asked for</h2>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div><dt className="text-xs text-subtle">Trade</dt><dd className="text-secondary">{e.requiredTrade || "—"}</dd></div>
              <div><dt className="text-xs text-subtle">Source</dt><dd className="text-secondary">{e.source || "—"}</dd></div>
              <div><dt className="text-xs text-subtle">Project</dt><dd className="text-secondary">{e.projectHint || "—"}</dd></div>
              {e.remarks && <div className="sm:col-span-3"><dt className="text-xs text-subtle">Remarks</dt><dd className="whitespace-pre-wrap text-secondary">{e.remarks}</dd></div>}
            </dl>
          </div>

          <div className="card p-5">
            <h2 className="mb-3 text-sm font-semibold text-primary">Quotations</h2>
            {e.quotations.length === 0 ? <p className="text-sm text-muted">None yet.</p> : (
              <ul className="divide-y divide-[var(--border)] text-sm">
                {e.quotations.map((q) => (
                  <li key={q.id}><Link href={`/sales/quotations/${q.id}`} className="flex items-center justify-between py-2 hover:underline"><span className="text-primary">{q.quotationNumber}{q.version > 1 ? ` · v${q.version}` : ""}</span><span className="text-xs text-muted">{q.status.toLowerCase()}</span></Link></li>
                ))}
              </ul>
            )}
          </div>

          <div className="card p-5">
            <h2 className="mb-3 text-sm font-semibold text-primary">Attachments</h2>
            {writable ? (
              <AttachmentUploader
                entityType="ENQUIRY"
                entityId={id}
                entityBranchId={e.branchId}
                revalidate={`/sales/enquiries/${id}`}
                docTypeOptions={[{ value: "RFQ", label: "Client's RFQ" }, { value: "OTHER", label: "Other" }]}
                attachments={attachments.map((a) => ({ id: a.id, docType: a.docType, filename: a.filename, expiryDate: iso(a.expiryDate) || null, uploadedAt: a.uploadedAt.toISOString() }))}
              />
            ) : attachments.length === 0 ? <p className="text-sm text-muted">No files.</p> : (
              <ul className="space-y-1 text-sm">{attachments.map((a) => <li key={a.id}><a href={`/api/attachments/${a.id}`} className="text-[var(--brand-primary)] hover:underline">{a.filename}</a></li>)}</ul>
            )}
          </div>
        </div>

        <ActivityPanel entity="enquiry" id={id} nextFollowUp={iso(e.nextFollowUpAt)} canWrite={writable} activities={e.activities.map((a) => ({ id: a.id, kind: a.kind, body: a.body, userName: a.userName, createdAt: a.createdAt.toISOString() }))} />
      </div>
    </div>
  );
}
