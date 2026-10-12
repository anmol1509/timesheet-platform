import Link from "next/link";
import { notFound } from "next/navigation";
import { HeartPulse } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/Badge";
import { requireUserWithBranch } from "@/lib/auth";
import { isAdminRole } from "@/lib/roles";
import { HEALTH_MODULES, getModuleHealth, type HealthModule, type ModuleHealth } from "@/lib/dataHealth";
import { cn } from "@/lib/cn";

export const metadata = { title: "Data health" };

const tone = (pct: number) => (pct >= 85 ? "bg-[var(--success)]" : pct >= 50 ? "bg-[var(--warning)]" : "bg-[var(--error)]");

const BUCKETS = [
  { key: "complete", label: "Complete", stroke: "var(--success)" },
  { key: "good", label: "Nearly there", stroke: "var(--info)" },
  { key: "partial", label: "Half done", stroke: "var(--warning)" },
  { key: "poor", label: "Mostly empty", stroke: "var(--error)" },
] as const;

/** A donut of how many records fall in each completeness band, with the average in the middle. */
function HealthDonut({ h }: { h: ModuleHealth }) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="relative h-[140px] w-[140px] shrink-0">
      <svg width="140" height="140" viewBox="0 0 140 140" role="img" aria-label={`${h.overall}% complete`}>
        <circle cx="70" cy="70" r={r} fill="none" stroke="var(--surface-sunken)" strokeWidth="20" />
        {h.total > 0 &&
          BUCKETS.map((b) => {
            const count = h.buckets[b.key];
            if (!count) return null;
            const len = (count / h.total) * circ;
            const el = (
              <circle
                key={b.key}
                cx="70" cy="70" r={r} fill="none" stroke={b.stroke} strokeWidth="20"
                strokeDasharray={`${Math.max(0, len - 1.5)} ${circ - len + 1.5}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 70 70)"
              />
            );
            offset += len;
            return el;
          })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tabular text-2xl font-semibold text-primary">{h.total ? `${h.overall}%` : "—"}</span>
        <span className="text-[10px] tracking-wide text-muted uppercase">complete</span>
      </div>
    </div>
  );
}

export default async function DataHealthPage({ searchParams }: { searchParams: Promise<{ module?: string; missing?: string }> }) {
  const { user, branchId } = await requireUserWithBranch();
  if (!isAdminRole(user.role)) notFound();
  const sp = await searchParams;
  const active: HealthModule = HEALTH_MODULES.some((m) => m.key === sp.module) ? (sp.module as HealthModule) : "workers";

  if (!branchId) {
    return (
      <div className="max-w-4xl space-y-4">
        <PageHeader title="Data health" icon={HeartPulse} />
        <p className="rounded-lg border border-[var(--warning-border)] bg-[var(--warning-soft)] px-4 py-2 text-sm text-[var(--warning)]">
          Pick a specific branch from the switcher (top right) to see how complete its records are.
        </p>
      </div>
    );
  }

  const all = await Promise.all(HEALTH_MODULES.map((m) => getModuleHealth(m.key, branchId)));
  const health = Object.fromEntries(all.map((h) => [h.module, h])) as Record<HealthModule, ModuleHealth>;
  const meta = HEALTH_MODULES.find((m) => m.key === active)!;
  const h = health[active];
  const label = Object.fromEntries(h.fields.map((f) => [f.key, f.label]));
  const focus = h.fields.some((f) => f.key === sp.missing) ? sp.missing! : null;
  const rows = (focus ? h.list.filter((w) => w.missing.includes(focus)) : h.list.filter((w) => w.score < 100)).slice(0, 300);
  const href = (m: string, missing?: string) => `/data-health?module=${m}${missing ? `&missing=${missing}` : ""}`;

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        title="Data health"
        icon={HeartPulse}
        breadcrumbs={[{ label: "Administration" }, { label: "Data health" }]}
        description="How complete your records are in each module, and what's missing for whom. Pick a module to see the gaps."
      />

      <div className="grid gap-4 md:grid-cols-3">
        {HEALTH_MODULES.map((m) => {
          const x = health[m.key];
          return (
            <Link
              key={m.key}
              href={href(m.key)}
              aria-current={m.key === active}
              className={cn("card block p-5 transition hover:shadow-md", m.key === active ? "border-brand ring-1 ring-[var(--brand-primary)]" : "hover:border-strong")}
            >
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-semibold text-primary">{m.label}</p>
                <p className="text-xs text-muted">{x.total} {m.noun}{x.total === 1 ? "" : "s"}</p>
              </div>
              {x.total === 0 ? (
                <p className="mt-6 mb-4 text-center text-sm text-muted">Nothing here yet.</p>
              ) : (
                <div className="mt-3 flex items-center gap-4">
                  <HealthDonut h={x} />
                  <ul className="min-w-0 flex-1 space-y-1.5 text-xs">
                    {BUCKETS.map((b) => (
                      <li key={b.key} className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: b.stroke }} />
                        <span className="truncate text-secondary">{b.label}</span>
                        <span className="tabular ml-auto text-muted">{x.buckets[b.key]}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Link>
          );
        })}
      </div>

      {h.total === 0 ? (
        <p className="rounded-xl border border-dashed border-default px-4 py-10 text-center text-sm text-muted">
          No {meta.noun}s yet. <Link href={meta.importHref} className="font-medium text-[var(--brand-primary)] hover:underline">Import your {meta.noun}s</Link> to see how complete their records are.
        </p>
      ) : (
        <>
          <div className="card p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-primary">
                {meta.label} by detail <span className="font-normal text-muted">&middot; select one to see who&rsquo;s missing it</span>
              </p>
              <Link href={meta.importHref} className="btn btn-secondary btn-sm">Fill from a spreadsheet</Link>
            </div>
            <ul className="space-y-1.5">
              {[...h.fields].sort((a, b) => a.pct - b.pct).map((f) => (
                <li key={f.key}>
                  <Link href={focus === f.key ? href(active) : href(active, f.key)} className={cn("grid grid-cols-[150px_1fr_110px] items-center gap-3 rounded-md px-2 py-1 text-sm transition hover:bg-surface-hover", focus === f.key && "bg-brand-soft")} title={f.why}>
                    <span className="truncate text-secondary">{f.label}</span>
                    <span className="h-2 overflow-hidden rounded-full bg-surface-sunken"><span className={cn("block h-full rounded-full", tone(f.pct))} style={{ width: `${Math.max(f.pct, 2)}%` }} /></span>
                    <span className="tabular text-right text-xs text-muted">{f.pct}% <span className="text-subtle">({h.total - f.have} missing)</span></span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <section>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-primary">
                {focus ? `Missing ${label[focus].toLowerCase()}` : `Least complete ${meta.noun}s`} <span className="font-normal text-muted">&middot; {rows.length}{rows.length === 300 ? "+" : ""}</span>
              </h2>
              {focus && <Link href={href(active)} className="text-xs font-medium text-[var(--brand-primary)] hover:underline">Show all</Link>}
            </div>
            {rows.length === 0 ? (
              <p className="rounded-xl border border-dashed border-default px-4 py-8 text-center text-sm text-muted">Nothing missing.</p>
            ) : (
              <div className="card overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium tracking-wide text-muted uppercase">
                    <tr><th className="px-4 py-3">{meta.label.replace(/s$/, "")}</th><th className="px-4 py-3">Complete</th><th className="px-4 py-3">Missing</th><th className="px-4 py-3" /></tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {rows.map((w) => (
                      <tr key={w.id}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-primary">{w.name}</p>
                          {w.sub && <p className="tabular text-xs text-muted">{w.sub}</p>}
                        </td>
                        <td className="w-40 px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-sunken"><span className={cn("block h-full rounded-full", tone(w.score))} style={{ width: `${Math.max(w.score, 3)}%` }} /></span>
                            <span className="tabular text-xs text-muted">{w.score}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {w.missing.slice(0, 4).map((k) => <Badge key={k} color="slate">{label[k]}</Badge>)}
                            {w.missing.length > 4 && <span className="text-xs text-muted">+{w.missing.length - 4} more</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right"><Link href={w.href} className="text-xs font-medium text-[var(--brand-primary)] hover:underline">Open</Link></td>
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
