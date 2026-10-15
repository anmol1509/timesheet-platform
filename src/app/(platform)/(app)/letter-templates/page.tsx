import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdmin, requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { LETTER_PRESETS, presetByKey, presetHtml } from "@/lib/letterPresets";
import { htmlToText, templateHtml } from "@/lib/letterHtml";
import { Badge } from "@/components/Badge";
import { AddDefaultsButton, NewTemplateButton } from "./gallery";

export const metadata = { title: "Letter templates" };

const snippet = (t: { bodyHtml: string | null; remarksText: string }) => htmlToText(templateHtml(t)).replace(/%%[^%\n]+?%%/g, "…").replace(/\n+/g, " ").slice(0, 150);

export default async function LetterTemplatesPage({ searchParams }: { searchParams: Promise<{ error?: string; tab?: string }> }) {
  await requireAdmin();
  const { error, tab = "all" } = await searchParams;
  const { branchId } = await requireUserWithBranch();
  const [templates, usage] = await Promise.all([
    prisma.letterTemplate.findMany({ where: branchWhere(branchId), orderBy: [{ category: "asc" }, { name: "asc" }] }),
    prisma.noc.groupBy({ by: ["templateId"], where: branchWhere(branchId), _count: true }),
  ]);
  // Which kind of letter each template is, for the tabs.
  const kindOf = (t: { audience: string; category: string | null }): string =>
    t.audience === "EMPLOYEE" ? "employee" : t.category === "No Objection Letter" ? "noc" : t.category === "Undertaking Letter" || t.category === "Supplier Undertaking" ? "undertaking" : "other";
  const TABS = [
    { key: "all", label: "All" },
    { key: "employee", label: "Employee letters" },
    { key: "noc", label: "NOC" },
    { key: "undertaking", label: "Undertaking" },
    { key: "other", label: "Other" },
  ];
  const counts = new Map<string, number>(TABS.map((x) => [x.key, x.key === "all" ? templates.length : templates.filter((t) => kindOf(t) === x.key).length]));
  const shown = tab === "all" ? templates : templates.filter((t) => kindOf(t) === tab);
  const usedBy = new Map(usage.map((u) => [u.templateId, u._count]));
  const haveKeys = new Set(templates.map((t) => t.presetKey).filter(Boolean));
  const missingDefaults = LETTER_PRESETS.some((p) => !haveKeys.has(p.key));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 flex-1 basis-80">
          <h1 className="text-xl font-semibold tracking-tight text-primary">Letter templates</h1>
          <p className="mt-1 text-sm text-muted">The wording of your client letters (NOCs, mobilization, undertakings) and letters about your employees (salary certificates, experience letters, warnings). Pick a ready-made one, format it like an email with a live preview, and it&apos;s used the next time a letter is made.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {branchId && templates.length > 0 && missingDefaults && <AddDefaultsButton />}
          {branchId && <NewTemplateButton />}
        </div>
      </div>
      {error && <p role="alert" className="text-sm text-[var(--danger-text,#b42318)]">{error}</p>}

      {branchId && templates.length > 0 && (
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Letter type">
          {TABS.filter((x) => x.key === "all" || x.key === tab || (counts.get(x.key) ?? 0) > 0).map((x) => (
            <Link
              key={x.key}
              href={x.key === "all" ? "/letter-templates" : `/letter-templates?tab=${x.key}`}
              role="tab"
              aria-selected={x.key === tab}
              className={x.key === tab ? "rounded-md bg-brand-soft px-3 py-1.5 text-sm font-medium text-[var(--brand-primary)]" : "rounded-md px-3 py-1.5 text-sm text-secondary hover:bg-surface-hover"}
            >
              {x.label} <span className="tabular text-xs text-muted">{counts.get(x.key) ?? 0}</span>
            </Link>
          ))}
        </div>
      )}

      {!branchId ? (
        <p className="text-sm text-muted">Pick a branch from the switcher to manage its templates.</p>
      ) : templates.length === 0 ? (
        <section className="card p-6">
          <h2 className="text-sm font-semibold text-primary">Start with a ready-made template</h2>
          <p className="mt-1 text-sm text-muted">Each one is a sensible first draft with the right fields already in place.</p>
          <div className="mt-4 flex flex-wrap gap-2"><AddDefaultsButton /><NewTemplateButton variant="secondary" /></div>
        </section>
      ) : (
        shown.length === 0 ? (
          <p className="text-sm text-muted">No templates of this type yet. Use “New template” to add one.</p>
        ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((t) => {
            const n = usedBy.get(t.id) ?? 0;
            const pr = presetByKey(t.presetKey);
            const original = !!pr && htmlToText(presetHtml(pr)) === htmlToText(templateHtml(t));
            return (
              <Link key={t.id} href={`/letter-templates/${t.id}`} className="card block p-4 transition hover:border-[var(--brand-primary)]">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-primary">{t.name}</h3>
                  {t.presetKey && <Badge color={original ? "slate" : "blue"}>{original ? "Ready-made" : "Edited"}</Badge>}
                </div>
                <p className="mt-0.5 text-xs text-muted">{t.audience === "EMPLOYEE" ? "Employee letter" : "Client letter"} · {t.category ?? "No letter type"}{n > 0 ? ` · used by ${n} NOC${n === 1 ? "" : "s"}` : ""}</p>
                <p className="mt-2 line-clamp-3 text-xs text-secondary">{snippet(t)}</p>
                <p className="mt-3 text-xs font-medium text-[var(--brand-primary)]">Edit →</p>
              </Link>
            );
          })}
        </div>
        )
      )}
    </div>
  );
}
