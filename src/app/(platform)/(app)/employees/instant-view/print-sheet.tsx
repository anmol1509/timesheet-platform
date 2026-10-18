import { COMPLIANCE_FIELDS, complianceStatus, daysUntil, type ComplianceStatus } from "@/lib/compliance";

/**
 * The printed Instant View: an A4 sheet laid out for paper rather than a copy of the screen.
 * Hidden on screen; the on-screen card is hidden when printing. Empty sections are left off.
 */

type Row = { id: string };
type Employee = {
  id: string; name: string; employeeIdNo: string; previousId: string | null; trade: string | null; mobileNumber: string | null;
  nationality: string | null; passportNumber: string | null; sponsorName: string | null; active: boolean; photoData: unknown;
  supplier: { name: string } | null; project: { name: string } | null;
  branch: { name: string; address: string | null; phone: string | null; trn: string | null; logoId: string | null } | null;
  assignmentHistory: (Row & { branchName: string | null; projectName: string | null; mobilizedDate: Date | null; demobilizedDate: Date | null })[];
  accommodationHistory: (Row & { campName: string | null; roomName: string | null; bedLabel: string | null; checkInDate: Date | null; checkOutDate: Date | null; plannedCheckOutDate: Date | null; checkOutReason: string | null })[];
  inventoryAssignments: (Row & { quantity: number; issuedDate: Date | null; returnDate: Date | null; item: { name: string }; variant: { name: string } | null })[];
  noteEntries: (Row & { remarks: string; createdAt: Date; createdBy: { name: string } })[];
  [key: string]: unknown;
};

const fmt = (d: Date | null) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—");

const PILL: Record<ComplianceStatus, string> = {
  valid: "bg-[#e7f6ec] text-[#14703a]",
  expiring: "bg-[#fff3d6] text-[#8a5a00]",
  expired: "bg-[#fde8e6] text-[#b42318]",
  not_set: "bg-[#f1f3f6] text-[#667085]",
};

function pillText(value: Date | null): string {
  if (!value) return "Not recorded";
  const days = daysUntil(value);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  return days <= 90 ? `${days}d left` : "Valid";
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="break-inside-avoid">
      <h3 className="mb-1.5 border-b border-[#d0d5dd] pb-1 text-[9pt] font-bold tracking-[0.08em] text-[#344054] uppercase">{title}</h3>
      {children}
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="min-w-0">
      <p className="text-[7.5pt] tracking-wide text-[#667085] uppercase">{label}</p>
      <p className="truncate text-[10pt] font-medium text-[#101828]">{value || "—"}</p>
    </div>
  );
}

const th = "bg-transparent py-1 pr-2 text-left text-[7.5pt] font-semibold tracking-wide text-[#667085] uppercase";
const td = "py-1 pr-2 text-[9pt] text-[#101828]";

export function InstantPrintSheet({ employee: e, printedBy, printedAt }: { employee: Employee; printedBy: string; printedAt: string }) {
  const b = e.branch;
  const initials = e.name.split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  const contact = [b?.address, b?.phone, b?.trn ? `TRN ${b.trn}` : null].filter(Boolean).join("  ·  ");
  return (
    // The spacer rows repeat on every printed page, giving a margin on each without showing the browser's own date and URL.
    <table className="hidden w-full print:table [print-color-adjust:exact]" style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}>
      <thead><tr><td className="h-[11mm]" /></tr></thead>
      <tfoot><tr><td className="h-[11mm]" /></tr></tfoot>
      <tbody>
        <tr>
          <td className="px-[13mm] align-top">
            <div className="space-y-4 text-[#101828]">
              {/* A div, not <header>: the print stylesheet hides every <header> (the app chrome). */}
              <div className="flex items-start gap-3 border-b-2 border-[#5645d4] pb-3">
                {b?.logoId && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/images/${b.logoId}`} alt="" className="h-11 w-auto max-w-[40mm] object-contain" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[13pt] leading-tight font-bold">{b?.name ?? "Employee profile"}</p>
                  {contact && <p className="text-[8pt] text-[#667085]">{contact}</p>}
                </div>
                <div className="text-right">
                  <p className="text-[11pt] font-bold text-[#5645d4]">Employee profile</p>
                  <p className="text-[8pt] text-[#667085]">Printed {printedAt}</p>
                  <p className="text-[8pt] text-[#667085]">by {printedBy}</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <span className="flex h-[34mm] w-[27mm] shrink-0 items-center justify-center overflow-hidden rounded-md border border-[#d0d5dd] bg-[#f2f4f7]">
                  {e.photoData ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/employees/${e.id}/photo`} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-center text-[8pt] leading-snug text-[#98a2b3]"><span className="block text-[18pt] font-semibold text-[#667085]">{initials}</span>No photo</span>
                  )}
                </span>
                <div className="min-w-0 flex-1 space-y-3">
                  <div>
                    <p className="flex items-center gap-2 text-[17pt] leading-tight font-bold">
                      <span className="truncate">{e.name}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[8pt] font-semibold ${e.active ? PILL.valid : PILL.not_set}`}>{e.active ? "Active" : "Inactive"}</span>
                    </p>
                    <p className="text-[10pt] text-[#475467]">{[e.employeeIdNo, e.trade, e.supplier?.name].filter(Boolean).join("  ·  ")}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-x-4 gap-y-2">
                    <Fact label="Nationality" value={e.nationality} />
                    <Fact label="Mobile" value={e.mobileNumber} />
                    <Fact label="Passport no." value={e.passportNumber} />
                    <Fact label="Project" value={e.project?.name} />
                    <Fact label="Sponsor" value={e.sponsorName} />
                    <Fact label="Previous ID" value={e.previousId} />
                  </div>
                </div>
              </div>

              <Section title="Documents & expiry">
                <div className="grid grid-cols-2 gap-x-6">
                  {COMPLIANCE_FIELDS.map((f) => {
                    const value = e[f.key] as Date | null;
                    const status = complianceStatus(value);
                    return (
                      <div key={f.key} className="flex items-center justify-between gap-2 border-b border-[#eaecf0] py-1 text-[9pt]">
                        <span className="text-[#475467]">{f.label}</span>
                        <span className="flex items-center gap-1.5">
                          <span className={value ? "font-medium" : "text-[#98a2b3]"}>{fmt(value)}</span>
                          <span className={`min-w-[17mm] rounded-full px-1.5 py-px text-center text-[7.5pt] font-semibold ${PILL[status]}`}>{pillText(value)}</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Section>

              {e.assignmentHistory.length > 0 && (
                <Section title="Work history">
                  <table className="w-full"><thead><tr><th className={th}>Project</th><th className={th}>Branch</th><th className={th}>Mobilized</th><th className={th}>Demobilized</th><th className={th}>Status</th></tr></thead>
                    <tbody className="divide-y divide-[#eaecf0]">
                      {e.assignmentHistory.map((h) => (
                        <tr key={h.id}><td className={td}>{h.projectName || "—"}</td><td className={td}>{h.branchName || "—"}</td><td className={td}>{fmt(h.mobilizedDate)}</td><td className={td}>{fmt(h.demobilizedDate)}</td><td className={td}>{h.demobilizedDate ? "Demobilized" : "Mobilized"}</td></tr>
                      ))}
                    </tbody></table>
                </Section>
              )}

              {e.accommodationHistory.length > 0 && (
                <Section title="Accommodation">
                  <table className="w-full"><thead><tr><th className={th}>Camp</th><th className={th}>Room · bed</th><th className={th}>Check in</th><th className={th}>Check out</th><th className={th}>Reason</th></tr></thead>
                    <tbody className="divide-y divide-[#eaecf0]">
                      {e.accommodationHistory.map((h) => (
                        <tr key={h.id}><td className={td}>{h.campName || "—"}</td><td className={td}>{[h.roomName, h.bedLabel].filter(Boolean).join(" · ") || "—"}</td><td className={td}>{fmt(h.checkInDate)}</td><td className={td}>{h.checkOutDate ? fmt(h.checkOutDate) : h.plannedCheckOutDate ? `Leaving ${fmt(h.plannedCheckOutDate)}` : "Current"}</td><td className={td}>{h.checkOutReason || "—"}</td></tr>
                      ))}
                    </tbody></table>
                </Section>
              )}

              {e.inventoryAssignments.length > 0 && (
                <Section title="PPE & inventory issued">
                  <table className="w-full"><thead><tr><th className={th}>Item</th><th className={th}>Qty</th><th className={th}>Issued</th><th className={th}>Returned</th></tr></thead>
                    <tbody className="divide-y divide-[#eaecf0]">
                      {e.inventoryAssignments.map((a) => (
                        <tr key={a.id}><td className={td}>{a.item.name}{a.variant ? ` · ${a.variant.name}` : ""}</td><td className={td}>{a.quantity}</td><td className={td}>{fmt(a.issuedDate)}</td><td className={td}>{a.returnDate ? fmt(a.returnDate) : "Still holding"}</td></tr>
                      ))}
                    </tbody></table>
                </Section>
              )}

              {e.noteEntries.length > 0 && (
                <Section title="Notes">
                  <ul className="space-y-1.5">
                    {e.noteEntries.slice(0, 6).map((n) => (
                      <li key={n.id} className="text-[9pt]"><span className="whitespace-pre-wrap">{n.remarks}</span> <span className="text-[8pt] text-[#98a2b3]">— {fmt(n.createdAt)}, {n.createdBy.name}</span></li>
                    ))}
                  </ul>
                </Section>
              )}

              <p className="border-t border-[#eaecf0] pt-2 text-center text-[7.5pt] text-[#98a2b3]">Confidential · for internal use only · {b?.name ?? ""}</p>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
