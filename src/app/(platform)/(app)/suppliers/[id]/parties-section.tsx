import { prisma } from "@/lib/db";
import { DeleteButton } from "@/components/DeleteButton";
import { AttachmentUploader } from "@/components/AttachmentUploader";
import { DocumentChecklist } from "@/components/DocumentChecklist";
import { PARTY_ROLE_LABEL, activeDocTypes, buildChecklist, type DocTypeDef } from "@/lib/documentTypes";
import { AddPartyForm } from "./add-party-form";
import { deleteSupplierPartyAction } from "./party-actions";

/** The owners and sponsors behind a supplier, each with their own document checklist and uploader. */
export async function SupplierPartiesSection({ supplierId, branchId, types, canEdit }: { supplierId: string; branchId: string | null; types: DocTypeDef[]; canEdit: boolean }) {
  const parties = await prisma.supplierParty.findMany({ where: { supplierId }, orderBy: [{ role: "asc" }, { createdAt: "asc" }] });
  const files = parties.length
    ? await prisma.attachment.findMany({
        where: { entityType: "SUPPLIER_PARTY", entityId: { in: parties.map((p) => p.id) } },
        orderBy: { uploadedAt: "desc" },
        select: { id: true, entityId: true, docType: true, filename: true, expiryDate: true, uploadedAt: true },
      })
    : [];
  const options = activeDocTypes(types).map((t) => ({ value: t.key, label: t.label }));

  return (
    <div className="space-y-5">
      {parties.length === 0 && <p className="text-sm text-muted">No owner or sponsor added yet.</p>}
      {parties.map((p) => {
        const mine = files
          .filter((f) => f.entityId === p.id)
          .map((f) => ({ id: f.id, docType: f.docType, filename: f.filename, expiryDate: f.expiryDate ? f.expiryDate.toISOString() : null, uploadedAt: f.uploadedAt.toISOString() }));
        return (
          <div key={p.id} className="space-y-3 rounded-2xl border border-default p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium text-primary">
                  {p.name} <span className="ml-1 text-xs font-normal text-muted">{PARTY_ROLE_LABEL[p.role] ?? p.role}</span>
                </p>
                <p className="text-xs text-muted">{[p.nationality, p.phone, p.email].filter(Boolean).join(" · ") || "No contact details"}</p>
              </div>
              {canEdit && (
                <DeleteButton
                  action={deleteSupplierPartyAction}
                  hiddenFields={{ partyId: p.id }}
                  confirmMessage={`Remove ${p.name} and all of their documents?`}
                  className="rounded-lg border border-[var(--error-border)] px-3 py-1.5 text-xs font-medium text-[var(--error)] hover:bg-[var(--error-soft)]"
                />
              )}
            </div>
            <DocumentChecklist items={buildChecklist(types, mine, false)} />
            {canEdit && (
              <AttachmentUploader
                entityType="SUPPLIER_PARTY"
                entityId={p.id}
                entityBranchId={branchId}
                revalidate={`/suppliers/${supplierId}`}
                docTypeOptions={options}
                attachments={mine}
              />
            )}
          </div>
        );
      })}
      {canEdit && <AddPartyForm supplierId={supplierId} />}
    </div>
  );
}
