"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Badge } from "@/components/Badge";
import { Checkbox } from "@/components/ui/Checkbox";
import { Select } from "@/components/ui/Select";
import { STAGE_COLOR, STAGE_LABEL } from "@/lib/employeeStage";
import { cn } from "@/lib/cn";
import { demobiliseAction } from "./actions";
import { DatePicker } from "@/components/ui/DatePicker";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";

export type DeployedRow = {
  id: string;
  name: string;
  employeeIdNo: string;
  trade: string | null;
  status: string;
  supplierName: string | null;
  siteName: string | null;
  clientName: string | null;
  projectLabel: string | null;
  since: string | null;
};

export type RecentRow = {
  id: string;
  employeeId: string;
  name: string;
  employeeIdNo: string;
  trade: string | null;
  stillEmployed: boolean;
  projectName: string | null;
  mobilizedDate: string | null;
  demobilizedDate: string | null;
  reason: string | null;
  byName: string | null;
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

/** Whole days on the job, which is what anyone asks about a placement. */
function daysOn(since: string | null) {
  if (!since) return null;
  const start = new Date(since + "T00:00:00.000Z").getTime();
  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z").getTime();
  const days = Math.floor((today - start) / 86_400_000);
  return days >= 0 ? days : null;
}

export function DemobilisationBoard({
  clientId,
  projectId,
  clients,
  projects,
  deployed,
  recent,
}: {
  clientId: string;
  projectId: string;
  clients: { id: string; name: string }[];
  projects: { id: string; label: string; clientId: string }[];
  deployed: DeployedRow[];
  recent: RecentRow[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [saving, startTransition] = useTransition();
  const [tab, setTab] = useState<"deployed" | "recent">("deployed");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [outcome, setOutcome] = useState<"BENCH" | "OFF_BOOKS">("BENCH");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  // One worker at a time: the row button opens a small form with that worker's own date, outcome and reason.
  const [one, setOne] = useState<DeployedRow | null>(null);
  const [query, setQuery] = useState("");

  const visibleProjects = useMemo(
    () => (clientId ? projects.filter((p) => p.clientId === clientId) : projects),
    [projects, clientId]
  );
  // The search narrows what is listed, never what is picked: a worker ticked and then
  // searched away stays selected, and the button count says so.
  const needle = query.trim().toLowerCase();
  const matches = (...parts: (string | null)[]) => !needle || parts.some((p) => p?.toLowerCase().includes(needle));
  const shownDeployed = useMemo(() => deployed.filter((r) => matches(r.name, r.employeeIdNo, r.trade)), [deployed, needle]); // eslint-disable-line react-hooks/exhaustive-deps
  const shownRecent = useMemo(() => recent.filter((r) => matches(r.name, r.employeeIdNo, r.trade)), [recent, needle]); // eslint-disable-line react-hooks/exhaustive-deps
  const allPicked = shownDeployed.length > 0 && shownDeployed.every((r) => picked.has(r.id));

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    if (key === "clientId") next.delete("projectId");
    setPicked(new Set());
    router.push(`?${next.toString()}`, { scroll: false });
  }

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function submit() {
    if (picked.size === 0) return;
    const body = new FormData();
    body.append("date", date);
    body.append("outcome", outcome);
    body.append("reason", reason);
    for (const id of picked) body.append("employeeId", id);
    startTransition(async () => {
      const res = await demobiliseAction(body);
      if (res.error) setMessage(res.error);
      else {
        const r = res.result!;
        const parts = [`${r.demobilised} worker(s) demobilised`];
        if (r.allocationsCleared) parts.push(`${r.allocationsCleared} demand allocation(s) reopened`);
        if (r.bedsReleased) parts.push(`${r.bedsReleased} bed(s) freed`);
        setMessage(`${parts.join(", ")}.`);
        setPicked(new Set());
        setReason("");
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["deployed", `Deployed (${deployed.length})`],
                ["recent", `Recently demobilised (${recent.length})`],
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

      {tab === "deployed" && (
        <>
          <div className="card flex flex-wrap items-end gap-3 p-4">
            <label className="w-52">
              <span className="mb-1 block text-xs font-medium text-muted">Client</span>
              <Select
                value={clientId}
                onChange={(v) => setParam("clientId", v)}
                placeholder="All clients"
                options={[
                  { value: "", label: "All clients" },
                  ...clients.map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
            </label>
            <label className="w-52">
              <span className="mb-1 block text-xs font-medium text-muted">Project</span>
              <Select
                value={visibleProjects.some((p) => p.id === projectId) ? projectId : ""}
                onChange={(v) => setParam("projectId", v)}
                placeholder="All projects"
                options={[
                  { value: "", label: "All projects" },
                  ...visibleProjects.map((p) => ({ value: p.id, label: p.label })),
                ]}
              />
            </label>
          </div>

          {picked.size === 0 && (
            <p className="card px-4 py-3 text-xs text-muted">
              Use the button on a row to demobilise one worker, or tick several to demobilise them together.
              {message && <span className="mt-1 block text-secondary">{message}</span>}
            </p>
          )}
          {picked.size > 0 && (
          <div className="card space-y-3 p-4">
            <p className="text-xs font-medium text-secondary">{picked.size} selected, one date and outcome for all</p>
            <div className="flex flex-wrap items-end gap-3">
              <label>
                <span className="mb-1 block text-xs font-medium text-muted">Came off site on</span>
                <DatePicker value={date} onChange={(v) => setDate(v)} />
              </label>
              <label className="w-56">
                <span className="mb-1 block text-xs font-medium text-muted">Then</span>
                <Select
                  value={outcome}
                  onChange={(v) => setOutcome(v as "BENCH" | "OFF_BOOKS")}
                  searchable={false}
                  options={[
                    { value: "BENCH", label: "Back to the bench" },
                    { value: "OFF_BOOKS", label: "Off the books" },
                  ]}
                />
              </label>
              <label className="min-w-[14rem] flex-1">
                <span className="mb-1 block text-xs font-medium text-muted">
                  Reason {outcome === "OFF_BOOKS" && <span className="text-subtle">(kept on the record)</span>}
                </span>
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Project completed, visa expired, absconded…"
                  className="input w-full"
                />
              </label>
              <Button onClick={submit} disabled={picked.size === 0} loading={saving}>
                Demobilise {picked.size || ""}
              </Button>
            </div>

            <p className="text-xs text-subtle">
              {outcome === "BENCH"
                ? "Comes off the job and back onto the bench, available for the next demand. Their bed is kept."
                : "Comes off the job and off the roster: marked inactive and their bed is freed."}
            </p>
            {message && <p className="text-xs text-secondary">{message}</p>}
          </div>
          )}

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[56rem] text-sm">
                <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium tracking-wide text-muted uppercase">
                  <tr>
                    <th className="w-10 px-4 py-3">
                      <Checkbox
                        checked={allPicked}
                        onCheckedChange={() =>
                          setPicked(allPicked ? new Set() : new Set(shownDeployed.map((r) => r.id)))
                        }
                        ariaLabel="Select everyone deployed"
                      />
                    </th>
                    <th className="px-4 py-3">Worker</th>
                    <th className="px-4 py-3">Trade</th>
                    <th className="px-4 py-3">Company</th>
                    <th className="px-4 py-3">Client</th>
                    <th className="px-4 py-3">Project</th>
                    <th className="px-4 py-3">Stage</th>
                    <th className="px-4 py-3">On the job</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {shownDeployed.map((r) => {
                    const days = daysOn(r.since);
                    return (
                      <tr key={r.id}>
                        <td className="px-4 py-3">
                          <Checkbox
                            checked={picked.has(r.id)}
                            onCheckedChange={() => toggle(r.id)}
                            ariaLabel={`Demobilise ${r.name}`}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/employees/${r.id}`} target="_blank" rel="noopener noreferrer"
                            className="font-medium text-primary hover:underline"
                          >
                            {r.name}
                          </Link>
                          <span className="tabular ml-2 text-xs text-subtle">{r.employeeIdNo}</span>
                        </td>
                        <td className="px-4 py-3 text-secondary">
                          {r.trade || <span className="text-subtle">—</span>}
                        </td>
                        <td className="px-4 py-3 text-secondary">
                          {r.supplierName || <span className="text-subtle">—</span>}
                        </td>
                        <td className="px-4 py-3 text-secondary">
                          {r.clientName || <span className="text-subtle">—</span>}
                        </td>
                        <td className="px-4 py-3 text-secondary">
                          {r.projectLabel}
                          {r.siteName && (
                            <span className="block text-xs text-subtle">{r.siteName}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Badge color={STAGE_COLOR[r.status] ?? "slate"}>
                            {STAGE_LABEL[r.status] ?? r.status}
                          </Badge>
                        </td>
                        <td className="tabular px-4 py-3 text-secondary">
                          {days === null ? "—" : `${days} day${days === 1 ? "" : "s"}`}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <button type="button" disabled={saving} onClick={() => setOne(r)} className="btn btn-secondary btn-sm">
                            Demobilise
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {shownDeployed.length === 0 && (
              <p className="px-4 py-10 text-center text-sm text-muted">
                {needle ? `No deployed worker matches “${query.trim()}”.` : "Nobody is deployed under these filters."}
              </p>
            )}
          </div>
        </>
      )}

      {tab === "recent" && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-sm">
              <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium tracking-wide text-muted uppercase">
                <tr>
                  <th className="px-4 py-3">Worker</th>
                  <th className="px-4 py-3">Trade</th>
                  <th className="px-4 py-3">Project</th>
                  <th className="px-4 py-3">On the job</th>
                  <th className="px-4 py-3">Came off</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Now</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {shownRecent.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3">
                      <Link
                        href={`/employees/${r.employeeId}`} target="_blank" rel="noopener noreferrer"
                        className="font-medium text-primary hover:underline"
                      >
                        {r.name}
                      </Link>
                      <span className="tabular ml-2 text-xs text-subtle">{r.employeeIdNo}</span>
                    </td>
                    <td className="px-4 py-3 text-secondary">
                      {r.trade || <span className="text-subtle">—</span>}
                    </td>
                    <td className="px-4 py-3 text-secondary">
                      {r.projectName || <span className="text-subtle">—</span>}
                    </td>
                    <td className="tabular px-4 py-3 text-secondary">
                      {formatDate(r.mobilizedDate)} → {formatDate(r.demobilizedDate)}
                    </td>
                    <td className="tabular px-4 py-3 text-secondary">
                      {formatDate(r.demobilizedDate)}
                      {r.byName && <span className="block text-xs text-subtle">by {r.byName}</span>}
                    </td>
                    <td className="px-4 py-3 text-secondary">
                      {r.reason || <span className="text-subtle">Not stated</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge color={r.stillEmployed ? "slate" : "red"}>
                        {r.stillEmployed ? "On the bench" : "Off the books"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {shownRecent.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-muted">
              {needle ? `No demobilised worker matches “${query.trim()}”.` : "Nothing has been demobilised yet."}
            </p>
          )}
          {/* No undo: putting someone back on a job is a mobilisation, and it
              has its own screen that records it properly. */}
          <p className="border-t border-default px-4 py-3 text-xs text-subtle">
            To put someone back on a job, mobilise them against a demand. That
            opens a fresh placement rather than reopening a closed one.
          </p>
        </div>
      )}
      <DemobiliseOneModal
        row={one}
        onClose={() => setOne(null)}
        onDone={(text) => {
          setMessage(text);
          router.refresh();
        }}
      />
    </div>
  );
}

/** Demobilises one worker with their own date, outcome and reason. The bulk bar above is only for workers ticked there. */
function DemobiliseOneModal({ row, onClose, onDone }: { row: DeployedRow | null; onClose: () => void; onDone: (message: string) => void }) {
  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title="Demobilise"
        description={row ? `${row.name} (${row.employeeIdNo})${row.projectLabel ? `, ${row.projectLabel}` : ""}` : undefined}
      >
        {row && <DemobiliseOneForm key={row.id} row={row} onClose={onClose} onDone={onDone} />}
      </DialogContent>
    </Dialog>
  );
}

function DemobiliseOneForm({ row, onClose, onDone }: { row: DeployedRow; onClose: () => void; onDone: (message: string) => void }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [outcome, setOutcome] = useState<"BENCH" | "OFF_BOOKS">("BENCH");
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    const body = new FormData();
    body.append("employeeId", row.id);
    body.append("date", date);
    body.append("outcome", outcome);
    body.append("reason", reason);
    startTransition(async () => {
      const res = await demobiliseAction(body);
      if (res.error) return setError(res.error);
      const r = res.result!;
      const parts = [`${row.name} demobilised`];
      if (r.allocationsCleared) parts.push(`${r.allocationsCleared} demand allocation(s) reopened`);
      if (r.bedsReleased) parts.push(`${r.bedsReleased} bed(s) freed`);
      setDone(true);
      setTimeout(() => {
        onDone(`${parts.join(", ")}.`);
        onClose();
      }, 900);
    });
  }

  return (
    <div className="mt-4 space-y-4">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Came off site on</span>
        <DatePicker value={date} onChange={(v) => setDate(v)} className="w-full" />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Then</span>
        <Select
          value={outcome}
          onChange={(v) => setOutcome(v as "BENCH" | "OFF_BOOKS")}
          searchable={false}
          options={[
            { value: "BENCH", label: "Back to the bench" },
            { value: "OFF_BOOKS", label: "Off the books" },
          ]}
        />
        <span className="mt-1 block text-xs text-subtle">
          {outcome === "BENCH" ? "Comes off the job and back onto the bench. Their bed is kept." : "Comes off the job and off the roster: marked inactive and their bed is freed."}
        </span>
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Reason {outcome === "OFF_BOOKS" && <span className="text-subtle">(kept on the record)</span>}</span>
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Project completed, visa expired, absconded…" className="input w-full" />
      </label>
      {error && <p role="alert" className="text-sm text-[var(--error)]">{error}</p>}
      <DialogFooter>
        <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
        <Button onClick={submit} disabled={!date} loading={pending} success={done} successLabel="Demobilised">Demobilise</Button>
      </DialogFooter>
    </div>
  );
}
