"use client";

import Link from "next/link";
import { useMemo } from "react";
import { CompanyDrawer, type CompanyAdapter, type CompanyGap, type CompanyView } from "@/components/quick-view/CompanyDrawer";
import { Pill } from "@/components/quick-view/fields";
import { uploadAttachmentAction } from "@/lib/attachments";
import { cn } from "@/lib/cn";
import { applySupplierScanAction, loadSupplierQuickViewAction, saveSupplierFieldAction, type SupplierQuickView } from "./quick-view";

/** What the list already knows about a supplier: the header and the figures that are read, not edited, here. */
export type SupplierPerson = {
  id: string;
  name: string;
  employeeCount: number;
  billBalance: number;
  billOverdue: number;
  parentName: string | null;
};

const DOC_TYPES = ["TRADE_LICENSE", "MOHRE_PERMIT", "ESTABLISHMENT_CARD", "TRN_CERTIFICATE", "WORKMEN_COMPENSATION_INSURANCE", "EJARI_TENANCY", "CHAMBER_OF_COMMERCE"] as const;
const aed = (n: number) => `AED ${Math.round(n).toLocaleString("en-AE")}`;
const GATE_TONE = { Approved: "ok", Pending: "warn", Rejected: "err" } as const;

function toView(d: SupplierQuickView): CompanyView {
  return {
    ...d,
    caption: [d.category, d.parentName && `Sub of ${d.parentName}`].filter(Boolean).join(" · ") || null,
    badge: d.status === "ACTIVE" ? (d.isOwnCompany ? "Own company" : "Active") : d.status.toLowerCase(),
    documents: d.attachments,
  };
}

function gapsFor(d: CompanyView): CompanyGap[] {
  const hasLicenceFile = d.documents.some((a) => a.docType === "TRADE_LICENSE");
  return [
    { key: "tradeLicenseNumber", label: "Trade licence number", done: !!d.tradeLicenseNumber, level: "Required", why: "Decides whether this supplier can be used at all", kind: "text" },
    { key: "tradeLicenseExpiry", label: "Trade licence expiry", done: !!d.tradeLicenseExpiry, level: "Required", why: "So renewals are flagged before it lapses", kind: "date" },
    { key: "scan", label: "Trade licence copy", done: hasLicenceFile, level: "Required", why: "Attach a scan; the details are read from it", kind: null },
    { key: "trn", label: "TRN", done: !!d.trn, level: "Required", why: "15 digits, needed on invoices and bills", kind: "trn" },
    { key: "contactPerson", label: "Contact person", done: !!d.contactPerson, level: "Recommended", why: "Who to call about workers and payments", kind: "text" },
    { key: "contactPhone", label: "Contact phone", done: !!d.contactPhone, level: "Recommended", why: "", kind: "phone" },
    { key: "contactEmail", label: "Contact email", done: !!d.contactEmail, level: "Recommended", why: "Where supplier letters and offers are sent", kind: "text" },
    { key: "category", label: "Category", done: !!d.category, level: "Recommended", why: "Used to group suppliers", kind: "text" },
  ];
}

export function SupplierDrawer({ id, order, people, onNavigate, onClose, initialTab }: { id: string; order: string[]; people: Map<string, SupplierPerson>; onNavigate: (id: string) => void; onClose: () => void; initialTab?: string }) {
  const adapter = useMemo<CompanyAdapter>(() => ({
    noun: "supplier",
    load: async (sid) => { const d = await loadSupplierQuickViewAction(sid); return d ? toView(d) : null; },
    save: saveSupplierFieldAction,
    applyScan: applySupplierScanAction,
    storeFile: async (sid, file, docType, expiry) => {
      const form = new FormData();
      form.append("entityType", "SUPPLIER");
      form.append("entityId", sid);
      form.append("docType", docType);
      form.append("expiryDate", expiry);
      form.append("revalidate", `/suppliers/${sid}`);
      form.append("file", file);
      const r = await uploadAttachmentAction(form);
      return r && "error" in r && r.error ? r.error : null;
    },
    docTypes: DOC_TYPES,
    fullHref: (sid) => `/suppliers/${sid}`,
    fields: [
      { key: "contactPerson", label: "Contact" },
      { key: "contactPhone", label: "Phone", kind: "phone" },
      { key: "contactEmail", label: "Email" },
      { key: "category", label: "Category" },
      { key: "paymentTerms", label: "Payment terms" },
    ],
    complianceFields: [{ key: "mohrePermitNumber", label: "MOHRE permit" }],
    gaps: gapsFor,
    overviewExtra: (d) => {
      const row = people.get(d.id);
      if (!row) return null;
      return (
        <div className="grid grid-cols-2 gap-2.5 text-sm">
          <Link href={`/employees?supplier=${d.id}`} className="rounded-[14px] border border-default px-3 py-2.5 hover:bg-surface-hover"><p className="text-xs text-muted">Workers</p><p className="tabular text-base font-semibold text-primary">{row.employeeCount}</p></Link>
          <Link href="/finance/bills" className="rounded-[14px] border border-default px-3 py-2.5 hover:bg-surface-hover"><p className="text-xs text-muted">Bills outstanding</p><p className={cn("tabular text-base font-semibold", row.billOverdue > 0 ? "text-[var(--error)]" : "text-primary")}>{aed(row.billBalance)}</p>{row.billOverdue > 0 && <p className="text-[11px] text-[var(--error)]">{aed(row.billOverdue)} overdue</p>}</Link>
        </div>
      );
    },
    complianceExtra: (d) => {
      const approvals = d.approvals as { project: string; labour: string; invoicing: string };
      const pending = Object.values(approvals).filter((v) => v === "Pending").length;
      return (
        <div>
          <h3 className="mb-2 text-xs font-semibold text-primary">Approvals {pending > 0 && <span className="font-normal text-muted">· {pending} waiting</span>}</h3>
          <div className="flex flex-wrap gap-2 rounded-[14px] border border-default px-3 py-2.5 text-sm">
            {([["Projects", approvals.project], ["Labour", approvals.labour], ["Invoicing", approvals.invoicing]] as const).map(([label, v]) => (
              <span key={label} className="flex items-center gap-1.5 text-muted">{label}<Pill tone={GATE_TONE[v as keyof typeof GATE_TONE] ?? "mute"}>{v}</Pill></span>
            ))}
          </div>
          {pending > 0 && <Link href="/approvals?type=SUPPLIER" className="mt-1.5 block text-xs font-medium text-[var(--brand-primary)] hover:underline">Decide in Approvals</Link>}
        </div>
      );
    },
  }), [people]);

  return <CompanyDrawer adapter={adapter} id={id} order={order} fallbackName={people.get(id)?.name} onNavigate={onNavigate} onClose={onClose} initialTab={initialTab} />;
}
