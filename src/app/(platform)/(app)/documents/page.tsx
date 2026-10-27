import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { isAdminRole } from "@/lib/roles";
import { branchWhere } from "@/lib/branch";
import { DocStatTiles } from "./doc-stat-tiles";
import { Insights } from "@/components/ListSummary";
import { TypeStatusBars, type TypeStatusRow } from "./type-status-bars";
import { PageHeader, CountPill } from "@/components/PageHeader";
import { FileText } from "lucide-react";
import { complianceStatus } from "@/lib/compliance";
import { DocumentsView } from "./documents-view";
import { COMPANY_DOC_TYPES } from "./company-docs";
import { RecheckExpired } from "./recheck-expired";
import { getRenewals } from "@/lib/renewals";
import { scanVerdict } from "@/lib/renewalScan";
import Link from "next/link";

export const metadata = { title: "Documents" };

function prettyType(type: string) {
  return type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\bId\b/, "ID");
}

export default async function DocumentsPage() {
  // This page previously queried every branch's documents with `include`,
  // which also dragged each file's `fileData` bytes across just to render a
  // filename. Scoped to the caller's branch, and selecting only what the table
  // shows.
  const { user, branchId } = await requireUserWithBranch();

  // Expiries kept on the employee record. The tiles below count the dates on uploaded files, so a record date that no
  // dated file backs up is past due here without showing as expired, which is what the Renewals page lists.
  const recordOnly = (await getRenewals(branchId, 0).catch(() => [])).filter((r) => r.kind === "employee" && r.tier === "expired" && scanVerdict(r.expiry, r.scan).kind !== "agrees");

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
    projectName: e.project ? `${e.project.code}: ${e.project.name}` : null,
    wcCovered: !!(e.supplierId && e.wcAttachmentId && certificates.some((c) => c.id === e.wcAttachmentId)),
    wcAttachmentId: e.wcAttachmentId,
  }));
  const suppliers = [...new Map([...documents.filter((d) => d.employee.supplierId).map((d) => [d.employee.supplierId!, d.employee.supplier!.name] as [string, string]), ...activeEmployees.filter((e) => e.supplierId).map((e) => [e.supplierId!, e.supplier!.name] as [string, string])]).entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const projects = [...new Map([...documents.filter((d) => d.employee.projectId).map((d) => [d.employee.projectId!, `${d.employee.project!.code}: ${d.employee.project!.name}`] as [string, string]), ...activeEmployees.filter((e) => e.projectId).map((e) => [e.projectId!, `${e.project!.code}: ${e.project!.name}`] as [string, string])]).entries()]
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
    projectName: d.employee.project ? `${d.employee.project.code}: ${d.employee.project.name}` : null,
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

      {recordOnly.length > 0 && (
        <p className="rounded-lg border border-[var(--warning-border)] bg-[var(--warning-soft)] px-3 py-2 text-xs text-[var(--warning)]">
          {recordOnly.length} more expir{recordOnly.length === 1 ? "y is" : "ies are"} past due on employee records without a dated file behind {recordOnly.length === 1 ? "it" : "them"}, so {recordOnly.length === 1 ? "it isn't" : "they aren't"} counted in the tiles below.{" "}
          <Link href="/employees/renewals" className="font-medium underline">See them in Renewals</Link>
        </p>
      )}

      {isAdminRole(user.role) && expiredCount > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-default bg-surface px-3 py-2 text-xs text-muted">
          <span>{expiredCount} document{expiredCount === 1 ? "" : "s"} show as expired. A date the scanner read wrongly can be checked against the scan.</span>
          <RecheckExpired ids={documents.filter((d) => complianceStatus(d.expiryDate) === "expired").map((d) => d.id)} />
        </div>
      )}

      <DocStatTiles total={documents.length} valid={validCount} expiring={expiringCount} expired={expiredCount} />

      {documents.length > 0 && (
        <Insights id="documents" title="Documents by type and status">
          <TypeStatusBars rows={typeRows} />
        </Insights>
      )}

      <DocumentsView documents={rows} employees={employees} matrixEmployees={matrixEmployees} policies={policies} companySuppliers={companyRows} companyAttachments={companyDocs} certsInUse={certsInUse} suppliers={suppliers} projects={projects} canBulkImport={isAdminRole(user.role)} />
    </div>
  );
}
