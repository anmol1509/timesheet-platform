import type { PayslipDoc } from "@/lib/payslipData";

const aed = (n: number) => n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** How a payslip is dressed on screen when previewing a print: the letterhead behind it, and the signature block. */
export type PayslipPaper = {
  onLetterhead: boolean; letterheadUrl: string | null; topMm: number; bottomMm: number;
  signatoryName: string; signatoryTitle: string; signatureUrl: string | null; stampUrl: string | null;
  /** The company's page margins (mm): all four on plain paper; left and right on a letterhead. */
  margins?: { plain: { top: number; bottom: number; left: number; right: number }; letterheadSides: { left: number; right: number } };
};

/** One payslip on screen: the issuing company, earnings and deductions side by side, net pay, year to date. */
export function PayslipCard({ doc, i, paper, note }: { doc: PayslipDoc; i: number; paper?: PayslipPaper; note?: string }) {
  const { slip, ytd, employee, paidBy } = doc.slips[i];
  const h = doc.letterhead;
  const contact = [h.phone && `Tel ${h.phone}`, h.email, h.poBox && `P.O. Box ${h.poBox}`, h.trn && `TRN ${h.trn}`].filter(Boolean).join(" · ");
  const month = new Date(`${doc.month}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  const Side = ({ title, rows, total, totalLabel }: { title: string; rows: typeof slip.earnings; total: number; totalLabel: string }) => (
    <div>
      <p className="border-b border-primary pb-1.5 text-xs font-semibold uppercase tracking-wide text-primary">{title}</p>
      <ul className="divide-y divide-[var(--border)]">
        {rows.length === 0 && <li className="py-1.5 text-muted">None this month</li>}
        {rows.map((r, k) => (
          <li key={k} className="flex justify-between gap-3 py-1.5"><span className="text-secondary">{r.label}{r.note && <span className="block text-xs text-muted">{r.note}</span>}</span><span className="tabular-nums">{aed(r.amount)}</span></li>
        ))}
      </ul>
      <p className="flex justify-between border-t border-default pt-1.5 font-semibold text-primary"><span>{totalLabel}</span><span className="tabular-nums">{aed(total)}</span></p>
    </div>
  );
  return (
    <article
      className={paper ? "mx-auto aspect-[210/297] w-full max-w-2xl space-y-4 overflow-hidden border border-default bg-white text-sm text-neutral-900 shadow-sm [break-after:page] print:border-0 print:shadow-none" : "card mx-auto max-w-2xl space-y-4 p-6 text-sm [break-after:page] print:border-0 print:shadow-none"}
      style={paper ? {
        // Percentages are of the sheet's width, so millimetres of an A4 page (210 mm wide) scale with the preview.
        paddingTop: `${((paper.onLetterhead ? paper.topMm : paper.margins?.plain.top ?? 12) / 210) * 100}%`, paddingBottom: `${((paper.onLetterhead ? paper.bottomMm : paper.margins?.plain.bottom ?? 12) / 210) * 100}%`,
        paddingLeft: paper.margins ? `${((paper.onLetterhead ? paper.margins.letterheadSides.left : paper.margins.plain.left) / 210) * 100}%` : "7%", paddingRight: paper.margins ? `${((paper.onLetterhead ? paper.margins.letterheadSides.right : paper.margins.plain.right) / 210) * 100}%` : "7%",
        ...(paper.onLetterhead && paper.letterheadUrl ? { backgroundImage: `url(${paper.letterheadUrl})`, backgroundSize: "100% 100%", backgroundRepeat: "no-repeat" } : {}),
      } : undefined}
    >
      <header className="flex items-start justify-between gap-4 border-b border-default pb-3">
        {paper?.onLetterhead ? <div /> : <div className="flex items-center gap-3">
          {h.logo && (
            // eslint-disable-next-line @next/next/no-img-element -- data URI of the company's own logo
            <img src={h.logo} alt="" className="h-12 w-12 rounded-md object-contain" />
          )}
          <div>
            <p className="text-base font-semibold text-primary">{h.name}</p>
            {h.addressLines.length > 0 && <p className="text-xs text-muted">{h.addressLines.join(", ")}</p>}
            {contact && <p className="text-xs text-muted">{contact}</p>}
          </div>
        </div>}
        <div className="text-right">
          <p className="text-base font-semibold text-primary">Payslip</p>
          <p className="text-xs text-muted">{month}</p>
        </div>
      </header>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-1">
        <div className="flex justify-between"><dt className="text-muted">Employee</dt><dd className="text-primary">{employee.name}</dd></div>
        <div className="flex justify-between"><dt className="text-muted">ID</dt><dd className="text-primary">{employee.idNo}</dd></div>
        <div className="flex justify-between"><dt className="text-muted">{employee.department ? "Designation" : "Trade"}</dt><dd className="text-primary">{employee.role}</dd></div>
        <div className="flex justify-between"><dt className="text-muted">{employee.department ? "Department" : "Paid by"}</dt><dd className="text-primary">{employee.department ?? paidBy}</dd></div>
      </dl>
      <div className="grid gap-6 sm:grid-cols-2">
        <Side title="Earnings" rows={slip.earnings} total={slip.gross} totalLabel="Total earnings" />
        <Side title="Deductions" rows={slip.deductions} total={slip.totalDeductions} totalLabel="Total deductions" />
      </div>
      <p className="flex justify-between rounded-md bg-surface-sunken px-4 py-3 text-base font-semibold text-primary"><span>Net pay (AED)</span><span className="tabular-nums">{aed(slip.net)}</span></p>
      {ytd.months > 0 && (
        <p className="border-t border-default pt-2 text-xs text-muted">
          Year to date ({ytd.months} month{ytd.months === 1 ? "" : "s"} of {doc.month.slice(0, 4)}): earnings {aed(ytd.gross)} · deductions {aed(ytd.deductions)} · net pay {aed(ytd.net)}
        </p>
      )}
      {note && <p className="whitespace-pre-wrap text-sm">{note}</p>}
      {paper && (paper.signatureUrl || paper.stampUrl) ? (
        <div className="mt-4 flex items-end justify-between gap-3">
          <div>
            <p>For and on behalf of</p>
            <p className="font-bold">{h.name}</p>
            {paper.signatureUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- our own image route
              <img src={paper.signatureUrl} alt="" className="my-1 h-11 w-[7.5rem] object-contain" />
            ) : <div className="h-7" />}
            <p className="font-bold">{paper.signatoryName || "Authorised Signatory"}</p>
            {paper.signatoryTitle && <p>{paper.signatoryTitle}</p>}
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element -- our own image route */}
          {paper.stampUrl && <img src={paper.stampUrl} alt="" className="h-[5.75rem] w-[5.75rem] object-contain" />}
        </div>
      ) : <p className="text-xs text-muted">Computer-generated payslip. No signature required.</p>}
    </article>
  );
}
