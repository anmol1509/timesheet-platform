import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { isAdminRole } from "@/lib/roles";
import { branchWhere } from "@/lib/branch";
import { StatTile } from "@/components/StatTile";
import { Insights } from "@/components/ListSummary";
import { Heatmap } from "@/components/Heatmap";
import { PageHeader, CountPill } from "@/components/PageHeader";
import { FileText, CheckCircle2, AlertTriangle } from "lucide-react";
import { complianceStatus } from "@/lib/compliance";
import { DocumentBrowser } from "./document-browser";

const STATUS_COLS = ["Valid", "Expiring", "Expired", "No expiry"] as const;
const STATUS_KEY: Record<(typeof STATUS_COLS)[number], ReturnType<typeof complianceStatus>> = {
  Valid: "valid",
  Expiring: "expiring",
  Expired: "expired",
  "No expiry": "not_set",
};

function prettyType(type: string) {
  return type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function DocumentsPage() {
  // This page previously queried every branch's documents with `include`,
  // which also dragged each file's `fileData` bytes across just to render a
  // filename. Scoped to the caller's branch, and selecting only what the table
  // shows.
  const { user, branchId } = await requireUserWithBranch();

  const [documents, employees] = await Promise.all([
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
  ]);
  const suppliers = [...new Map(documents.filter((d) => d.employee.supplierId).map((d) => [d.employee.supplierId!, d.employee.supplier!.name])).entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const projects = [...new Map(documents.filter((d) => d.employee.projectId).map((d) => [d.employee.projectId!, `${d.employee.project!.code} — ${d.employee.project!.name}`])).entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const statuses = documents.map((d) => complianceStatus(d.expiryDate));
  const validCount = statuses.filter((s) => s === "valid").length;
  const expiringCount = statuses.filter((s) => s === "expiring").length;
  const expiredCount = statuses.filter((s) => s === "expired").length;

  const byType = new Map<string, number>();
  for (const d of documents) byType.set(d.type, (byType.get(d.type) ?? 0) + 1);
  const typeOrder = [...byType.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  const typeStatusMatrix = typeOrder.map((type) =>
    STATUS_COLS.map((col) => documents.filter((d) => d.type === type && complianceStatus(d.expiryDate) === STATUS_KEY[col]).length)
  );

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

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile href="/documents?tab=all" label="All Documents" value={documents.length} icon={FileText} />
        <StatTile href="/documents?tab=valid" label="Valid" value={validCount} icon={CheckCircle2} />
        <StatTile href="/documents?tab=expiring" label="Expiring Soon" value={expiringCount} icon={AlertTriangle} tone={expiringCount > 0 ? "warning" : "default"} />
        <StatTile href="/documents?tab=expired" label="Expired" value={expiredCount} icon={AlertTriangle} tone={expiredCount > 0 ? "warning" : "default"} />
      </div>

      {documents.length > 0 && (
        <Insights id="documents" title="Documents by type and status">
          <Heatmap rows={typeOrder.map(prettyType)} cols={[...STATUS_COLS]} matrix={typeStatusMatrix} />
        </Insights>
      )}

      <DocumentBrowser documents={rows} employees={employees} suppliers={suppliers} projects={projects} canBulkImport={isAdminRole(user.role)} />
    </div>
  );
}
