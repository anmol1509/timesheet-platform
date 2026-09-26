import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { StatTile } from "@/components/StatTile";
import { PageHeader, CountPill } from "@/components/PageHeader";
import { FileText, CheckCircle2, AlertTriangle } from "lucide-react";
import { complianceStatus } from "@/lib/compliance";
import { DocumentBrowser } from "./document-browser";

export default async function DocumentsPage() {
  // This page previously queried every branch's documents with `include`,
  // which also dragged each file's `fileData` bytes across just to render a
  // filename. Scoped to the caller's branch, and selecting only what the table
  // shows.
  const { branchId } = await requireUserWithBranch();

  const [documents, employees] = await Promise.all([
    prisma.document.findMany({
      where: { employee: branchWhere(branchId) },
      select: {
        id: true,
        filename: true,
        type: true,
        employeeId: true,
        uploadedAt: true,
        expiryDate: true,
        employee: { select: { name: true, employeeIdNo: true, photoMimeType: true } },
        uploadedBy: { select: { name: true } },
      },
      orderBy: { uploadedAt: "desc" },
    }),
    prisma.employee.findMany({
      where: branchWhere(branchId),
      select: { id: true, name: true, employeeIdNo: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const statuses = documents.map((d) => complianceStatus(d.expiryDate));
  const validCount = statuses.filter((s) => s === "valid").length;
  const expiringCount = statuses.filter(
    (s) => s === "expiring" || s === "expired"
  ).length;

  const rows = documents.map((d) => ({
    id: d.id,
    filename: d.filename,
    type: d.type,
    employeeId: d.employeeId,
    employeeName: d.employee.name,
    employeeIdNo: d.employee.employeeIdNo,
    employeeHasPhoto: !!d.employee.photoMimeType,
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile
          href="/documents?tab=all"
          label="Total Documents"
          value={documents.length}
          icon={FileText}
        />
        <StatTile
          href="/documents?tab=valid"
          label="Valid Documents"
          value={validCount}
          icon={CheckCircle2}
        />
        <StatTile
          href="/documents?tab=expiring"
          label="Expiring / Expired"
          value={expiringCount}
          icon={AlertTriangle}
          tone={expiringCount > 0 ? "warning" : "default"}
        />
      </div>

      <DocumentBrowser documents={rows} employees={employees} />
    </div>
  );
}
