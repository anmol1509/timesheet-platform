import { prisma } from "@/lib/db";
import { getVendor } from "@/lib/vendor/session";
import { FIELD_LABELS, SUPPLIER_DOC_TYPES } from "@/lib/supplierRequests";
import { ProfileForms, type PendingRow } from "./profile-forms";

export const metadata = { title: "Profile" };

const maskIban = (s: string | null) => (s ? `${s.replace(/\s+/g, "").slice(0, 4)} •••• •••• ${s.replace(/\s+/g, "").slice(-4)}` : "");
const DAY = 86_400_000;

export default async function VendorProfilePage() {
  const vendor = (await getVendor())!;
  const now = new Date();
  const [s, pending, docs] = await Promise.all([
    prisma.supplier.findUnique({ where: { id: vendor.id } }),
    prisma.supplierChangeRequest.findMany({ where: { supplierId: vendor.id, status: { in: ["PENDING", "REJECTED"] } }, orderBy: { requestedAt: "desc" }, take: 6 }),
    prisma.attachment.findMany({
      where: { entityType: "SUPPLIER", entityId: vendor.id, docType: { in: SUPPLIER_DOC_TYPES.map((t) => t.value) } },
      select: { id: true, docType: true, filename: true, expiryDate: true, uploadedAt: true }, orderBy: { uploadedAt: "desc" },
    }),
  ]);
  if (!s) return null;
  const label = (t: string) => SUPPLIER_DOC_TYPES.find((d) => d.value === t)?.label ?? t;

  const requests: PendingRow[] = pending.map((r) => ({
    id: r.id, kind: r.kind, status: r.status, note: r.note,
    changes: Object.entries((r.payload ?? {}) as Record<string, string>).map(([k, v]) => ({ label: (FIELD_LABELS[k] ?? k).replace(/ \(.*\)$/, ""), value: k === "iban" ? maskIban(v) : v })),
  }));

  return (
    <>
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-primary">Profile</h1>
        <p className="mt-1 text-sm text-muted">Your company details on file. Contact and bank changes are checked by our team before they take effect.</p>
      </div>

      <section className="card p-5">
        <h2 className="mb-3 text-sm font-semibold text-primary">Company</h2>
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          {[["Name", s.fullName ?? s.name], ["Code", s.code], ["Trade licence no.", s.tradeLicenseNumber], ["Licence expiry", s.tradeLicenseExpiry?.toISOString().slice(0, 10)], ["MOHRE permit", s.mohrePermitNumber], ["TRN", s.trn], ["Category", s.category], ["Country / emirate", [s.country, s.emirate].filter(Boolean).join(" · ")]].map(([k, v]) => (
            <div key={k as string}><dt className="text-xs text-muted">{k}</dt><dd className="mt-0.5 text-primary">{v || <span className="text-subtle">—</span>}</dd></div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-subtle">To change your company name, licence or tax details, please contact us.</p>
      </section>

      <ProfileForms
        contact={{ contactPerson: s.contactPerson ?? "", contactPhone: s.contactPhone ?? "", contactEmail: s.contactEmail ?? "", phone: s.phone ?? "", poBox: s.poBox ?? "", location: s.location ?? "" }}
        bank={{ bankName: s.bankName ?? "", iban: s.iban ?? "", bankAccountName: s.bankAccountName ?? "", bankAccountNumber: s.bankAccountNumber ?? "", bankEmirate: s.bankEmirate ?? "" }}
        maskedIban={maskIban(s.iban)}
        requests={requests}
        docTypes={SUPPLIER_DOC_TYPES.map((d) => ({ value: d.value, label: d.label }))}
        docs={docs.map((d) => {
          const days = d.expiryDate ? Math.ceil((d.expiryDate.getTime() - now.getTime()) / DAY) : null;
          return { id: d.id, type: label(d.docType), filename: d.filename, expiry: d.expiryDate ? d.expiryDate.toISOString().slice(0, 10) : null, days };
        })}
      />
    </>
  );
}
