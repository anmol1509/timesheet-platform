import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { isAdminRole } from "@/lib/roles";
import { branchWhere } from "@/lib/branch";
import { StatTile } from "@/components/StatTile";
import { Insights } from "@/components/ListSummary";
import { TypeStatusBars, type TypeStatusRow } from "./type-status-bars";
import { PageHeader, CountPill } from "@/components/PageHeader";
import { FileText, CheckCircle2, AlertTriangle } from "lucide-react";
import { complianceStatus } from "@/lib/compliance";
import { DocumentsView } from "./documents-view";
import { COMPANY_DOC_TYPES } from "./company-docs";
import { RecheckExpired } from "./recheck-expired";


function prettyType(type: string) {
  return type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\bId\b/, "ID");
}

export default async function DocumentsPage() {
  // This page previously queried every branch's documents with `include`,
  // which also dragged each file's `fileData` bytes across just to render a
  // filename. Scoped to the caller's branch, and selecting only what the table
  // shows.
  const { user, branchId } = await requireUserWithBranch();

  const [documents, employees, activeEmployees, certificates, companySuppliers, companyAttachments] = await Promise.all([
    prisma.document.findMany({
      where: { employee: branchWhere(branchId) },
      select: {
        id: true,
        filename: true,
        type: true,
        employeeId: true,
        mimeType: true,
        uploadedAt: true,
        expiryDate: true,
        employee: { select: { name: true, employeeIdNo: true, photoMimeType: true, supplierId: true, supplier: { select: { name: true } }, projectId: true, project: { select: { code: true, name: true } } } },
        uploadedBy: { select: { name: true } },
      },
      orderBy: { uploadedAt: "desc" },
    }),
    prisma.employee.findMany({
      where: branchWhere(branchId),
      select: { id: true, name: true, employeeIdNo: true },
      orderBy: { name: "asc" },
    }),
    // Everyone currently on the books, for the By employee and By supplier views (a worker with no documents still shows).
    prisma.employee.findMany({
      where: { ...branchWhere(branchId), active: true },
      select: { id: true, name: true, employeeIdNo: true, photoMimeType: true, supplierId: true, supplier: { select: { name: true } }, projectId: true, project: { select: { code: true, name: true } }, wcAttachmentId: true },
      orderBy: { name: "asc" },
    }),
    // Workmen compensation certificates are supplier documents, not worker ones.
    prisma.attachment.findMany({
      where: { entityType: "SUPPLIER", docType: { in: ["WORKMEN_COMPENSATION_INSURANCE", "WORKMEN_COMPENSATION"] }, ...(branchId ? { branchId } : {}) },
      select: { id: true, entityId: true, expiryDate: true, uploadedAt: true },
    }),
    // The supplier companies themselves, with their own documents (trade licence, VAT certificate, workmen comp...).
    prisma.supplier.findMany({ where: branchWhere(branchId), select: { id: true, name: true, trn: true, tradeLicenseExpiry: true }, orderBy: { name: "asc" } }),
    prisma.attachment.findMany({
      where: { entityType: "SUPPLIER", docType: { in: COMPANY_DOC_TYPES }, ...(branchId ? { branchId } : {}) },
      select: { id: true, entityId: true, docType: true, expiryDate: true, uploadedAt: true },
    }),
  ]);

  // Every certificate, since a supplier can hold several (each covering its own workers).
  const certIdsBySupplier = new Map<string, Set<string>>();
  for (const c of certificates) certIdsBySupplier.set(c.entityId, (certIdsBySupplier.get(c.entityId) ?? new Set()).add(c.id));
  const policies = certificates.map((c) => ({ supplierId: c.entityId, expiryDate: c.expiryDate ? c.expiryDate.toISOString().slice(0, 10) : null, attachmentId: c.id }));
  const certsInUse = [...new Set(activeEmployees.map((e) => e.wcAttachmentId).filter((x): x is string => !!x))];
  const companyRows = companySuppliers.map((s) => ({ id: s.id, name: s.name, trn: s.trn, tradeLicenseExpiry: s.tradeLicenseExpiry ? s.tradeLicenseExpiry.toISOString().slice(0, 10) : null }));
  const companyDocs = companyAttachments.map((a) => ({ id: a.id, supplierId: a.entityId, docType: a.docType, expiryDate: a.expiryDate ? a.expiryDate.toISOString().slice(0, 10) : null, uploadedAt: a.uploadedAt.toISOString() }));
  const matrixEmployees = activeEmployees.map((e) => ({
    id: e.id,
    name: e.name,
    employeeIdNo: e.employeeIdNo,
    hasPhoto: !!e.photoMimeType,
    supplierId: e.supplierId,
    supplierName: e.supplier?.name ?? null,
    projectId: e.projectId,
    projectName: e.project ? `${e.project.code} — ${e.project.name}` : null,
    wcCovered: !!(e.supplierId && e.wcAttachmentId && certIdsBySupplier.get(e.supplierId)?.has(e.wcAttachmentId)),
    wcAttachmentId: e.wcAttachmentId,
  }));
  const suppliers = [...new Map([...documents.filter((d) => d.employee.supplierId).map((d) => [d.employee.supplierId!, d.employee.supplier!.name] as [string, string]), ...activeEmployees.filter((e) => e.supplierId).map((e) => [e.supplierId!, e.supplier!.name] as [string, string])]).entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const projects = [...new Map([...documents.filter((d) => d.employee.projectId).map((d) => [d.employee.projectId!, `${d.employee.project!.code} — ${d.employee.project!.name}`] as [string, string]), ...activeEmployees.filter((e) => e.projectId).map((e) => [e.projectId!, `${e.project!.code} — ${e.project!.name}`] as [string, string])]).entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const statuses = documents.map((d) => complianceStatus(d.expiryDate));
  const validCount = statuses.filter((s) => s === "valid").length;
  const expiringCount = statuses.filter((s) => s === "expiring").length;
  const expiredCount = statuses.filter((s) => s === "expired").length;

  const byType = new Map<string, TypeStatusRow>();
  for (const d of documents) {
    const r = byType.get(d.type) ?? { type: d.type, label: prettyType(d.type), valid: 0, expiring: 0, expired: 0, noExpiry: 0 };
    const st = complianceStatus(d.expiryDate);
    if (st === "valid") r.valid++; else if (st === "expiring") r.expiring++; else if (st === "expired") r.expired++; else r.noExpiry++;
    byType.set(d.type, r);
  }
  // Types with something expired come first, then those expiring, then the biggest.
  const typeRows = [...byType.values()].sort((a, b) => b.expired - a.expired || b.expiring - a.expiring || b.valid + b.expiring + b.expired + b.noExpiry - (a.valid + a.expiring + a.expired + a.noExpiry));

  const rows = documents.map((d) => ({
    id: d.id,
    filename: d.filename,
    type: d.type,
    employeeId: d.employeeId,
    employeeName: d.employee.name,
    employeeIdNo: d.employee.employeeIdNo,
    employeeHasPhoto: !!d.employee.photoMimeType,
    mimeType: d.mimeType,
    supplierId: d.employee.supplierId,
    supplierName: d.employee.supplier?.name ?? null,
    projectId: d.employee.projectId,
    projectName: d.employee.project ? `${d.employee.project.code} — ${d.employee.project.name}` : null,
    uploadedByName: d.uploadedBy.name,
    uploadedAt: d.uploadedAt.toISOString(),
    expiryDate: d.expiryDate ? d.expiryDate.toISOString() : null,
    status: complianceStatus(d.expiryDate),
  }));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Documents"
        icon={FileText}
        breadcrumbs={[{ label: "Workforce", href: "/employees" }, { label: "Documents" }]}
        meta={<CountPill>{documents.length}</CountPill>}
        description="Every employee document on file, with its expiry status."
      />

      {isAdminRole(user.role) && expiredCount > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-default bg-surface px-3 py-2 text-xs text-muted">
          <span>{expiredCount} document{expiredCount === 1 ? "" : "s"} show as expired. A date the scanner read wrongly can be checked against the scan.</span>
          <RecheckExpired ids={documents.filter((d) => complianceStatus(d.expiryDate) === "expired").map((d) => d.id)} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile href="/documents?tab=all" label="All Documents" value={documents.length} icon={FileText} />
        <StatTile href="/documents?tab=valid" label="Valid" value={validCount} icon={CheckCircle2} />
        <StatTile href="/documents?tab=expiring" label="Expiring Soon" value={expiringCount} icon={AlertTriangle} tone={expiringCount > 0 ? "warning" : "default"} />
        <StatTile href="/documents?tab=expired" label="Expired" value={expiredCount} icon={AlertTriangle} tone={expiredCount > 0 ? "warning" : "default"} />
      </div>

      {documents.length > 0 && (
        <Insights id="documents" title="Documents by type and status">
          <TypeStatusBars rows={typeRows} />
        </Insights>
      )}

      <DocumentsView documents={rows} employees={employees} matrixEmployees={matrixEmployees} policies={policies} companySuppliers={companyRows} companyAttachments={companyDocs} certsInUse={certsInUse} suppliers={suppliers} projects={projects} canBulkImport={isAdminRole(user.role)} />
    </div>
  );
}
