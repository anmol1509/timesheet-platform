import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/PageHeader";
import { FIELD_LABELS, sanitizePayload, type ChangeKind } from "@/lib/supplierRequests";
import { RequestsBoard, type ChangeRow, type WorkerRow } from "./requests-board";

export const metadata = { title: "Supplier requests" };
const d = (x: Date | null) => (x ? x.toISOString().slice(0, 10) : null);

/** What suppliers have asked for through their portal: new workers and changes to their own details. */
export default async function SupplierRequestsPage() {
  const { user, branchId } = await requireUserWithBranch();
  const subject = subjectOf(user);
  const [subs, changes, recentSubs, recentChanges] = await Promise.all([
    prisma.workerSubmission.findMany({ where: { ...branchWhere(branchId), status: "PENDING" }, orderBy: { submittedAt: "asc" }, include: { supplier: { select: { name: true } } } }),
    prisma.supplierChangeRequest.findMany({ where: { ...branchWhere(branchId), status: "PENDING" }, orderBy: { requestedAt: "asc" }, include: { supplier: true } }),
    prisma.workerSubmission.findMany({ where: { ...branchWhere(branchId), status: { not: "PENDING" } }, orderBy: { decidedAt: "desc" }, take: 8, include: { supplier: { select: { name: true } } } }),
    prisma.supplierChangeRequest.findMany({ where: { ...branchWhere(branchId), status: { not: "PENDING" } }, orderBy: { decidedAt: "desc" }, take: 8, include: { supplier: { select: { name: true } } } }),
  ]);
  const files = subs.length
    ? await prisma.attachment.findMany({ where: { entityType: "WORKER_SUBMISSION", entityId: { in: subs.map((s) => s.id) } }, select: { id: true, entityId: true, docType: true, filename: true } })
    : [];

  const workers: WorkerRow[] = subs.map((s) => ({
    id: s.id, supplier: s.supplier.name, name: [s.firstName, s.middleName, s.lastName].filter(Boolean).join(" "), trade: s.trade, submittedAt: d(s.submittedAt)!,
    details: [
      ["Nationality", s.nationality], ["Gender", s.gender], ["Date of birth", d(s.dateOfBirth)], ["Mobile", s.mobileNumber], ["Join date", d(s.joinDate)],
      ["Passport", s.passportNumber], ["Passport expiry", d(s.passportExpiry)], ["Emirates ID", s.emiratesId], ["Emirates ID expiry", d(s.emiratesIdExpiry)],
      ["Visa expiry", d(s.visaExpiry)], ["Labour card expiry", d(s.laborCardExpiry)], ["Medical expiry", d(s.medicalExpiry)],
    ].filter(([, v]) => v) as [string, string][],
    files: files.filter((f) => f.entityId === s.id).map((f) => ({ id: f.id, docType: f.docType, filename: f.filename })),
  }));
  const changeRows: ChangeRow[] = changes.map((c) => {
    const requested = sanitizePayload(c.kind as ChangeKind, c.payload);
    const current = c.supplier as unknown as Record<string, string | null>;
    return {
      id: c.id, kind: c.kind, supplier: c.supplier.name, requestedAt: d(c.requestedAt)!,
      fields: Object.entries(requested).map(([k, v]) => ({ label: (FIELD_LABELS[k] ?? k).replace(/ \(.*\)$/, ""), current: current[k] ?? "", requested: v })),
    };
  });

  return (
    <div className="space-y-5">
      <PageHeader title="Supplier requests" description="New workers and detail changes that suppliers have sent through their portal. Nothing takes effect until you approve it." />
      <RequestsBoard
        workers={workers}
        changes={changeRows}
        canDecide={can(subject, "partners", "edit")}
        recent={[
          ...recentSubs.map((s) => ({ key: `w-${s.id}`, text: `${[s.firstName, s.lastName].join(" ")} (${s.supplier.name}) — new worker`, status: s.status, note: s.note, at: d(s.decidedAt) })),
          ...recentChanges.map((c) => ({ key: `c-${c.id}`, text: `${c.supplier.name} — ${c.kind === "BANK" ? "bank details" : "contact details"}`, status: c.status, note: c.note, at: d(c.decidedAt) })),
        ].sort((a, b) => (b.at ?? "").localeCompare(a.at ?? "")).slice(0, 10)}
      />
    </div>
  );
}
