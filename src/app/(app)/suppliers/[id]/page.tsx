import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/Badge";
import { DeleteButton } from "@/components/DeleteButton";
import { SupplierCompanyForm } from "./company-form";
import { SupplierContactPaymentForm } from "./contact-payment-form";
import { SupplierApprovals } from "./supplier-approvals";
import { deleteSupplierAction } from "../actions";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch, branchWhere } from "@/lib/branch";
import { AttachmentUploader } from "@/components/AttachmentUploader";
import { SupplierTabs } from "./supplier-tabs";
import { SubsidiaryTabs } from "./subsidiary-tabs";

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
    include: {
      _count: { select: { employees: true, entries: true } },
      parent: {
        select: {
          id: true,
          name: true,
          subsidiaries: { select: { id: true, name: true }, orderBy: { name: "asc" } },
        },
      },
      subsidiaries: { select: { id: true, name: true }, orderBy: { name: "asc" } },
    },
  });
  if (!supplier || isOutsideBranch(supplier.branchId, branchId, isSuperAdmin)) notFound();

  const root = supplier.parent ?? { id: supplier.id, name: supplier.name };
  const siblings = supplier.parent ? supplier.parent.subsidiaries : supplier.subsidiaries;

  const [attachments, parentOptions] = await Promise.all([
    prisma.attachment.findMany({
      where: { entityType: "SUPPLIER", entityId: supplier.id },
      orderBy: { uploadedAt: "desc" },
      select: { id: true, docType: true, filename: true, expiryDate: true, uploadedAt: true },
    }),
    prisma.supplier.findMany({
      where: { ...branchWhere(branchId), parentSupplierId: null, id: { not: supplier.id } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  // The current parent might belong to a different branch (e.g. legacy data,
  // or a subsidiary created before parents always matched branches) — always
  // include it so the Parent Supplier <select> has a matching option to
  // display its name instead of falling back to the raw id.
  const parentOptionsWithCurrent =
    supplier.parent && !parentOptions.some((p) => p.id === supplier.parent!.id)
      ? [...parentOptions, { id: supplier.parent.id, name: supplier.parent.name }].sort((a, b) =>
          a.name.localeCompare(b.name)
        )
      : parentOptions;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/suppliers" className="text-sm text-muted hover:underline">
          ← Suppliers
        </Link>
      </div>

      <div>
        <SubsidiaryTabs
          currentId={supplier.id}
          rootId={root.id}
          rootName={root.name}
          subsidiaries={siblings}
        />
        <div className="rounded-b-3xl rounded-tr-3xl border border-default bg-surface p-5">
          {isSuperAdmin && !branchId && (
            <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              You&apos;re viewing <strong>All branches</strong>. Pick a specific branch from
              the switcher (top right) before editing or adding a subsidiary here.
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-xl tracking-tight text-primary font-semibold">
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
        <p className="mt-1 text-sm text-muted">
          {supplier._count.employees > 0 ? (
            <Link
              href={`/employees?supplier=${supplier.id}`}
              className="text-[var(--brand-primary)] hover:underline"
            >
              {supplier._count.employees} employees
            </Link>
          ) : (
            "0 employees"
          )}{" "}
          · {supplier._count.entries} timesheet rows
        </p>
        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        </div>
      </div>

      <SupplierTabs
        tabs={[
          {
            id: "documents",
            label: "Documents",
            content: (
              <div className="space-y-6">
                <section>
                  <h2 className="mb-3 text-sm font-semibold text-primary">Documents</h2>
                  <p className="mb-3 text-sm text-muted">
                    Trade licence and MOHRE permit first — those decide whether this
                    supplier can be used at all.
                  </p>
                  <AttachmentUploader
                    entityType="SUPPLIER"
                    entityId={supplier.id}
                    entityBranchId={supplier.branchId}
                    revalidate={`/suppliers/${supplier.id}`}
                    docTypeOptions={[
                      { value: "TRADE_LICENSE", label: "Trade Licence" },
                      { value: "MOHRE_PERMIT", label: "MOHRE Permit" },
                      { value: "WORKMEN_COMPENSATION_INSURANCE", label: "Workmen Compensation Insurance" },
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
            ),
          },
          {
            id: "overview",
            label: "Overview",
            content: (
              <SupplierApprovals
                supplierId={supplier.id}
                values={{
                  approvalStatus: supplier.approvalStatus,
                  labourApprovalStatus: supplier.labourApprovalStatus,
                  invoiceApprovalStatus: supplier.invoiceApprovalStatus,
                }}
              />
            ),
          },
          {
            id: "company",
            label: "Company",
            content: (
              <SupplierCompanyForm
                parentOptions={parentOptionsWithCurrent}
                supplier={{
                  id: supplier.id,
                  parentSupplierId: supplier.parentSupplierId,
                  fullName: supplier.fullName,
                  status: supplier.status,
                  trn: supplier.trn,
                  activeFrom: toDateInput(supplier.activeFrom),
                  mohrePermitNumber: supplier.mohrePermitNumber,
                  tradeLicenseNumber: supplier.tradeLicenseNumber,
                  tradeLicenseExpiry: toDateInput(supplier.tradeLicenseExpiry),
                  category: supplier.category,
                  previousId: supplier.previousId,
                  country: supplier.country,
                  emirate: supplier.emirate,
                  pointOfContact: supplier.pointOfContact,
                  supplierAmountLimit: supplier.supplierAmountLimit,
                  account: supplier.account,
                  allowManualLabourId: supplier.allowManualLabourId,
                  overtime: supplier.overtime,
                }}
              />
            ),
          },
          {
            id: "contact-payment",
            label: "Contact & Payment",
            content: (
              <SupplierContactPaymentForm
                supplier={{
                  id: supplier.id,
                  contactPerson: supplier.contactPerson,
                  contactPhone: supplier.contactPhone,
                  contactEmail: supplier.contactEmail,
                  phone: supplier.phone,
                  location: supplier.location,
                  poBox: supplier.poBox,
                  bankName: supplier.bankName,
                  iban: supplier.iban,
                  bankAccountName: supplier.bankAccountName,
                  bankAccountNumber: supplier.bankAccountNumber,
                  bankCompany: supplier.bankCompany,
                  bankEmirate: supplier.bankEmirate,
                  paymentTerms: supplier.paymentTerms,
                  payoutCycleStartDay: supplier.payoutCycleStartDay,
                }}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
