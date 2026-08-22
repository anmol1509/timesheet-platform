"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/Badge";
import { Checkbox } from "@/components/ui/Checkbox";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/cn";
import { confirmSiteArrivalAction, revertSiteArrivalAction } from "../actions";

export type ArrivalRow = {
  id: string;
  name: string;
  employeeIdNo: string;
  trade: string | null;
  projectId: string | null;
  clientName: string | null;
  projectLabel: string | null;
  mobilisationDate: string | null;
  siteArrivalDate: string | null;
  siteName: string | null;
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00.000Z").toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });
}

/**
 * How overdue an arrival is, in whole days past the date they were due.
 *
 * The count is the point of the screen: one day late is a traffic jam, ten days
 * late means the worker never went and nobody said so.
 */
function daysWaiting(mobilisationDate: string | null) {
  if (!mobilisationDate) return null;
  const due = new Date(mobilisationDate + "T00:00:00.000Z").getTime();
  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z").getTime();
  const days = Math.floor((today - due) / 86_400_000);
  return days > 0 ? days : null;
}

export function SiteArrivalBoard({
  pending,
  arrived,
  sites,
}: {
  pending: ArrivalRow[];
  arrived: ArrivalRow[];
  sites: { id: string; name: string; projectId: string }[];
}) {
  const router = useRouter();
  const [saving, startTransition] = useTransition();
  const [tab, setTab] = useState<"pending" | "arrived">("pending");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [arrivalDate, setArrivalDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [siteId, setSiteId] = useState("");

  const rows = tab === "pending" ? pending : arrived;
  const allPicked = useMemo(
    () => pending.length > 0 && pending.every((r) => picked.has(r.id)),
    [pending, picked]
  );

  // A site belongs to one project, so offering every site would let someone
  // file a worker onto a site their project doesn't have. Only when the whole
  // selection shares a project is there a correct list to show.
  const sharedProjectId = useMemo(() => {
    const ids = new Set(pending.filter((r) => picked.has(r.id)).map((r) => r.projectId));
    return ids.size === 1 ? [...ids][0] : null;
  }, [pending, picked]);

  const siteOptions = useMemo(
    () => (sharedProjectId ? sites.filter((s) => s.projectId === sharedProjectId) : []),
    [sites, sharedProjectId]
  );

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setPicked(allPicked ? new Set() : new Set(pending.map((r) => r.id)));
  }

  function confirm() {
    if (picked.size === 0) return;
    const body = new FormData();
    body.append("siteArrivalDate", arrivalDate);
    // Only send a site that still belongs to the selection's project — the
    // selection can change after the site was chosen.
    if (siteId && siteOptions.some((s) => s.id === siteId)) body.append("siteId", siteId);
    for (const id of picked) body.append("employeeId", id);
    startTransition(async () => {
      await confirmSiteArrivalAction(body);
      setPicked(new Set());
      // Clearing the selection empties the site list, and a Select holding a
      // value it can no longer find falls back to printing the raw id.
      setSiteId("");
      router.refresh();
    });
  }

  function revert(employeeId: string) {
    const body = new FormData();
    body.append("employeeId", employeeId);
    startTransition(async () => {
      await revertSiteArrivalAction(body);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ["pending", `Awaiting arrival (${pending.length})`],
            ["arrived", `On site (${arrived.length})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "rounded-control border px-3 py-1.5 text-xs font-medium transition",
              tab === key
                ? "border-[var(--brand-primary)] bg-brand-soft text-[var(--brand-primary)]"
                : "border-default bg-surface text-secondary hover:bg-surface-hover"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        {tab === "pending" && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-default px-4 py-3">
            <span className="text-xs text-muted">
              {picked.size > 0 ? `${picked.size} selected` : "Select who reached site"}
            </span>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-1.5">
                <span className="text-xs text-muted">Reached site on</span>
                <input
                  type="date"
                  value={arrivalDate}
                  onChange={(e) => setArrivalDate(e.target.value)}
                  className="input px-2 py-1 text-xs"
                />
              </label>
              {/* Optional: a demand names a project, and only the site knows
                  which of its sites the worker was actually put on. */}
              <div className="w-56">
                <Select
                  // Never hand the Select a value its own options don't
                  // contain — changing the selection can strand the chosen
                  // site, and it would render the bare id.
                  value={siteOptions.some((s) => s.id === siteId) ? siteId : ""}
                  onChange={setSiteId}
                  disabled={siteOptions.length === 0}
                  placeholder={
                    picked.size === 0
                      ? "Site (optional)"
                      : !sharedProjectId
                        ? "Sites differ by project"
                        : siteOptions.length === 0
                          ? "Project has no sites"
                          : "Site (optional)"
                  }
                  options={siteOptions.map((s) => ({ value: s.id, label: s.name }))}
                />
              </div>
              <button
                type="button"
                onClick={confirm}
                disabled={saving || picked.size === 0}
                className="btn btn-primary btn-sm"
              >
                Confirm on site {picked.size > 0 ? picked.size : ""}
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] text-sm">
            <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium tracking-wide text-muted uppercase">
              <tr>
                {tab === "pending" && (
                  <th className="w-10 px-4 py-3">
                    <Checkbox
                      checked={allPicked}
                      onCheckedChange={toggleAll}
                      ariaLabel="Select everyone awaiting arrival"
                    />
                  </th>
                )}
                <th className="px-4 py-3">Worker</th>
                <th className="px-4 py-3">Trade</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3">Due on site</th>
                <th className="px-4 py-3">
                  {tab === "pending" ? "Waiting" : "Arrived"}
                </th>
                {tab === "arrived" && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {rows.map((r) => {
                const late = tab === "pending" ? daysWaiting(r.mobilisationDate) : null;
                return (
                  <tr key={r.id}>
                    {tab === "pending" && (
                      <td className="px-4 py-3">
                        <Checkbox
                          checked={picked.has(r.id)}
                          onCheckedChange={() => toggle(r.id)}
                          ariaLabel={`Confirm ${r.name} on site`}
                        />
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <Link
                        href={`/employees/${r.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {r.name}
                      </Link>
                      <span className="tabular ml-2 text-xs text-subtle">
                        {r.employeeIdNo}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-secondary">
                      {r.trade || <span className="text-subtle">—</span>}
                    </td>
                    <td className="px-4 py-3 text-secondary">
                      {r.clientName || <span className="text-subtle">—</span>}
                    </td>
                    <td className="px-4 py-3 text-secondary">
                      {r.projectLabel || <span className="text-subtle">Not assigned</span>}
                    </td>
                    <td className="tabular px-4 py-3 text-secondary">
                      {formatDate(r.mobilisationDate)}
                    </td>
                    <td className="px-4 py-3">
                      {tab === "pending" ? (
                        late === null ? (
                          <span className="text-xs text-muted">Not yet due</span>
                        ) : (
                          <Badge color={late > 3 ? "red" : "amber"}>
                            {late} day{late === 1 ? "" : "s"}
                          </Badge>
                        )
                      ) : (
                        <span className="tabular text-secondary">
                          {formatDate(r.siteArrivalDate)}
                          {r.siteName && (
                            <span className="ml-2 text-xs text-subtle">{r.siteName}</span>
                          )}
                        </span>
                      )}
                    </td>
                    {tab === "arrived" && (
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => revert(r.id)}
                          title="Puts the worker back to awaiting arrival"
                          className="text-xs font-medium text-red-600 hover:underline disabled:opacity-60"
                        >
                          Undo
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {rows.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-muted">
            {tab === "pending"
              ? "Everyone mobilised has been confirmed on site."
              : "Nobody has been confirmed on site yet."}
          </p>
        )}
      </div>
    </div>
  );
}
