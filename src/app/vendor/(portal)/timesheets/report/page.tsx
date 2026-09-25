import Link from "next/link";
import { getVendor } from "@/lib/vendor/session";
import { parseRange, summarise } from "@/lib/attendanceReport";
import { loadAttendanceReport, MAX_ROWS } from "@/lib/vendorAttendanceReport";
import { Badge, type BadgeColor } from "@/components/Badge";
import { Download } from "lucide-react";
import { DatePicker } from "@/components/ui/DatePicker";
import { Select } from "@/components/ui/Select";

export const metadata = { title: "Attendance report" };
const COLOR: Record<string, BadgeColor> = { PRESENT: "green", ABSENT: "red", LEAVE: "amber" };

export default async function VendorAttendanceReportPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; status?: string }> }) {
  const vendor = (await getVendor())!;
  const q = await searchParams;
  const parsed = parseRange(q, new Date());
  const { range } = parsed;
  const { rows, truncated } = await loadAttendanceReport(vendor.id, range);
  const s = summarise(rows);
  const from = range.from.toISOString().slice(0, 10);
  const to = range.to.toISOString().slice(0, 10);
  const qs = `from=${from}&to=${to}&status=${range.status}`;

  return (
    <>
      <div>
        <div className="mb-3 inline-flex gap-0.5 rounded-control bg-[var(--surface-sunken)] p-0.5">
          <Link href="/vendor/timesheets" className="rounded-[6px] px-3 py-1 text-[13px] font-medium text-muted hover:text-primary">Monthly summary</Link>
          <span className="rounded-[6px] bg-surface px-3 py-1 text-[13px] font-medium text-primary shadow-xs">Attendance report</span>
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-primary">Attendance report</h1>
        <p className="mt-1 text-sm text-muted">Day-by-day attendance for your workers. Download it as PDF or Excel.</p>
      </div>

      <form method="get" className="card flex flex-wrap items-end gap-3 p-4">
        <label className="block"><span className="mb-1 block text-xs font-medium text-muted">From</span><DatePicker name="from" defaultValue={from} /></label>
        <label className="block"><span className="mb-1 block text-xs font-medium text-muted">To</span><DatePicker name="to" defaultValue={to} /></label>
        <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Status</span>
          <Select name="status" defaultValue={range.status} searchable={false} options={[{ value: "ALL", label: "All" }, { value: "PRESENT", label: "Present" }, { value: "ABSENT", label: "Absent" }, { value: "LEAVE", label: "On leave" }]} /></label>
        <button type="submit" className="btn btn-primary">Show report</button>
        {rows.length > 0 && (
          <span className="ml-auto flex gap-2">
            <a href={`/vendor/timesheets/export?${qs}&format=pdf`} className="btn btn-secondary gap-1.5"><Download className="h-4 w-4" aria-hidden /> PDF</a>
            <a href={`/vendor/timesheets/export?${qs}&format=xlsx`} className="btn btn-secondary gap-1.5"><Download className="h-4 w-4" aria-hidden /> Excel</a>
          </span>
        )}
      </form>
      {!parsed.ok && <p role="alert" className="text-sm text-[var(--error)]">{parsed.error} Showing this month instead.</p>}

      {rows.length === 0 ? (
        <div className="card p-8 text-center text-sm text-muted">No attendance matches those dates and status.</div>
      ) : (
        <>
          <div className="card grid grid-cols-2 divide-x divide-y divide-[var(--border)] overflow-hidden lg:grid-cols-4 lg:divide-y-0">
            {[["Workers", String(s.workers)], ["Present · absent · leave", `${s.present} · ${s.absent} · ${s.leave}`], ["Normal hours", String(s.normal)], ["Overtime hours", String(s.ot)]].map(([l, v]) => (
              <div key={l} className="p-4"><p className="text-[13px] font-medium text-muted">{l}</p><p className="tabular mt-1 text-xl font-semibold text-primary">{v}</p></div>
            ))}
          </div>
          {truncated && <p className="text-xs text-[var(--warning)]">Showing the first {MAX_ROWS.toLocaleString()} rows. Choose a shorter range to see the rest.</p>}
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium uppercase tracking-wide text-muted"><tr><th className="px-4 py-3">Worker</th><th className="px-3 py-3">Date</th><th className="px-3 py-3">Status</th><th className="px-3 py-3 text-right">Normal h</th><th className="px-3 py-3 text-right">OT h</th></tr></thead>
              <tbody className="divide-y divide-[var(--border)]">
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2.5"><p className="font-medium text-primary">{r.name}</p><p className="text-xs text-muted">{r.code}</p></td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-secondary">{r.date}</td>
                    <td className="px-3 py-2.5"><Badge color={COLOR[r.status] ?? "slate"} dot>{r.status.charAt(0) + r.status.slice(1).toLowerCase()}</Badge></td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-secondary">{r.normal}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-secondary">{r.ot}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
