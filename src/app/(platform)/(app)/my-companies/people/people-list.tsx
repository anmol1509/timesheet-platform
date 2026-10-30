"use client";

import { NewLink } from "@/components/PermissionsProvider";
import { useCanHere } from "@/components/PermissionsProvider";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, type BadgeColor } from "@/components/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { deletePersonAction } from "../people-actions";
import { PARTY_ROLE_LABEL } from "@/lib/documentTypes";
import { hasFlag, type PersonFlag, type PersonRow } from "@/lib/peopleFlags";

const FILTERS: { key: "all" | PersonFlag; label: string }[] = [
  { key: "all", label: "Everyone" },
  { key: "none", label: "No documents" },
  { key: "noexpiry", label: "Expiry missing" },
  { key: "missing", label: "Required missing" },
  { key: "expired", label: "Expired" },
  { key: "expiring", label: "Expiring soon" },
  { key: "unlinked", label: "No company" },
  { key: "ok", label: "All in order" },
];

/** Each problem a person has becomes its own badge, so nothing is hidden behind the worst one. */
function badges(r: PersonRow): { color: BadgeColor; label: string }[] {
  const x = r.flags;
  const out: { color: BadgeColor; label: string }[] = [];
  if (x.unlinked) out.push({ color: "red", label: "Not linked to a company" });
  if (x.none) out.push({ color: "red", label: "No documents" });
  if (x.expired) out.push({ color: "red", label: `${x.expired} expired` });
  if (x.expiring) out.push({ color: "amber", label: `${x.expiring} expiring${r.nextDays !== null && r.nextDays >= 0 ? ` · next in ${r.nextDays}d` : ""}` });
  if (x.missing) out.push({ color: "amber", label: `${x.missing} required missing` });
  if (x.noExpiry) out.push({ color: "amber", label: `${x.noExpiry} without expiry` });
  if (out.length === 0) out.push({ color: "green", label: "In order" });
  return out;
}

export function PeopleList({ rows, canEdit }: { rows: PersonRow[]; canEdit: boolean }) {
  const canDelete = useCanHere("delete");
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | PersonFlag>("all");
  const [role, setRole] = useState("ALL");
  const [q, setQ] = useState("");

  // A person can match several filters, so the counts are not meant to add up to the total.
  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.key, f.key === "all" ? rows.length : rows.filter((r) => hasFlag(r, f.key as PersonFlag)).length])), [rows]);

  const shown = rows.filter((r) => {
    if (filter !== "all" && !hasFlag(r, filter)) return false;
    if (role !== "ALL" && !r.companies.some((c) => c.role === role)) return false;
    const needle = q.trim().toLowerCase();
    return !needle || r.name.toLowerCase().includes(needle) || r.companies.some((c) => c.name.toLowerCase().includes(needle));
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            aria-pressed={filter === f.key}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${filter === f.key ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white" : "border-default bg-surface text-muted hover:text-primary"}`}
          >
            {f.label} <span className="tabular opacity-80">{counts[f.key] ?? 0}</span>
          </button>
        ))}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <select aria-label="Role" value={role} onChange={(e) => setRole(e.target.value)} className="input w-auto py-1.5 text-sm">
            <option value="ALL">Any role</option>
            {Object.entries(PARTY_ROLE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or company" aria-label="Search people" className="input w-56 py-1.5 text-sm" />
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="card px-4 py-8 text-center text-sm text-muted">Nobody matches this filter.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-default text-left text-xs font-medium tracking-wide text-muted uppercase">
              <tr>
                <th className="px-4 py-2.5">Person</th>
                <th className="px-4 py-2.5">Companies</th>
                <th className="px-4 py-2.5 text-right">Files</th>
                <th className="px-4 py-2.5">Documents</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {shown.map((r) => {
                // The person's files sit on their first company's page, so the link lands on them.
                const home = r.companies[0] ? `/suppliers/${r.companies[0].id}#person-${r.id}` : null;
                return (
                  <tr key={r.id} className="align-top">
                    <td className="px-4 py-3">
                      <span className="font-medium text-primary">{r.name}</span>
                      <p className="text-xs text-muted">{[r.nationality, r.phone].filter(Boolean).join(" · ") || "No nationality or phone"}</p>
                    </td>
                    <td className="px-4 py-3">
                      {r.companies.length === 0 ? (
                        <span className="text-xs text-muted">None</span>
                      ) : (
                        <ul className="space-y-0.5">
                          {r.companies.slice(0, 4).map((c) => (
                            <li key={`${c.id}-${c.role}`}>
                              <Link href={`/suppliers/${c.id}`} className="hover:underline">{c.name}</Link>{" "}
                              <span className="text-xs text-muted">{PARTY_ROLE_LABEL[c.role] ?? c.role}{c.percent != null ? ` · ${c.percent}%` : ""}</span>
                            </li>
                          ))}
                          {r.companies.length > 4 && <li className="text-xs text-muted">+{r.companies.length - 4} more</li>}
                        </ul>
                      )}
                      {r.companyCount > 1 && <p className="mt-1 text-xs text-muted">{r.companyCount} companies</p>}
                    </td>
                    <td className="tabular px-4 py-3 text-right">{r.docs}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {badges(r).map((b) => <Badge key={b.label} color={b.color}>{b.label}</Badge>)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {home && <Link href={home} className="text-xs font-medium text-[var(--brand-primary)] hover:underline">Open documents</Link>}
                      {canEdit && (
                        <NewLink href={`/my-companies/people/new?person=${r.id}`} className={`text-xs font-medium text-[var(--brand-primary)] hover:underline ${home ? "ml-3" : ""}`}>
                          {r.companies.length === 0 ? "Assign" : "Add company"}
                        </NewLink>
                      )}
                      {canEdit && canDelete && r.companies.length === 0 && (
                        <ConfirmDialog
                          title={`Delete ${r.name}?`}
                          description={`${r.name} is on the list but has no company. Deleting them also deletes their ${r.docs} document${r.docs === 1 ? "" : "s"}, and this can't be undone here.`}
                          confirmLabel="Delete person"
                          onConfirm={async () => { const res = await deletePersonAction(r.id); if (!res.error) router.refresh(); return res; }}
                          trigger={(open) => <button type="button" onClick={open} className="ml-3 text-xs font-medium text-[var(--error)] hover:underline">Delete</button>}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
