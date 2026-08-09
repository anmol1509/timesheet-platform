import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/Badge";
import { DeleteButton } from "@/components/DeleteButton";
import { EditSupplierForm } from "./edit-form";
import { SupplierApprovals } from "./supplier-approvals";
import { deleteSupplierAction } from "../actions";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { AttachmentUploader } from "@/components/AttachmentUploader";

function toDateInput(d: Date | null) {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

export default async function SupplierDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const supplier = await prisma.supplier.findUnique({
    where: { id },
    include: { _count: { select: { employees: true, entries: true } } },
  });
  if (!supplier || isOutsideBranch(supplier.branchId, branchId, isSuperAdmin)) notFound();

  const attachments = await prisma.attachment.findMany({
    where: { entityType: "SUPPLIER", entityId: supplier.id },
    orderBy: { uploadedAt: "desc" },
    select: { id: true, docType: true, filename: true, expiryDate: true, uploadedAt: true },
  });

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/suppliers" className="text-sm text-slate-500 hover:underline">
          ← Suppliers
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">
              {supplier.name}
            </h1>
            <Badge color={supplier.status === "ACTIVE" ? "green" : "red"}>
              {supplier.status}
            </Badge>
          </div>
          <DeleteButton
            action={deleteSupplierAction}
            hiddenFields={{ supplierId: supplier.id }}
            confirmMessage={`Delete supplier "${supplier.name}"?${
              supplier._count.employees > 0
                ? ` ${supplier._count.employees} employee(s) will be unassigned.`
                : ""
            }`}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
          />
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {supplier._count.employees} employees · {supplier._count.entries}{" "}
          timesheet rows
        </p>
        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>

      <SupplierApprovals
        supplierId={supplier.id}
        values={{
          approvalStatus: supplier.approvalStatus,
          labourApprovalStatus: supplier.labourApprovalStatus,
          invoiceApprovalStatus: supplier.invoiceApprovalStatus,
        }}
      />

      <EditSupplierForm
        supplier={{
          id: supplier.id,
          fullName: supplier.fullName,
          mohrePermitNumber: supplier.mohrePermitNumber,
          tradeLicenseNumber: supplier.tradeLicenseNumber,
          tradeLicenseExpiry: toDateInput(supplier.tradeLicenseExpiry),
          contactPerson: supplier.contactPerson,
          contactPhone: supplier.contactPhone,
          contactEmail: supplier.contactEmail,
          bankName: supplier.bankName,
          iban: supplier.iban,
          paymentTerms: supplier.paymentTerms,
          status: supplier.status,
          payoutCycleStartDay: supplier.payoutCycleStartDay,
          category: supplier.category,
          previousId: supplier.previousId,
          allowManualLabourId: supplier.allowManualLabourId,
          overtime: supplier.overtime,
          supplierAmountLimit: supplier.supplierAmountLimit,
          pointOfContact: supplier.pointOfContact,
          country: supplier.country,
          emirate: supplier.emirate,
          account: supplier.account,
          bankAccountName: supplier.bankAccountName,
          bankAccountNumber: supplier.bankAccountNumber,
          bankCompany: supplier.bankCompany,
          bankEmirate: supplier.bankEmirate,
          trn: supplier.trn,
          activeFrom: toDateInput(supplier.activeFrom),
          poBox: supplier.poBox,
          location: supplier.location,
          phone: supplier.phone,
        }}
      />

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Documents</h2>
        <AttachmentUploader
          entityType="SUPPLIER"
          entityId={supplier.id}
          entityBranchId={supplier.branchId}
          revalidate={`/suppliers/${supplier.id}`}
          docTypeOptions={[
            { value: "TRADE_LICENSE", label: "Trade License" },
            { value: "MOHRE_PERMIT", label: "MOHRE Permit" },
            { value: "CONTRACT", label: "Contract" },
            { value: "OTHER", label: "Other" },
          ]}
          attachments={attachments.map((a) => ({
            id: a.id,
            docType: a.docType,
            filename: a.filename,
            expiryDate: a.expiryDate ? a.expiryDate.toISOString() : null,
            uploadedAt: a.uploadedAt.toISOString(),
          }))}
        />
      </section>
    </div>
  );
}
