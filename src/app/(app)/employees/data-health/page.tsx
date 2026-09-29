import Link from "next/link";
import { HeartPulse } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/Badge";
import { requireUserWithBranch } from "@/lib/auth";
import { isAdminRole } from "@/lib/roles";
import { HEALTH_FIELDS, HEALTH_KEYS, getDataHealth, type HealthKey } from "@/lib/dataHealth";
import { cn } from "@/lib/cn";
import { HealthActions } from "./health-actions";

export const metadata = { title: "Data health" };
const LABEL = Object.fromEntries(HEALTH_FIELDS.map((f) => [f.key, f.label])) as Record<HealthKey, string>;
const tone = (pct: number) => (pct >= 85 ? "bg-[var(--success)]" : pct >= 50 ? "bg-[var(--warning)]" : "bg-[var(--error)]");

export default async function DataHealthPage({ searchParams }: { searchParams: Promise<{ missing?: string }> }) {
  const { user, branchId } = await requireUserWithBranch();
  const { missing } = await searchParams;
  const focus = HEALTH_KEYS.includes(missing as HealthKey) ? (missing as HealthKey) : null;

  if (!branchId) {
    return (
      <div className="max-w-4xl space-y-4">
        <PageHeader title="Data health" icon={HeartPulse} />
        <p className="rounded-lg border border-[var(--warning-border)] bg-[var(--warning-soft)] px-4 py-2 text-sm text-[var(--warning)]">
          Pick a specific branch from the switcher (top right) to see how complete its worker records are.
        </p>
      </div>
    );
  }

  const h = await getDataHealth(branchId);
  const rows = (focus ? h.list.filter((w) => w.missing.includes(focus)) : h.list.filter((w) => w.score < 100)).slice(0, 300);

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        title="Data health"
        icon={HeartPulse}
        breadcrumbs={[{ label: "Employees", href: "/employees" }, { label: "Data health" }]}
        description="How complete your worker records are, and what's missing for whom. Fill the gaps from a spreadsheet, or ask the workers to add their own details."
        actions={isAdminRole(user.role) ? <HealthActions missing={focus} incomplete={h.list.filter((w) => w.score < 100).length} /> : undefined}
      />

      {h.workers === 0 ? (
        <p className="rounded-xl border border-dashed border-default px-4 py-10 text-center text-sm text-muted">
          No workers yet. <Link href="/import/new/workers" className="font-medium text-[var(--brand-primary)] hover:underline">Import your workers</Link> to see how complete their records are.
        </p>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-[minmax(240px,1fr)_2fr]">
            <div className="card flex flex-col justify-center p-5">
              <p className="text-xs font-medium tracking-wide text-muted uppercase">Overall</p>
              <p className="tabular mt-1 text-5xl font-semibold text-primary">{h.overall}%</p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-sunken">
                <div className={cn("h-full rounded-full", tone(h.overall))} style={{ width: `${Math.max(h.overall, 2)}%` }} />
              </div>
              <p className="mt-3 text-xs text-muted">
                {h.workers} workers &middot; {h.buckets.complete} complete &middot; {h.buckets.good} nearly there &middot; {h.buckets.partial} half done &middot; {h.buckets.poor} mostly empty
              </p>
              {h.withoutMobile > 0 && (
                <p className="mt-2 text-xs text-[var(--warning)]">{h.withoutMobile} have no mobile number, so they can&rsquo;t be asked to fill in their own details.</p>
              )}
            </div>

            <div className="card p-5">
              <p className="mb-3 text-sm font-semibold text-primary">By detail <span className="font-normal text-muted">&middot; select one to see who&rsquo;s missing it</span></p>
              <ul className="space-y-1.5">
                {[...h.fields].sort((a, b) => a.pct - b.pct).map((f) => (
                  <li key={f.key}>
                    <Link href={focus === f.key ? "/employees/data-health" : `/employees/data-health?missing=${f.key}`} className={cn("grid grid-cols-[150px_1fr_72px] items-center gap-3 rounded-md px-2 py-1 text-sm transition hover:bg-surface-hover", focus === f.key && "bg-brand-soft")} title={f.why}>
                      <span className="truncate text-secondary">{f.label}</span>
                      <span className="h-2 overflow-hidden rounded-full bg-surface-sunken"><span className={cn("block h-full rounded-full", tone(f.pct))} style={{ width: `${Math.max(f.pct, 2)}%` }} /></span>
                      <span className="tabular text-right text-xs text-muted">{f.pct}% <span className="text-subtle">({h.workers - f.have} missing)</span></span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <section>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-primary">
                {focus ? `Missing ${LABEL[focus].toLowerCase()}` : "Least complete workers"} <span className="font-normal text-muted">&middot; {rows.length}{rows.length === 300 ? "+" : ""}</span>
              </h2>
              {focus && <Link href="/employees/data-health" className="text-xs font-medium text-[var(--brand-primary)] hover:underline">Show all</Link>}
            </div>
            {rows.length === 0 ? (
              <p className="rounded-xl border border-dashed border-default px-4 py-8 text-center text-sm text-muted">Nothing missing. </p>
            ) : (
              <div className="card overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium tracking-wide text-muted uppercase">
                    <tr><th className="px-4 py-3">Worker</th><th className="px-4 py-3">Complete</th><th className="px-4 py-3">Missing</th><th className="px-4 py-3" /></tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {rows.map((w) => (
                      <tr key={w.id}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-primary">{w.name}</p>
                          <p className="tabular text-xs text-muted">{w.employeeIdNo}{w.company ? ` · ${w.company}` : ""}</p>
                        </td>
                        <td className="w-40 px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-sunken"><span className={cn("block h-full rounded-full", tone(w.score))} style={{ width: `${Math.max(w.score, 3)}%` }} /></span>
                            <span className="tabular text-xs text-muted">{w.score}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {w.missing.slice(0, 4).map((k) => <Badge key={k} color="slate">{LABEL[k]}</Badge>)}
                            {w.missing.length > 4 && <span className="text-xs text-muted">+{w.missing.length - 4} more</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right"><Link href={`/employees/${w.id}`} className="text-xs font-medium text-[var(--brand-primary)] hover:underline">Open</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
