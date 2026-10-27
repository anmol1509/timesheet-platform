import { FileText } from "lucide-react";
import { HeroHeader } from "@/components/HeroHeader";
import { requireAdmin, resolveSuperAdminBranchId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { resolveDocTypes } from "@/lib/documentTypes";
import { DocumentTypeForm } from "./document-type-form";
import { TypeRow } from "./type-row";

export const metadata = { title: "Document types" };

const GROUPS = [
  { appliesTo: "SUPPLIER", title: "Company documents", hint: "Filed against a supplier company, including your own." },
  { appliesTo: "SUPPLIER_PARTY", title: "Owner & sponsor documents", hint: "Filed against the owner, sponsor, partner or manager of a company." },
  { appliesTo: "CANDIDATE", title: "Candidate documents", hint: "Handed over by a candidate before joining: passport copy, photo, certificates. Required ones are checked before adding them as an employee." },
  { appliesTo: "VEHICLE", title: "Vehicle documents", hint: "Filed against a vehicle: Mulkiya, insurance, passing test, permits and more." },
] as const;

export default async function DocumentTypesPage() {
  const admin = await requireAdmin();
  const branchId = admin.role === "SUPER_ADMIN" ? await resolveSuperAdminBranchId() : admin.branchId;
  if (!branchId) {
    return <p className="card max-w-md p-5 text-sm text-muted">Sign in as a company administrator to manage its document types.</p>;
  }
  const rows = await prisma.documentType.findMany({ where: { branchId } });
  const changedKeys = new Set(rows.map((r) => `${r.appliesTo}|${r.key}`));
  const all = resolveDocTypes(rows);

  return (
    <div className="space-y-6">
      <HeroHeader
        icon={FileText}
        title="Document types"
        subtitle="Choose which documents each company, owner, sponsor and vehicle can hold, which are required, and when to remind you before they expire."
        pills={[
          { label: "Types", value: String(all.filter((t) => t.isActive).length) },
          { label: "Custom", value: String(all.filter((t) => !t.builtIn).length) },
        ]}
      />
      {GROUPS.map((g) => (
        <section key={g.appliesTo} className="max-w-3xl">
          <h2 className="text-sm font-semibold text-primary">{g.title}</h2>
          <p className="mb-3 text-sm text-muted">{g.hint}</p>
          <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-default bg-surface">
            {all
              .filter((t) => t.appliesTo === g.appliesTo)
              .map((t) => (
                <TypeRow
                  key={t.key}
                  t={{ appliesTo: t.appliesTo, key: t.key, label: t.label, hasExpiry: t.hasExpiry, required: t.required, reminderDays: t.reminderDays, isActive: t.isActive, builtIn: t.builtIn, changed: changedKeys.has(`${t.appliesTo}|${t.key}`) }}
                />
              ))}
          </ul>
          <div className="mt-3 rounded-2xl border border-dashed border-strong p-4">
            <p className="mb-2 text-xs font-medium text-muted">Add your own</p>
            <DocumentTypeForm initial={{ appliesTo: g.appliesTo, label: "", hasExpiry: true, required: "NO", reminderDays: "90, 60, 30, 7", isActive: true }} />
          </div>
        </section>
      ))}
    </div>
  );
}
