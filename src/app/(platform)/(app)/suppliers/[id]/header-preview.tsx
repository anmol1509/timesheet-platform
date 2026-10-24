import { companyHeaderFields, headerGaps, type CompanyHeaderSource } from "@/lib/issuerHeader";

/** What heads a timesheet issued by this own company, so what is missing is visible before a sheet goes out. */
export function CompanyHeaderPreview({ company, canEditDetails }: { company: CompanyHeaderSource; canEditDetails: boolean }) {
  const f = companyHeaderFields(company);
  const gaps = headerGaps(company);
  const address = [f.address, f.emirate, f.country].filter(Boolean).join(", ");
  const lines = [address, f.trn ? `TRN: ${f.trn}` : "", f.poBox ? `P.O. Box ${f.poBox.replace(/^\s*P\.?\s*O\.?\s*Box\s*/i, "")}` : "", f.phone ? `Tel: ${f.phone}` : "", f.email ?? ""].filter(Boolean);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4 rounded-xl border border-default bg-white p-4">
        {company.logoId ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/images/${company.logoId}`} alt="" className="h-14 w-14 shrink-0 object-contain" />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border border-dashed border-strong text-[10px] text-subtle">No logo</div>
        )}
        <div className="min-w-0 text-sm text-black">
          <p className="font-semibold" style={{ color: "#2b3187" }}>{f.name}</p>
          <p className="text-xs text-neutral-600">{lines.length ? lines.join("  ·  ") : "No address, TRN, phone or email yet"}</p>
        </div>
      </div>
      {gaps.length > 0 ? (
        <p className="text-xs text-[var(--warning)]">
          Missing: {gaps.join(", ")}. These print blank on this company&rsquo;s timesheets.{" "}
          {canEditDetails ? "Add the logo below, the TRN and full name on the Company tab, and the address, phone and email on Contact & Payment." : "Ask an administrator to complete them."}
        </p>
      ) : (
        <p className="text-xs text-[var(--success)]">Complete: nothing missing from the timesheet header.</p>
      )}
    </div>
  );
}
