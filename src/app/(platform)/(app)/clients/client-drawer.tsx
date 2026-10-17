"use client";

import { useMemo } from "react";
import { CompanyDrawer, type CompanyAdapter, type CompanyGap, type CompanyView } from "@/components/quick-view/CompanyDrawer";
import { cn } from "@/lib/cn";
import { addClientDocumentAction } from "./actions";
import { applyClientScanAction, loadClientQuickViewAction, saveClientFieldAction, type ClientQuickView } from "./quick-view";

/** What the list already knows about a client: the header and the figures that are read, not edited, here. */
export type ClientPerson = { id: string; name: string; projects: number; openDemands: number; lpoValue: number; lpoBilled: number };

const DOC_TYPES = ["TRADE_LICENSE", "TRN_CERTIFICATE", "CONTRACT"] as const;
const aed = (n: number) => `AED ${Math.round(n).toLocaleString("en-AE")}`;

function toView(d: ClientQuickView): CompanyView {
  return { ...d, caption: d.emirate, badge: d.status === "ACTIVE" ? "Active" : d.status.toLowerCase() };
}

function gapsFor(d: CompanyView): CompanyGap[] {
  const hasLicenceFile = d.documents.some((a) => a.docType === "TRADE_LICENSE");
  return [
    { key: "tradeLicenseNumber", label: "Trade licence number", done: !!d.tradeLicenseNumber, level: "Required", why: "Needed on contracts and invoices", kind: "text" },
    { key: "tradeLicenseExpiry", label: "Trade licence expiry", done: !!d.tradeLicenseExpiry, level: "Required", why: "So renewals are flagged before it lapses", kind: "date" },
    { key: "scan", label: "Trade licence copy", done: hasLicenceFile, level: "Required", why: "Attach a scan; the details are read from it", kind: null },
    { key: "trn", label: "TRN", done: !!d.trn, level: "Required", why: "15 digits, printed on every invoice", kind: "trn" },
    { key: "contactPerson", label: "Contact person", done: !!d.contactPerson, level: "Recommended", why: "Who to call about timesheets and payments", kind: "text" },
    { key: "contactPhone", label: "Contact phone", done: !!d.contactPhone, level: "Recommended", why: "", kind: "phone" },
    { key: "contactEmail", label: "Contact email", done: !!d.contactEmail, level: "Recommended", why: "Where invoices are sent", kind: "text" },
    { key: "paymentTerms", label: "Payment terms", done: !!d.paymentTerms, level: "Recommended", why: "e.g. Net 30; sets invoice due dates", kind: "text" },
  ];
}

export function ClientDrawer({ id, order, people, onNavigate, onClose, initialTab }: { id: string; order: string[]; people: Map<string, ClientPerson>; onNavigate: (id: string) => void; onClose: () => void; initialTab?: string }) {
  const adapter = useMemo<CompanyAdapter>(() => ({
    noun: "client",
    load: async (cid) => { const d = await loadClientQuickViewAction(cid); return d ? toView(d) : null; },
    save: saveClientFieldAction,
    applyScan: applyClientScanAction,
    storeFile: async (cid, file, docType, expiry) => {
      const form = new FormData();
      form.append("clientId", cid);
      form.append("type", docType);
      form.append("expiryDate", expiry);
      form.append("file", file);
      await addClientDocumentAction(form);
      return null;
    },
    docTypes: DOC_TYPES,
    fullHref: (cid) => `/clients/${cid}`,
    fields: [
      { key: "contactPerson", label: "Contact" },
      { key: "contactPhone", label: "Phone", kind: "phone" },
      { key: "contactEmail", label: "Email" },
      { key: "paymentTerms", label: "Payment terms" },
      { key: "billingAddress", label: "Billing address" },
    ],
    gaps: gapsFor,
    overviewExtra: (d) => {
      const row = people.get(d.id);
      if (!row) return null;
      const pct = row.lpoValue > 0 ? Math.round((row.lpoBilled / row.lpoValue) * 100) : null;
      return (
        <div className="grid grid-cols-2 gap-2.5 text-sm">
          <div className="rounded-[14px] border border-default px-3 py-2.5"><p className="text-xs text-muted">Projects</p><p className="tabular text-base font-semibold text-primary">{row.projects}</p>{row.openDemands > 0 && <p className="text-[11px] text-muted">{row.openDemands} open demand{row.openDemands === 1 ? "" : "s"}</p>}</div>
          <div className="rounded-[14px] border border-default px-3 py-2.5"><p className="text-xs text-muted">Billed on LPOs</p><p className={cn("tabular text-base font-semibold text-primary")}>{pct === null ? "—" : `${pct}%`}</p>{row.lpoValue > 0 && <p className="text-[11px] text-muted">{aed(row.lpoBilled)} of {aed(row.lpoValue)}</p>}</div>
        </div>
      );
    },
  }), [people]);

  return <CompanyDrawer adapter={adapter} id={id} order={order} fallbackName={people.get(id)?.name} onNavigate={onNavigate} onClose={onClose} initialTab={initialTab} />;
}
