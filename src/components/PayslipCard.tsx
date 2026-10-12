import type { PayslipDoc } from "@/lib/payslipData";

const aed = (n: number) => n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** One payslip on screen: the issuing company, earnings and deductions side by side, net pay, year to date. */
export function PayslipCard({ doc, i }: { doc: PayslipDoc; i: number }) {
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
    <article className="card mx-auto max-w-2xl space-y-4 p-6 text-sm [break-after:page] print:border-0 print:shadow-none">
      <header className="flex items-start justify-between gap-4 border-b border-default pb-3">
        <div className="flex items-center gap-3">
          {h.logo && (
            // eslint-disable-next-line @next/next/no-img-element -- data URI of the company's own logo
            <img src={h.logo} alt="" className="h-12 w-12 rounded-md object-contain" />
          )}
          <div>
            <p className="text-base font-semibold text-primary">{h.name}</p>
            {h.addressLines.length > 0 && <p className="text-xs text-muted">{h.addressLines.join(", ")}</p>}
            {contact && <p className="text-xs text-muted">{contact}</p>}
          </div>
        </div>
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
      <p className="text-xs text-muted">Computer-generated payslip. No signature required.</p>
    </article>
  );
}
