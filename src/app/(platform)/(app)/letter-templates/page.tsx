import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdmin, requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { LETTER_PRESETS, presetByKey } from "@/lib/letterPresets";
import { presetState } from "@/lib/letterPresetHistory";
import { sampleFilledHtml } from "@/lib/templatePaper";
import { formatLetterDate } from "@/lib/letterLayout";
import { askLabels, templateHtml } from "@/lib/letterHtml";
import { Copy } from "lucide-react";
import { HeroHeader } from "@/components/HeroHeader";
import { AddDefaultsButton, NewTemplateButton } from "./gallery";
import { TemplateGallery, type TemplateCard } from "./template-gallery";

export const metadata = { title: "Letter templates" };

export default async function LetterTemplatesPage({ searchParams }: { searchParams: Promise<{ error?: string; tab?: string }> }) {
  await requireAdmin();
  const { error, tab = "all" } = await searchParams;
  const { branchId } = await requireUserWithBranch();
  const [templates, nocUse, letterUse] = await Promise.all([
    prisma.letterTemplate.findMany({ where: branchWhere(branchId), orderBy: [{ category: "asc" }, { name: "asc" }] }),
    prisma.noc.groupBy({ by: ["templateId"], where: branchWhere(branchId), _count: { _all: true }, _max: { createdAt: true } }),
    prisma.issuedLetter.groupBy({ by: ["templateId"], where: { ...branchWhere(branchId), templateId: { not: null } }, _count: { _all: true }, _max: { createdAt: true } }),
  ]);
  // Which kind of letter each template is, for the tabs.
  const kindOf = (t: { audience: string; category: string | null }): string =>
    t.audience === "EMPLOYEE" ? "employee" : t.category === "Check-in List" ? "checkin" : t.category === "No Objection Letter" ? "noc" : t.category === "Undertaking Letter" || t.category === "Supplier Undertaking" ? "undertaking" : "other";
  const TABS = [
    { key: "all", label: "All" },
    { key: "employee", label: "Employee letters" },
    { key: "noc", label: "NOC" },
    { key: "undertaking", label: "Undertaking" },
    { key: "checkin", label: "Check-in list" },
    { key: "other", label: "Other" },
  ];
  const counts = new Map<string, number>(TABS.map((x) => [x.key, x.key === "all" ? templates.length : templates.filter((t) => kindOf(t) === x.key).length]));
  const shown = tab === "all" ? templates : templates.filter((t) => kindOf(t) === tab);
  // How often each template has been used (NOCs and issued letters together) and when last.
  const used = new Map<string, { n: number; last: Date | null }>();
  for (const u of [...nocUse, ...letterUse]) {
    if (!u.templateId) continue;
    const cur = used.get(u.templateId) ?? { n: 0, last: null };
    const last = u._max.createdAt;
    used.set(u.templateId, { n: cur.n + u._count._all, last: last && (!cur.last || last > cur.last) ? last : cur.last });
  }
  const versionsOf = new Map<string, number>();
  for (const t of templates) versionsOf.set(t.category ?? "No letter type", (versionsOf.get(t.category ?? "No letter type") ?? 0) + 1);
  const cards: TemplateCard[] = shown.map((t) => {
    const html = templateHtml(t);
    const pr = presetByKey(t.presetKey);
    const audience = t.audience === "EMPLOYEE" ? "EMPLOYEE" : "SITE";
    const u = used.get(t.id);
    return {
      id: t.id, name: t.name, category: t.category ?? "No letter type", audience,
      state: !pr ? "own" : presetState(pr, html),
      title: t.title || t.category || t.name, html: sampleFilledHtml(html, audience),
      issued: u?.n ?? 0, lastUsed: u?.last ? formatLetterDate(u.last) : null, asks: askLabels(html),
      versions: versionsOf.get(t.category ?? "No letter type") ?? 1,
    };
  });
  const haveKeys = new Set(templates.map((t) => t.presetKey).filter(Boolean));
  const missingDefaults = LETTER_PRESETS.some((p) => !haveKeys.has(p.key));

  return (
    <div className="space-y-5">
      <HeroHeader
        icon={Copy}
        title="Letter templates"
        subtitle="The wording behind every letter. Edit it like an email, with a live preview."
        pills={templates.length === 0 ? [] : [
          { label: "Templates", value: String(templates.length) },
          { label: "Employee letters", value: String(counts.get("employee") ?? 0) },
          { label: "Client letters", value: String(templates.length - (counts.get("employee") ?? 0)) },
          ...(missingDefaults ? [{ label: "Ready-made not added", value: String(LETTER_PRESETS.filter((p) => !haveKeys.has(p.key)).length), warn: true }] : []),
        ]}
        actions={branchId ? (
          <>
            {templates.length > 0 && missingDefaults && <AddDefaultsButton />}
            <NewTemplateButton />
          </>
        ) : undefined}
      />
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
        <p className="text-sm text-muted">Sign in as a company administrator to manage its templates.</p>
      ) : templates.length === 0 ? (
        <section className="card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-base font-semibold text-primary">Start with the ready-made set</h2><p className="mt-1 text-sm text-muted">{LETTER_PRESETS.length} templates with the right fields already in place. Change any of them afterwards.</p></div>
            <div className="flex gap-2"><AddDefaultsButton primary label={`Add all ${LETTER_PRESETS.length}`} /><NewTemplateButton variant="secondary" /></div>
          </div>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div><p className="text-xs font-semibold tracking-wide text-muted uppercase">Employee letters · {LETTER_PRESETS.filter((p) => p.audience === "EMPLOYEE").length}</p><ul className="mt-2 space-y-1 text-sm text-secondary">{LETTER_PRESETS.filter((p) => p.audience === "EMPLOYEE").map((p) => <li key={p.key}>{p.name}</li>)}</ul></div>
            <div><p className="text-xs font-semibold tracking-wide text-muted uppercase">Client letters · {LETTER_PRESETS.filter((p) => p.audience !== "EMPLOYEE").length}</p><ul className="mt-2 space-y-1 text-sm text-secondary">{LETTER_PRESETS.filter((p) => p.audience !== "EMPLOYEE").map((p) => <li key={p.key}>{p.name}</li>)}</ul></div>
          </div>
        </section>
      ) : (
        shown.length === 0 ? (
          <p className="text-sm text-muted">No templates of this type yet. Use “New template” to add one.</p>
        ) : (
        <TemplateGallery cards={cards} />
        )
      )}
    </div>
  );
}
