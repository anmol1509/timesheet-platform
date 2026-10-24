import { LetterheadMargins } from "@/components/LetterheadMargins";
import { saveSupplierLetterheadMarginsAction } from "../actions";
import { SupplierLettersSection } from "./supplier-letters-section";
import { notFound } from "next/navigation";
import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/Badge";
import { DeleteButton } from "@/components/DeleteButton";
import { SupplierCompanyForm } from "./company-form";
import { SupplierContactPaymentForm } from "./contact-payment-form";
import { SupplierApprovals } from "./supplier-approvals";
import { deleteSupplierAction } from "../actions";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { PortalAccessCard } from "./portal-access";
import { isOutsideBranch } from "@/lib/branch";
import { AttachmentUploader } from "@/components/AttachmentUploader";
import { SupplierTabs } from "./supplier-tabs";
import { PartyStatement, canSeeStatement } from "../../finance/books/parties/statement";
import { WorkmenCompSection } from "./workmen-comp-section";
import { SubsidiaryTabs } from "./subsidiary-tabs";
import { SupplierHierarchyCard } from "./hierarchy-card";
import { DocumentChecklist } from "@/components/DocumentChecklist";
import { SupplierPartiesSection } from "./parties-section";
import { activeDocTypes, buildChecklist, resolveDocTypes } from "@/lib/documentTypes";

export const metadata = { title: "Supplier" };

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
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const supplier = await prisma.supplier.findUnique({
    where: { id },
    include: {
      _count: { select: { employees: true, entries: true } },
      parent: {
        select: {
          id: true,
          name: true,
          isOwnCompany: true,
          subsidiaries: { select: { id: true, name: true }, orderBy: { name: "asc" } },
        },
      },
      subsidiaries: { select: { id: true, name: true }, orderBy: { name: "asc" } },
    },
  });
  if (!supplier || isOutsideBranch(supplier.branchId, branchId, isSuperAdmin)) notFound();

  const root = supplier.parent ?? { id: supplier.id, name: supplier.name };
  const siblings = supplier.parent ? supplier.parent.subsidiaries : supplier.subsidiaries;

  const WC_TYPES = ["WORKMEN_COMPENSATION_INSURANCE", "WORKMEN_COMPENSATION"];
  const [typeRows, attachments, parentOptions, coveredBy, workerCount] = await Promise.all([
    prisma.documentType.findMany({ where: { branchId: supplier.branchId } }),
    prisma.attachment.findMany({
      where: { entityType: "SUPPLIER", entityId: supplier.id },
      orderBy: { uploadedAt: "desc" },
      select: { id: true, docType: true, filename: true, expiryDate: true, uploadedAt: true },
    }),
    prisma.supplier.findMany({
      where: { branchId: supplier.branchId, parentSupplierId: null, id: { not: supplier.id } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.employee.groupBy({ by: ["wcAttachmentId"], where: { supplierId: supplier.id, wcAttachmentId: { not: null } }, _count: true }),
    prisma.employee.count({ where: { supplierId: supplier.id, active: true } }),
  ]);
  const wcPolicies = attachments
    .filter((a) => WC_TYPES.includes(a.docType))
    .map((a) => ({ id: a.id, filename: a.filename, expiryDate: a.expiryDate ? a.expiryDate.toISOString() : null, covered: coveredBy.find((c) => c.wcAttachmentId === a.id)?._count ?? 0 }));

  const showStatement = await canSeeStatement();
  const canEdit = can(subjectOf(user), "partners.suppliers", "edit");
  const companyTypes = resolveDocTypes(typeRows, "SUPPLIER");
  const partyTypes = resolveDocTypes(typeRows, "SUPPLIER_PARTY");
  const companyFiles = attachments
    .filter((a) => !WC_TYPES.includes(a.docType))
    .map((a) => ({ id: a.id, docType: a.docType, filename: a.filename, expiryDate: a.expiryDate ? a.expiryDate.toISOString() : null, uploadedAt: a.uploadedAt.toISOString() }));
  // Types a file was filed under before the registry (or that a branch has since removed) still need a label in the list.
  const known = new Set(companyTypes.map((t) => t.key));
  const legacyOptions = [...new Set(companyFiles.map((a) => a.docType))].filter((k) => !known.has(k) && !WC_TYPES.includes(k)).map((k) => ({ value: k, label: k }));

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
            <p className="mb-3 rounded-lg border border-[var(--warning-border)] bg-[var(--warning-soft)] px-3 py-2 text-sm text-[var(--warning)]">
              You&apos;re viewing <strong>All branches</strong>. Pick a specific branch from
              the switcher (top right) before editing or adding a subsidiary here.
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-xl tracking-tight text-primary font-semibold">
              {supplier.name}
            </h1>
            {supplier.isOwnCompany && (
              <span title="Own company">
                <BadgeCheck className="h-4 w-4 shrink-0 text-[var(--brand-primary)]" aria-label="Own company" />
              </span>
            )}
            {supplier.code && (
              <span className="tabular rounded-md bg-surface-sunken px-1.5 py-0.5 text-xs font-medium text-secondary">
                {supplier.code}
              </span>
            )}
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
            className="rounded-lg border border-[var(--error-border)] px-3 py-1.5 text-xs font-medium text-[var(--error)] hover:bg-[var(--error-soft)]"
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
          <p className="mt-3 rounded-lg bg-[var(--error-soft)] px-3 py-2 text-sm text-[var(--error)]">
            {error}
          </p>
        )}
        </div>
      </div>

      <PortalAccessCard
        supplierId={supplier.id}
        enabled={supplier.portalEnabled}
        canEdit={can(subjectOf(user), "partners.suppliers", "edit")}
        phones={[supplier.contactPhone, supplier.phone, supplier.coordinatorPhone].filter((p): p is string => !!p)}
      />

      <SupplierTabs
        tabs={[
          {
            id: "documents",
            label: "Documents",
            content: (
              <div className="space-y-6">
                <section>
                  <h2 className="mb-1 text-sm font-semibold text-primary">Workmen compensation</h2>
                  <WorkmenCompSection supplierId={supplier.id} policies={wcPolicies} workers={workerCount} canEdit={can(subjectOf(user), "partners.suppliers", "edit")} />
                </section>
                <section>
                  <h2 className="mb-1 text-sm font-semibold text-primary">Company documents</h2>
                  <p className="mb-3 text-sm text-muted">
                    Trade licence, establishment card, VAT certificate and the rest. Required ones show in red until a file is uploaded.
                    {supplier.isOwnCompany && " This is your own company, so the tenancy agreement is required too."}
                  </p>
                  <div className="space-y-4">
                    <DocumentChecklist items={buildChecklist(companyTypes, companyFiles, supplier.isOwnCompany)} />
                    {canEdit && (
                      <AttachmentUploader
                        entityType="SUPPLIER"
                        entityId={supplier.id}
                        entityBranchId={supplier.branchId}
                        revalidate={`/suppliers/${supplier.id}`}
                        docTypeOptions={[...activeDocTypes(companyTypes).map((t) => ({ value: t.key, label: t.label })), ...legacyOptions]}
                        attachments={companyFiles}
                      />
                    )}
                  </div>
                </section>
                <section>
                  <h2 className="mb-1 text-sm font-semibold text-primary">Owner &amp; sponsor</h2>
                  <p className="mb-3 text-sm text-muted">
                    The licence owner and the sponsor who runs the company day to day, each with their own passport, Emirates ID, visa, insurance and other documents.
                  </p>
                  <SupplierPartiesSection supplierId={supplier.id} branchId={supplier.branchId} types={partyTypes} canEdit={canEdit} />
                </section>
                <section>
                  <h2 className="mb-1 text-sm font-semibold text-primary">Signatory, signature &amp; stamp</h2>
                  <p className="mb-3 text-sm text-muted">Used on employee letters issued for this company (as the visa or supplier company), when you tick them on the letter. Upload the letterhead itself under Documents, as type Letterhead.</p>
                  <SupplierLettersSection
                    supplierId={supplier.id}
                    signatoryName={supplier.signatoryName ?? ""}
                    signatoryTitle={supplier.signatoryTitle ?? ""}
                    signatureUrl={supplier.signatureId ? `/api/images/${supplier.signatureId}` : null}
                    stampUrl={supplier.stampId ? `/api/images/${supplier.stampId}` : null}
                  />
                </section>
                {attachments.some((a) => a.docType === "LETTERHEAD") && (
                  <section>
                    <h2 className="mb-1 text-sm font-semibold text-primary">Letterhead margins</h2>
                    <p className="mb-3 text-sm text-muted">NOCs for workers this supplier sponsors are printed on its letterhead. Set how much space to keep clear for the header and footer.</p>
                    <LetterheadMargins
                      letterheadUrl={`/api/suppliers/${supplier.id}/letterhead`}
                      topMm={supplier.letterheadTopMm ?? 65}
                      bottomMm={supplier.letterheadBottomMm ?? 35}
                      action={saveSupplierLetterheadMarginsAction}
                      extraFields={{ supplierId: supplier.id }}
                    />
                  </section>
                )}
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
              <div className="space-y-6">
              <SupplierHierarchyCard
                supplierId={supplier.id}
                supplierName={supplier.name}
                parent={supplier.parent ? { id: supplier.parent.id, name: supplier.parent.name } : null}
                subsidiaryCount={supplier.subsidiaries.length}
                primaryOptions={parentOptions}
              />
              <SupplierCompanyForm
                parentIsOwnCompany={!!supplier.parent?.isOwnCompany}
                supplier={{
                  id: supplier.id,
                  name: supplier.name,
                  code: supplier.code,
                  isOwnCompany: supplier.isOwnCompany,
                  payType: supplier.payType,
                  wpsEstablishmentId: supplier.wpsEstablishmentId,
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
                  supplierAmountLimit: supplier.supplierAmountLimit,
                  account: supplier.account,
                  allowManualLabourId: supplier.allowManualLabourId,
                  overtime: supplier.overtime,
                  absentFreeDays: supplier.absentFreeDays,
                  absentDeductionPerDay: Number(supplier.absentDeductionPerDay),
                  gasPerDay: Number(supplier.gasPerDay),
                  gasMonthlyCap: Number(supplier.gasMonthlyCap),
                  shortfallMode: supplier.shortfallMode,
                  shortfallHalfDayUnder: Number(supplier.shortfallHalfDayUnder),
                }}
              />
              </div>
            ),
          },
          {
            id: "contact-payment",
            label: "Contact & Payment",
            content: (
              <SupplierContactPaymentForm
                supplier={{
                  id: supplier.id,
                  country: supplier.country,
                  contactPerson: supplier.contactPerson,
                  contactPhone: supplier.contactPhone,
                  contactEmail: supplier.contactEmail,
                  phone: supplier.phone,
                  location: supplier.location,
                  poBox: supplier.poBox,
                  coordinatorName: supplier.coordinatorName,
                  coordinatorPhone: supplier.coordinatorPhone,
                  coordinatorEmail: supplier.coordinatorEmail,
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
          ...(showStatement ? [{ id: "statement", label: "Statement", content: <PartyStatement type="SUPPLIER" id={supplier.id} /> }] : []),
        ]}
      />
    </div>
  );
}
