import Link from "next/link";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/Badge";
import { DeleteButton } from "@/components/DeleteButton";
import { AttachmentUploader } from "@/components/AttachmentUploader";
import { DocumentChecklist } from "@/components/DocumentChecklist";
import type { PersonOption } from "@/components/PersonPicker";
import { PARTY_ROLE_LABEL, activeDocTypes, buildChecklist, type DocTypeDef } from "@/lib/documentTypes";
import { OWNER_ROLE } from "@/lib/ownership";
import { AddLinkForm } from "./add-link-form";
import { OwnersEditor, type OwnerRow } from "./owners-editor";
import { PersonEdit } from "./person-edit";
import { removePartyLinkAction } from "./party-actions";

/** "Khalid Al Mansoori — Owner of Al Noor, Sponsor of Gulf Skills": enough to tell two people with the same name apart. */
export function personLabel(name: string, links: { role: string; supplier: { name: string } }[]) {
  const where = links.slice(0, 2).map((l) => `${PARTY_ROLE_LABEL[l.role] ?? l.role} of ${l.supplier.name}`).join(", ");
  return where ? `${name}: ${where}${links.length > 2 ? ` +${links.length - 2}` : ""}` : name;
}

/**
 * The people behind a company. Each person is stored once and can be linked to several companies, so a person already on
 * file is picked, not typed again. Owners hold shares that add up to 100; sponsors, managers and partners hold none.
 */
export async function SupplierPartiesSection({ supplierId, branchId, types, canEdit, canOpen }: {
  supplierId: string;
  branchId: string | null;
  types: DocTypeDef[];
  /** May add, change and remove people here. */
  canEdit: boolean;
  /** May open and add the personal documents (the "Sensitive documents" permission). */
  canOpen: boolean;
}) {
  const links = await prisma.supplierPartyLink.findMany({
    where: { supplierId },
    orderBy: { createdAt: "asc" },
    include: { party: { include: { links: { select: { id: true, role: true, ownershipPercent: true, supplierId: true, supplier: { select: { name: true } } } } } } },
  });
  const persons = [...new Map(links.map((l) => [l.partyId, l.party])).values()];
  const files = persons.length
    ? await prisma.attachment.findMany({
        where: { entityType: "SUPPLIER_PARTY", entityId: { in: persons.map((p) => p.id) } },
        orderBy: { uploadedAt: "desc" },
        select: { id: true, entityId: true, docType: true, filename: true, expiryDate: true, uploadedAt: true },
      })
    : [];
  // Everyone on file in this branch, for the "choose a person" lists.
  const everyone = canEdit && branchId
    ? await prisma.supplierParty.findMany({ where: { branchId }, orderBy: { name: "asc" }, select: { id: true, name: true, links: { select: { role: true, supplier: { select: { name: true } } } } } })
    : [];
  const options: PersonOption[] = everyone.map((p) => ({ id: p.id, label: personLabel(p.name, p.links) }));

  const owners: OwnerRow[] = links.filter((l) => l.role === OWNER_ROLE).map((l) => ({ linkId: l.id, partyId: l.partyId, name: l.party.name, percent: l.ownershipPercent }));
  const upload = activeDocTypes(types).map((t) => ({ value: t.key, label: t.label }));

  return (
    <div className="space-y-5">
      {!canOpen && (
        <p className="rounded-lg border border-default bg-surface-sunken px-3 py-2 text-sm text-muted">
          Personal documents are restricted. You can see which are on file and when they expire, but opening or adding them needs the &ldquo;Sensitive documents&rdquo; permission from an administrator.
        </p>
      )}

      <OwnersEditor key={owners.map((o) => `${o.linkId}:${o.percent}`).join("|")} supplierId={supplierId} owners={owners} people={options} canEdit={canEdit} />

      {persons.length === 0 && <p className="text-sm text-muted">No owners or sponsors added yet.</p>}
      {persons.map((p) => {
        const mine = files
          .filter((f) => f.entityId === p.id)
          .map((f) => ({ id: f.id, docType: f.docType, filename: f.filename, expiryDate: f.expiryDate ? f.expiryDate.toISOString() : null, uploadedAt: f.uploadedAt.toISOString() }));
        const here = p.links.filter((l) => l.supplierId === supplierId);
        const elsewhere = p.links.filter((l) => l.supplierId !== supplierId);
        const otherCompanies = new Set(elsewhere.map((l) => l.supplierId)).size;
        return (
          <div key={p.id} id={`person-${p.id}`} className="scroll-mt-24 space-y-3 rounded-2xl border border-default p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-primary">{p.name}</p>
                <p className="text-xs text-muted">{[p.nationality, p.phone, p.email].filter(Boolean).join(" · ") || "No contact details"}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {here.map((l) => (
                    <span key={l.id} className="inline-flex items-center gap-1">
                      <Badge color="navy">{PARTY_ROLE_LABEL[l.role] ?? l.role}{l.ownershipPercent !== null ? ` · ${l.ownershipPercent}%` : ""}</Badge>
                      {canEdit && l.role !== OWNER_ROLE && (
                        <DeleteButton
                          action={removePartyLinkAction}
                          hiddenFields={{ linkId: l.id }}
                          confirmMessage={otherCompanies === 0 && here.length === 1 ? `Remove ${p.name}? This is their only company, so their details and documents are deleted too.` : `Remove ${p.name} as ${PARTY_ROLE_LABEL[l.role]?.toLowerCase() ?? l.role} of this company? They stay linked to ${otherCompanies > 0 ? "their other companies" : "this company"}.`}
                          className="rounded-md border border-[var(--error-border)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--error)] hover:bg-[var(--error-soft)]"
                        />
                      )}
                    </span>
                  ))}
                  {elsewhere.length > 0 && <span className="text-xs text-muted">Also:</span>}
                  {[...new Map(elsewhere.map((l) => [l.supplierId, l])).values()].map((l) => (
                    <Link key={l.supplierId} href={`/suppliers/${l.supplierId}`} className="rounded-md bg-surface-sunken px-1.5 py-0.5 text-xs text-secondary hover:underline">
                      {l.supplier.name}
                    </Link>
                  ))}
                </div>
              </div>
              {canEdit && <PersonEdit supplierId={supplierId} partyId={p.id} initial={{ name: p.name, nationality: p.nationality ?? "", phone: p.phone ?? "", email: p.email ?? "" }} otherCompanies={otherCompanies} />}
            </div>
            <DocumentChecklist items={buildChecklist(types, mine, false)} canOpen={canOpen} />
            {canEdit && canOpen && (
              <AttachmentUploader entityType="SUPPLIER_PARTY" entityId={p.id} entityBranchId={branchId} revalidate={`/suppliers/${supplierId}`} docTypeOptions={upload} attachments={mine} />
            )}
          </div>
        );
      })}

      {canEdit && <AddLinkForm supplierId={supplierId} people={options} linked={links.map((l) => `${l.partyId}:${l.role}`)} />}
    </div>
  );
}
