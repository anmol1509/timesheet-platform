import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { DeleteButton } from "@/components/DeleteButton";
import { EditSponsorshipCompanyForm } from "./edit-form";
import { deleteSponsorshipCompanyAction } from "../actions";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { AttachmentUploader } from "@/components/AttachmentUploader";

export default async function SponsorshipCompanyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const sponsorshipCompany = await prisma.sponsorshipCompany.findUnique({
    where: { id },
    include: { _count: { select: { employees: true } } },
  });
  if (
    !sponsorshipCompany ||
    isOutsideBranch(sponsorshipCompany.branchId, branchId, isSuperAdmin)
  )
    notFound();

  const attachments = await prisma.attachment.findMany({
    where: { entityType: "SPONSORSHIP_COMPANY", entityId: sponsorshipCompany.id },
    orderBy: { uploadedAt: "desc" },
    select: { id: true, docType: true, filename: true, expiryDate: true, uploadedAt: true },
  });

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/sponsorship-companies" className="text-sm text-slate-500 hover:underline">
          ← Sponsorship Companies
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-slate-900">
            {sponsorshipCompany.name}
          </h1>
          <DeleteButton
            action={deleteSponsorshipCompanyAction}
            hiddenFields={{ sponsorshipCompanyId: sponsorshipCompany.id }}
            confirmMessage={`Delete sponsorship company "${sponsorshipCompany.name}"?${
              sponsorshipCompany._count.employees > 0
                ? ` It is still linked to ${sponsorshipCompany._count.employees} employee(s).`
                : ""
            }`}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
          />
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {sponsorshipCompany._count.employees > 0 ? (
            <Link
              href={`/employees?sponsor=${sponsorshipCompany.id}`}
              className="text-[var(--brand-primary)] hover:underline"
            >
              {sponsorshipCompany._count.employees} employee
              {sponsorshipCompany._count.employees === 1 ? "" : "s"}
            </Link>
          ) : (
            `0 employees`
          )}{" "}
          sponsored
        </p>
        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>

      <EditSponsorshipCompanyForm
        sponsorshipCompany={{
          id: sponsorshipCompany.id,
          shortName: sponsorshipCompany.shortName,
          address: sponsorshipCompany.address,
          country: sponsorshipCompany.country,
          currency: sponsorshipCompany.currency,
          phone: sponsorshipCompany.phone,
          email: sponsorshipCompany.email,
          tradeLicenseNumber: sponsorshipCompany.tradeLicenseNumber,
        }}
      />

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Documents</h2>
        <AttachmentUploader
          entityType="SPONSORSHIP_COMPANY"
          entityId={sponsorshipCompany.id}
          entityBranchId={sponsorshipCompany.branchId}
          revalidate={`/sponsorship-companies/${sponsorshipCompany.id}`}
          docTypeOptions={[
            { value: "TRADE_LICENSE", label: "Trade License" },
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
