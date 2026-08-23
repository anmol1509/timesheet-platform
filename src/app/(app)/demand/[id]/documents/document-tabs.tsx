"use client";

import { useState } from "react";
import Link from "next/link";
import { Download, FileText } from "lucide-react";
import { Checkbox } from "@/components/ui/Checkbox";
import { cn } from "@/lib/cn";
import { PACK_SECTIONS } from "@/lib/mobilisationPack";

type Letter = { id: string; name: string; category: string | null };
type Noc = { id: string; docNo: number; status: string };
type Worker = { id: string; name: string; employeeIdNo: string; trade: string | null };

const TABS = [
  { key: "noc", label: "NOC" },
  { key: "undertaking", label: "Undertaking" },
  { key: "profile", label: "Employee profile" },
] as const;

/**
 * The three documents a mobilisation produces, one per tab.
 *
 * NOC and Undertaking are letters: their wording lives in Letter Templates as
 * editable bodies with %%MERGE%% fields, so the approved text is maintained by
 * whoever is responsible for it rather than being buried in code here.
 */
export function DocumentTabs({
  demandId,
  requestNo,
  nocs,
  nocTemplates,
  undertakingTemplates,
  workers,
  issuers,
}: {
  demandId: string;
  requestNo: number;
  nocs: Noc[];
  nocTemplates: Letter[];
  undertakingTemplates: Letter[];
  workers: Worker[];
  /** The companies these letters get issued by, and whether each has a letterhead. */
  issuers: { name: string; hasLetterhead: boolean }[];
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("noc");
  // Whether the letters print onto each company's uploaded blank letterhead or
  // plain, for feeding pre-printed paper through the printer instead.
  const [onLetterhead, setOnLetterhead] = useState(true);
  const [sections, setSections] = useState<Set<string>>(
    () => new Set(PACK_SECTIONS.map((s) => s.key))
  );
  // Everyone mobilised is included by default; deselect to leave someone out
  // (a worker whose papers aren't ready shouldn't hold up the rest of the pack).
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(workers.map((w) => w.id)));

  function toggleWorker(id: string) {
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggle(key: string) {
    setSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const packHref = `/api/demand-requests/${demandId}/pack?${[
    ...[...sections].map((s) => `section=${encodeURIComponent(s)}`),
    ...[...chosen].map((id) => `employee=${encodeURIComponent(id)}`),
  ].join("&")}`;

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-default">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition",
              tab === t.key
                ? "border-[var(--brand-primary)] text-[var(--brand-primary)]"
                : "border-transparent text-muted hover:text-primary"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {(tab === "noc" || tab === "undertaking") && (
        <LetterheadChoice
          value={onLetterhead}
          onChange={setOnLetterhead}
          issuers={issuers}
        />
      )}

      {tab === "noc" && (
        <div className="card p-5">
          {nocs.length > 0 && (
            <ul className="mb-4 divide-y divide-[var(--border)]">
              {nocs.map((noc) => (
                <li key={noc.id} className="flex items-center justify-between py-2">
                  <Link
                    href={`/operations/nocs/${noc.id}`}
                    className="text-sm text-primary hover:underline"
                  >
                    NOC-{noc.docNo}
                    <span className="ml-2 text-xs text-subtle">{noc.status}</span>
                  </Link>
                  <a
                    href={`/api/nocs/${noc.id}${onLetterhead ? "?letterhead=1" : ""}`}
                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden />
                    PDF
                  </a>
                </li>
              ))}
            </ul>
          )}

          {nocTemplates.length === 0 ? (
            <EmptyTemplate category="No Objection Letter" />
          ) : (
            <Link
              href={`/operations/nocs/new?demandRequestId=${demandId}`}
              className="btn btn-primary"
            >
              <FileText className="h-3.5 w-3.5" aria-hidden />
              {nocs.length > 0 ? "Create another NOC" : "Create NOC"}
            </Link>
          )}
        </div>
      )}

      {tab === "undertaking" && (
        <div className="card p-5">
          {undertakingTemplates.length === 0 ? (
            <EmptyTemplate category="Undertaking Letter" />
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {undertakingTemplates.map((t) => (
                <li key={t.id} className="flex items-center justify-between py-2.5">
                  <span className="text-sm text-primary">{t.name}</span>
                  <a
                    href={`/api/demand-requests/${demandId}/undertaking?templateId=${t.id}${onLetterhead ? "&letterhead=1" : ""}`}
                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden />
                    Download PDF
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "profile" && (
        <div className="card p-5">
          <p className="mb-3 text-sm text-muted">
            {workers.length === 0
              ? "Nobody is mobilised on this demand yet — mobilise workers first."
              : "Builds a zip foldered per worker. Anything not on file is listed in the manifest rather than silently skipped."}
          </p>

          {workers.length > 0 && (
            <div className="mb-5">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">
                  Workers ({chosen.size} of {workers.length})
                </h3>
                <button
                  type="button"
                  onClick={() =>
                    setChosen(
                      chosen.size === workers.length
                        ? new Set()
                        : new Set(workers.map((w) => w.id))
                    )
                  }
                  className="text-xs font-medium text-blue-600 hover:underline"
                >
                  {chosen.size === workers.length ? "Deselect all" : "Select all"}
                </button>
              </div>
              <ul className="max-h-64 divide-y divide-[var(--border)] overflow-y-auto rounded-card border border-default">
                {workers.map((w) => (
                  <li key={w.id} className="flex items-center gap-2.5 px-3 py-2">
                    <Checkbox
                      checked={chosen.has(w.id)}
                      onCheckedChange={() => toggleWorker(w.id)}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm text-primary">
                      {w.name}
                      <span className="tabular ml-2 text-xs text-subtle">
                        {w.employeeIdNo}
                      </span>
                    </span>
                    <span className="text-xs text-muted">{w.trade || "No trade"}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">
            Documents
          </h3>
          <ul className="space-y-2">
            {PACK_SECTIONS.map((section) => (
              <li key={section.key} className="flex items-start gap-2.5">
                <Checkbox
                  checked={sections.has(section.key)}
                  onCheckedChange={() => toggle(section.key)}
                />
                <span className="min-w-0">
                  <span className="block text-sm text-primary">{section.label}</span>
                  {section.hint && (
                    <span className="block text-xs text-subtle">{section.hint}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>

          <a
            href={packHref}
            aria-disabled={sections.size === 0 || chosen.size === 0}
            className={cn(
              "btn btn-primary mt-4",
              (sections.size === 0 || chosen.size === 0) &&
                "pointer-events-none opacity-50"
            )}
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            Download {sections.size} document{sections.size === 1 ? "" : "s"} for{" "}
            {chosen.size} worker{chosen.size === 1 ? "" : "s"} · mobilisation-
            {requestNo}.zip
          </a>
        </div>
      )}
    </div>
  );
}

function EmptyTemplate({ category }: { category: string }) {
  return (
    <p className="py-6 text-center text-sm text-muted">
      No <span className="font-medium">{category}</span> template exists yet.{" "}
      <Link href="/letter-templates" className="underline">
        Add one in Letter Templates
      </Link>{" "}
      — the body text and its merge fields live there.
    </p>
  );
}

/**
 * Letterhead or plain.
 *
 * Plain exists because most offices print these onto pre-printed paper that
 * already carries the letterhead — drawing it again would print it twice.
 */
function LetterheadChoice({
  value,
  onChange,
  issuers,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
  issuers: { name: string; hasLetterhead: boolean }[];
}) {
  const missing = issuers.filter((i) => !i.hasLetterhead);
  return (
    <div className="card flex flex-wrap items-center gap-3 p-4">
      <span className="text-xs font-medium text-muted">Print on</span>
      <div className="flex gap-1.5">
        {(
          [
            [true, "Company letterhead"],
            [false, "Plain paper"],
          ] as const
        ).map(([option, label]) => (
          <button
            key={label}
            type="button"
            onClick={() => onChange(option)}
            className={cn(
              "rounded-control border px-3 py-1.5 text-xs font-medium transition",
              value === option
                ? "border-[var(--brand-primary)] bg-brand-soft text-[var(--brand-primary)]"
                : "border-default bg-surface text-secondary hover:bg-surface-hover"
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="text-xs text-subtle">
        {value
          ? `One letter per company (${issuers.length}), each on its own letterhead.`
          : "No letterhead drawn — for feeding pre-printed paper through the printer."}
      </p>

      {/* Said before the download, not discovered after it. */}
      {value && missing.length > 0 && (
        <p className="w-full rounded-card border border-[var(--warning-border)] bg-[var(--warning-soft)] px-3 py-2 text-xs text-[var(--warning)]">
          No letterhead on file for {missing.map((m) => m.name).join(", ")} — those
          letters print plain. Upload one on the supplier&apos;s Documents tab.
        </p>
      )}
    </div>
  );
}
