"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Badge } from "@/components/Badge";
import { Checkbox } from "@/components/ui/Checkbox";
import { Select } from "@/components/ui/Select";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";
import { cn } from "@/lib/cn";
import { confirmSiteArrivalAction, recordMissingArrivalAction, revertSiteArrivalAction, disapproveSiteArrivalAction } from "../actions";
import { DatePicker } from "@/components/ui/DatePicker";

export type ArrivalRow = {
  id: string;
  name: string;
  employeeIdNo: string;
  trade: string | null;
  projectId: string | null;
  clientName: string | null;
  projectLabel: string | null;
  mobilisationDate: string | null;
  joinDate?: string | null;
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
  unrecorded,
  initialTab,
  sites,
}: {
  pending: ArrivalRow[];
  arrived: ArrivalRow[];
  unrecorded: ArrivalRow[];
  initialTab: "pending" | "arrived" | "unrecorded";
  sites: { id: string; name: string; projectId: string }[];
}) {
  const router = useRouter();
  const [saving, startTransition] = useTransition();
  const [tab, setTab] = useState<"pending" | "arrived" | "unrecorded">(initialTab);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [arrivalDate, setArrivalDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [siteId, setSiteId] = useState("");
  const [disapproving, setDisapproving] = useState<ArrivalRow | null>(null);
  const [query, setQuery] = useState("");

  // The search narrows what is listed, never what is picked: a worker ticked and then
  // searched away stays selected, and the button count says so.
  const needle = query.trim().toLowerCase();
  const matches = (r: ArrivalRow) =>
    !needle || [r.name, r.employeeIdNo, r.trade].some((p) => p?.toLowerCase().includes(needle));
  const shownPending = useMemo(() => pending.filter(matches), [pending, needle]); // eslint-disable-line react-hooks/exhaustive-deps
  const shownArrived = useMemo(() => arrived.filter(matches), [arrived, needle]); // eslint-disable-line react-hooks/exhaustive-deps
  const shownUnrecorded = useMemo(() => unrecorded.filter(matches), [unrecorded, needle]); // eslint-disable-line react-hooks/exhaustive-deps
  const rows = tab === "pending" ? shownPending : tab === "unrecorded" ? shownUnrecorded : shownArrived;
  const selectable = tab === "pending" ? shownPending : shownUnrecorded;
  const allPicked = useMemo(
    () => selectable.length > 0 && selectable.every((r) => picked.has(r.id)),
    [selectable, picked]
  );

  // A site belongs to one project, so offering every site would let someone
  // file a worker onto a site their project doesn't have. Only when the whole
  // selection shares a project is there a correct list to show.
  const sharedProjectId = useMemo(() => {
    const ids = new Set((tab === "unrecorded" ? unrecorded : pending).filter((r) => picked.has(r.id)).map((r) => r.projectId));
    return ids.size === 1 ? [...ids][0] : null;
  }, [pending, unrecorded, tab, picked]);

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
    setPicked(allPicked ? new Set() : new Set(selectable.map((r) => r.id)));
  }

  // Records the date for Active workers who never had one. Nothing else about them changes.
  function recordMissing(ids: string[]) {
    if (ids.length === 0) return;
    setError(null);
    const body = new FormData();
    body.append("siteArrivalDate", arrivalDate);
    if (siteId && siteOptions.some((s) => s.id === siteId)) body.append("siteId", siteId);
    for (const id of ids) body.append("employeeId", id);
    startTransition(async () => {
      const res = await recordMissingArrivalAction(body);
      if (res?.error) { setError(res.error); return; }
      setPicked(new Set());
      setSiteId("");
      router.refresh();
    });
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

  // Single-row approve, alongside the bulk one above — the per-row
  // Approve/Disapprove pair is the primary way through this list; the
  // checkbox + top bar stays for confirming several at once.
  function approveOne(employeeId: string) {
    const body = new FormData();
    body.append("siteArrivalDate", arrivalDate);
    if (siteId && siteOptions.some((s) => s.id === siteId)) body.append("siteId", siteId);
    body.append("employeeId", employeeId);
    startTransition(async () => {
      await confirmSiteArrivalAction(body);
      setPicked((prev) => {
        const next = new Set(prev);
        next.delete(employeeId);
        return next;
      });
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["pending", `Awaiting arrival (${pending.length})`],
                ["arrived", `On site (${arrived.length})`],
                ["unrecorded", `Arrival not recorded (${unrecorded.length})`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => { setTab(key); setPicked(new Set()); setError(null); }}
                className={cn(
                  "rounded-control border px-3 py-1.5 text-xs font-medium transition",
                  tab === key
                    ? "border-[var(--brand-primary)] bg-brand-soft text-[var(--brand-primary)]"
                    : key === "unrecorded" && unrecorded.length > 0
                      ? "border-[var(--warning-border)] bg-[var(--warning-soft)] text-primary hover:bg-surface-hover"
                      : "border-default bg-surface text-secondary hover:bg-surface-hover"
                )}
              >
                {label}
              </button>
            ))}
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, ID or trade"
            aria-label="Search workers"
            className="input h-9 w-full py-0 pl-9 text-sm"
          />
        </div>
      </div>

      {error && <p role="alert" className="text-sm text-[var(--error)]">{error}</p>}
      <div className="card overflow-hidden">
        {tab === "unrecorded" && (
          <p className="border-b border-default bg-[var(--warning-soft)] px-4 py-2.5 text-xs text-primary">
            These workers are Active but nobody has recorded when they reached site, so attendance cannot be marked for them. Enter the date they actually arrived. Their status does not change.
          </p>
        )}
        {(tab === "pending" || tab === "unrecorded") && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-default px-4 py-3">
            <span className="text-xs text-muted">
              {picked.size > 0 ? `${picked.size} selected` : tab === "unrecorded" ? "Select who to record" : "Select who reached site"}
            </span>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-1.5">
                <span className="text-xs text-muted">Reached site on</span>
                <DatePicker value={arrivalDate} onChange={(v) => setArrivalDate(v)} />
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
                onClick={tab === "unrecorded" ? () => recordMissing([...picked]) : confirm}
                disabled={saving || picked.size === 0}
                className="btn btn-primary btn-sm"
              >
                {tab === "unrecorded" ? "Record arrival" : "Confirm on site"} {picked.size > 0 ? picked.size : ""}
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] text-sm">
            <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium tracking-wide text-muted uppercase">
              <tr>
                {(tab === "pending" || tab === "unrecorded") && (
                  <th className="w-10 px-4 py-3">
                    <Checkbox
                      checked={allPicked}
                      onCheckedChange={toggleAll}
                      ariaLabel={tab === "unrecorded" ? "Select everyone without an arrival date" : "Select everyone awaiting arrival"}
                    />
                  </th>
                )}
                <th className="px-4 py-3">Worker</th>
                <th className="px-4 py-3">Trade</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3">{tab === "unrecorded" ? "Joined" : "Due on site"}</th>
                <th className="px-4 py-3">
                  {tab === "pending" ? "Waiting" : tab === "unrecorded" ? "Arrival" : "Arrived"}
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {rows.map((r) => {
                const late = tab === "pending" ? daysWaiting(r.mobilisationDate) : null;
                return (
                  <tr key={r.id}>
                    {(tab === "pending" || tab === "unrecorded") && (
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
                        href={`/employees/${r.id}`} target="_blank" rel="noopener noreferrer"
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
                      {formatDate(tab === "unrecorded" ? r.joinDate ?? null : r.mobilisationDate)}
                    </td>
                    <td className="px-4 py-3">
                      {tab === "unrecorded" ? (
                        <Badge color="amber">Not recorded</Badge>
                      ) : tab === "pending" ? (
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
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {tab === "unrecorded" ? (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => recordMissing([r.id])}
                          className="text-xs font-medium text-[var(--brand-primary)] hover:underline disabled:opacity-60"
                        >
                          Record
                        </button>
                      ) : tab === "arrived" ? (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => revert(r.id)}
                          title="Puts the worker back to awaiting arrival"
                          className="text-xs font-medium text-[var(--error)] hover:underline disabled:opacity-60"
                        >
                          Undo
                        </button>
                      ) : (
                        <div className="flex items-center justify-end gap-3">
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => approveOne(r.id)}
                            className="text-xs font-medium text-[var(--success)] hover:underline disabled:opacity-60"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => setDisapproving(r)}
                            className="text-xs font-medium text-[var(--error)] hover:underline disabled:opacity-60"
                          >
                            Disapprove
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {rows.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-muted">
            {needle
              ? `No worker matches “${query.trim()}”.`
              : tab === "unrecorded"
                ? "Every active worker has an arrival date."
                : tab === "pending"
                ? "Everyone mobilised has been confirmed on site."
                : "Nobody has been confirmed on site yet."}
          </p>
        )}
      </div>

      <DisapproveModal
        row={disapproving}
        onClose={() => setDisapproving(null)}
        onDone={() => router.refresh()}
      />
    </div>
  );
}

function DisapproveModal({
  row,
  onClose,
  onDone,
}: {
  row: ArrivalRow | null;
  onClose: () => void;
  onDone: () => void;
}) {
  return (
    <Dialog modal={false} open={row !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title={`Disapprove ${row?.name ?? ""}`}
        description="They never actually reached site. This ends the placement (allocation removed, project cleared, back to Idle) and the reason is saved as a note on their profile."
      >
        {row && <DisapproveForm row={row} onClose={onClose} onDone={onDone} />}
      </DialogContent>
    </Dialog>
  );
}

function DisapproveForm({
  row,
  onClose,
  onDone,
}: {
  row: ArrivalRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (!reason.trim()) return;
    setError(null);
    const body = new FormData();
    body.append("employeeId", row.id);
    body.append("reason", reason.trim());
    startTransition(async () => {
      const result = await disapproveSiteArrivalAction(body);
      if (result && "error" in result && result.error) {
        setError(result.error);
        return;
      }
      onDone();
      onClose();
    });
  }

  return (
    <div className="mt-4 space-y-4">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Reason</span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          autoFocus
          placeholder="Why didn't they show up?"
          className="input w-full"
        />
      </label>
      {error && <p className="text-sm text-[var(--error)]">{error}</p>}
      <DialogFooter>
        <button type="button" onClick={onClose} className="btn btn-secondary">
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!reason.trim() || pending}
          className="btn btn-danger"
        >
          {pending ? "Saving…" : "Disapprove"}
        </button>
      </DialogFooter>
    </div>
  );
}
