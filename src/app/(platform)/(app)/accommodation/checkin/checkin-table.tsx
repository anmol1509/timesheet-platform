"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, LogIn, Search, TriangleAlert } from "lucide-react";
import { Checkbox } from "@/components/ui/Checkbox";
import { Select } from "@/components/ui/Select";
import { SegmentedControl } from "@/components/ui/RadioGroup";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";
import { Badge } from "@/components/Badge";
import { EmployeeAvatar } from "@/components/Avatar";
import { Nationality } from "@/components/Nationality";
import { cn } from "@/lib/cn";
import { checkInAndAssignAction, createCheckInAction, switchCampAction, switchToExternalCampAction, type CheckInAndAssignResult } from "../checkin-actions";
import { ExternalCampFields, type Party } from "../external-camp-fields";
import { DatePicker } from "@/components/ui/DatePicker";

type EmployeeRow = {
  id: string;
  name: string;
  employeeIdNo: string;
  hasPhoto: boolean;
  nationality: string | null;
  supplierName: string | null;
  supplierCode: string | null;
  projectCode: string | null;
  projectName: string | null;
  checkInId: string | null;
  campName: string | null;
  campId: string | null;
  supplierId: string | null;
  clientId: string | null;
  clientName: string | null;
  /** OWN, SUPPLIER or CLIENT for a worker who is already checked in. */
  campKind: string | null;
  visaStatus: "expired" | "expiring" | "valid" | "not_set";
};

type CampType = "OWN" | "SUPPLIER" | "CLIENT";
const KIND_LABEL: Record<string, string> = { OWN: "Own camp", SUPPLIER: "Supplier camp", CLIENT: "Client camp" };

type VacantBed = { id: string; room: string; label: string };
type CampOption = {
  id: string;
  name: string;
  ownerType: string;
  supplierName: string | null;
  roomCount: number;
  vacantBeds: number;
  totalBeds: number;
  /** Vacant beds in the order a check-in fills them. */
  vacant: VacantBed[];
};

type Filter = "all" | "not_checked_in" | "checked_in" | "awaiting_bed";

function campLabel(c: CampOption) {
  const type = c.ownerType === "SUPPLIER" ? `Supplier${c.supplierName ? `: ${c.supplierName}` : ""}` : "Own";
  return `${c.name} (${type}): ${c.roomCount} rooms, ${c.vacantBeds}/${c.totalBeds} beds vacant`;
}

const ALL = "";
const uniq = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => !!x))].sort();

export function CheckInTable({ rows, camps, suppliers, clients }: { rows: EmployeeRow[]; camps: CampOption[]; suppliers: Party[]; clients: Party[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  // The date printed on a check-in document when it is downloaded (YYYY-MM-DD); blank means today.
  const [letterDate, setLetterDate] = useState("");
  const pdfHref = (ids: string) => `/api/checkins/pdf?ids=${ids}${letterDate ? `&letterDate=${letterDate}` : ""}`;
  const [query, setQuery] = useState("");
  const [project, setProject] = useState(ALL);
  const [supplier, setSupplier] = useState(ALL);
  const [nationality, setNationality] = useState(ALL);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [checkInOpen, setCheckInOpen] = useState(false);
  // The batch is fixed when the dialog opens, so the dialog keeps its workers after the list refreshes.
  const [batch, setBatch] = useState<EmployeeRow[]>([]);
  const [switchRow, setSwitchRow] = useState<EmployeeRow | null>(null);

  const counts = {
    all: rows.length,
    not_checked_in: rows.filter((r) => !r.checkInId).length,
    checked_in: rows.filter((r) => !!r.checkInId).length,
    awaiting_bed: rows.filter((r) => !!r.checkInId && r.campKind === "OWN").length,
  };
  const q = query.trim().toLowerCase();
  const visible = rows.filter(
    (r) =>
      (filter === "all" || (filter === "not_checked_in" ? !r.checkInId : filter === "checked_in" ? !!r.checkInId : !!r.checkInId && r.campKind === "OWN")) &&
      (!project || r.projectName === project) &&
      (!supplier || r.supplierName === supplier) &&
      (!nationality || r.nationality === nationality) &&
      (!q || `${r.name} ${r.employeeIdNo} ${r.supplierName ?? ""} ${r.projectName ?? ""} ${r.nationality ?? ""}`.toLowerCase().includes(q))
  );
  const selectable = visible.filter((r) => !r.checkInId);
  const allSelected = selectable.length > 0 && selectable.every((r) => selected.has(r.id));
  // Workers go in, and get beds, in the order they are listed.
  const chosen = rows.filter((r) => selected.has(r.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) for (const r of selectable) next.delete(r.id);
      else for (const r of selectable) next.add(r.id);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[16rem] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, ID, supplier, project…" aria-label="Search workers" className="input w-full pl-9" />
        </label>
        <div className="w-44"><Select value={project} onChange={setProject} placeholder="Project" options={[{ value: ALL, label: "All projects" }, ...uniq(rows.map((r) => r.projectName)).map((v) => ({ value: v, label: v }))]} /></div>
        <div className="w-44"><Select value={supplier} onChange={setSupplier} placeholder="Supplier" options={[{ value: ALL, label: "All suppliers" }, ...uniq(rows.map((r) => r.supplierName)).map((v) => ({ value: v, label: v }))]} /></div>
        <div className="w-40"><Select value={nationality} onChange={setNationality} placeholder="Nationality" options={[{ value: ALL, label: "All nationalities" }, ...uniq(rows.map((r) => r.nationality)).map((v) => ({ value: v, label: v }))]} /></div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ["all", `All (${counts.all})`],
            ["not_checked_in", `Not checked in (${counts.not_checked_in})`],
            ["checked_in", `Check-in done (${counts.checked_in})`],
            ["awaiting_bed", `Waiting for a bed (${counts.awaiting_bed})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={cn(
              "rounded-control border px-3 py-1.5 text-xs font-medium transition",
              filter === key ? "border-[var(--brand-primary)] bg-brand-soft text-[var(--brand-primary)]" : "border-default bg-surface text-secondary hover:bg-surface-hover"
            )}
          >
            {label}
          </button>
        ))}
        {filter === "checked_in" && visible.length > 0 && new Set(visible.map((r) => r.campId)).size === 1 && (
          <span className="ml-auto flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted">Document date</span>
            <DatePicker value={letterDate} onChange={setLetterDate} ariaLabel="Document date (blank = today)" className="w-40" />
            <a href={pdfHref(visible.map((r) => r.checkInId).join(","))} className="text-xs font-medium text-[var(--brand-primary)] hover:underline">Download the check-in document for these {visible.length}</a>
          </span>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[64rem] text-sm">
            <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium tracking-wide text-muted uppercase">
              <tr>
                <th className="w-10 px-4 py-3">
                  <label className={selectable.length === 0 ? "cursor-not-allowed opacity-30" : "cursor-pointer"} onClick={(e) => { e.preventDefault(); if (selectable.length > 0) toggleAll(); }}>
                    <Checkbox checked={allSelected} indeterminate={!allSelected && selectable.some((r) => selected.has(r.id))} disabled={selectable.length === 0} ariaLabel="Select all workers shown" />
                  </label>
                </th>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Nationality</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {visible.map((r) => (
                <tr key={r.id} className={cn("hover:bg-surface-hover", selected.has(r.id) && "bg-brand-soft")}>
                  <td className="px-4 py-3">
                    <label
                      className={r.checkInId ? "cursor-not-allowed opacity-30" : "cursor-pointer"}
                      onClick={(e) => {
                        e.preventDefault();
                        if (!r.checkInId) toggle(r.id);
                      }}
                    >
                      <Checkbox checked={selected.has(r.id)} disabled={!!r.checkInId} ariaLabel={`Select ${r.name}`} />
                    </label>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <EmployeeAvatar employeeId={r.id} name={r.name} hasPhoto={r.hasPhoto} size="sm" />
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 truncate font-medium text-primary">
                          {r.name}
                          {r.visaStatus === "expired" && <Badge color="red">Visa expired</Badge>}
                        </p>
                        <p className="truncate text-xs text-subtle">{r.employeeIdNo}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-secondary"><Nationality name={r.nationality} /></td>
                  <td className="px-4 py-3 text-secondary">
                    {r.supplierName ? (
                      <>
                        {r.supplierName}
                        {r.supplierCode && <span className="tabular ml-1.5 text-xs text-subtle">{r.supplierCode}</span>}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-secondary">
                    {r.projectName ? (
                      <>
                        {r.projectName}
                        {r.projectCode && <span className="tabular ml-1.5 text-xs text-subtle">{r.projectCode}</span>}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.checkInId ? (
                      r.campKind === "OWN" ? (
                        <Badge color="amber" dot>Checked in: {r.campName}</Badge>
                      ) : (
                        <Badge color="blue" dot>{KIND_LABEL[r.campKind ?? ""] ?? "Camp"}: {r.campName}</Badge>
                      )
                    ) : (
                      <Badge color="slate">Not checked in</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.checkInId && (
                      <a href={pdfHref(r.checkInId)} className="mr-3 text-xs font-medium text-[var(--brand-primary)] hover:underline" title="Download this worker's check-in document again">Download</a>
                    )}
                    {r.checkInId && (
                      <button type="button" onClick={() => setSwitchRow(r)} className="text-xs font-medium text-[var(--brand-primary)] hover:underline">
                        Switch Camp
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {visible.length === 0 && (
          <p className="empty-state px-4 py-10 text-center text-sm text-muted">
            {rows.length === 0 ? "Every registered employee already has a bed." : "Nothing matches these filters."}
          </p>
        )}
      </div>

      {selected.size > 0 && (
        <div className="sticky bottom-4 z-20 flex justify-center">
          <div className="flex items-center gap-3 rounded-2xl bg-[#1e1b3a] py-2.5 pr-2.5 pl-4 text-sm text-white shadow-modal">
            <span><b>{selected.size} selected</b><span className="ml-2 hidden text-white/70 sm:inline">{chosen.slice(0, 3).map((r) => r.name.split(" ")[0]).join(", ")}{chosen.length > 3 ? ` +${chosen.length - 3}` : ""}</span></span>
            <button type="button" onClick={() => setSelected(new Set())} className="rounded-lg border border-white/30 px-3 py-1.5 text-xs font-medium hover:bg-white/10">Clear</button>
            <button type="button" onClick={() => { setBatch(chosen); setCheckInOpen(true); }} className="btn btn-primary gap-1.5"><LogIn className="h-3.5 w-3.5" aria-hidden />Check in {selected.size}</button>
          </div>
        </div>
      )}

      <CheckInModal
        open={checkInOpen}
        employees={batch}
        camps={camps}
        suppliers={suppliers}
        clients={clients}
        onChecked={() => setSelected(new Set())}
        onDone={() => setCheckInOpen(false)}
        onClose={() => setCheckInOpen(false)}
      />

      <SwitchCampModal row={switchRow} camps={camps.filter((c) => c.id !== switchRow?.campId)} suppliers={suppliers} clients={clients} onClose={() => setSwitchRow(null)} />
    </div>
  );
}

function CheckInModal({ open, employees, camps, suppliers, clients, onChecked, onDone, onClose }: { open: boolean; employees: EmployeeRow[]; camps: CampOption[]; suppliers: Party[]; clients: Party[]; onChecked: () => void; onDone: () => void; onClose: () => void }) {
  return (
    <Dialog modal={false} open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title={`Check in ${employees.length} worker${employees.length === 1 ? "" : "s"}`}
        description={employees.slice(0, 4).map((e) => e.name).join(", ") + (employees.length > 4 ? ` and ${employees.length - 4} more` : "")}
        className="max-w-xl"
      >
        <CheckInForm employees={employees} camps={camps} suppliers={suppliers} clients={clients} onChecked={onChecked} onDone={onDone} />
      </DialogContent>
    </Dialog>
  );
}

const today = () => new Date().toLocaleDateString("en-CA");

function CheckInForm({ employees, camps, suppliers, clients, onChecked, onDone }: { employees: EmployeeRow[]; camps: CampOption[]; suppliers: Party[]; clients: Party[]; onChecked: () => void; onDone: () => void }) {
  const router = useRouter();
  const [campType, setCampType] = useState<CampType>("OWN");
  const [campId, setCampId] = useState(() => (camps.length === 1 ? camps[0].id : ""));
  // Start with the supplier / client the selected workers all share, if they do.
  const common = (pick: (e: EmployeeRow) => string | null) => {
    const ids = new Set(employees.map(pick));
    return ids.size === 1 ? ([...ids][0] ?? "") : "";
  };
  const [supplierId, setSupplierId] = useState(() => common((e) => e.supplierId));
  const [clientId, setClientId] = useState(() => common((e) => e.clientId));
  const [campValue, setCampValue] = useState("");
  const [assignNow, setAssignNow] = useState(true);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [date, setDate] = useState(today);
  const [slip, setSlip] = useState(true);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ ids: string[]; assigned: { employeeName: string; bedLabel: string }[]; waiting: number; campName: string; slip: boolean } | null>(null);

  const camp = camps.find((c) => c.id === campId);
  const partyId = campType === "SUPPLIER" ? supplierId : clientId;
  const canSubmit = employees.length > 0 && !!date && (campType === "OWN" ? !!campId : !!partyId && campValue.trim() !== "");
  const backdated = date !== today();
  const expired = employees.filter((e) => e.visaStatus === "expired");

  // The bed each worker will get: the one picked for them, otherwise the next vacant bed in order.
  const plan = useMemo(() => {
    if (campType !== "OWN" || !camp || !assignNow) return [] as { employee: EmployeeRow; bed: VacantBed | null }[];
    const used = new Set<string>();
    const chosen = employees.map((e) => {
      const want = picks[e.id];
      const bed = want ? camp.vacant.find((b) => b.id === want) : undefined;
      if (bed && !used.has(bed.id)) { used.add(bed.id); return bed; }
      return null;
    });
    return employees.map((employee, i) => {
      let bed = chosen[i];
      if (!bed) bed = camp.vacant.find((b) => !used.has(b.id)) ?? null;
      if (bed) used.add(bed.id);
      return { employee, bed };
    });
  }, [campType, camp, assignNow, employees, picks]);
  const short = campType === "OWN" && camp && assignNow ? Math.max(0, employees.length - camp.vacantBeds) : 0;

  function handleSubmit() {
    if (!canSubmit) return;
    setError(null);
    const formData = new FormData();
    formData.append("campType", campType);
    formData.append("checkInDate", date);
    if (campType === "OWN") formData.append("campId", campId);
    else {
      formData.append("partyId", partyId);
      formData.append("campName", campValue.trim());
    }
    for (const e of employees) formData.append("employeeId", e.id);
    if (campType === "OWN" && assignNow) {
      formData.append("assignBeds", "1");
      for (const p of plan) if (p.bed) formData.append(`bedId:${p.employee.id}`, p.bed.id);
    }
    startTransition(async () => {
      const res: CheckInAndAssignResult | { error: string } =
        campType === "OWN" ? await checkInAndAssignAction(formData) : { ...(await createCheckInAction(formData)), assigned: [], waiting: 0 };
      if ("error" in res) {
        setError(res.error);
        return;
      }
      // Direct navigation, not window.open: a popup opened after an awaited server action is
      // routinely blocked once the browser's user-activation window has expired. Same-tab
      // navigation to a download isn't, and Content-Disposition makes it download, not navigate.
      if (slip) window.location.href = `/api/checkins/pdf?ids=${res.ids.join(",")}`;
      router.refresh();
      onChecked();
      setResult({ ids: res.ids, assigned: res.assigned, waiting: res.waiting, campName: campType === "OWN" ? (camp?.name ?? "") : campValue.trim(), slip });
    });
  }

  const label = "mb-1 block text-xs font-medium text-muted";

  if (result) {
    return (
      <div className="mt-4 text-center">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--success-soft)] text-[var(--success)]"><Check className="h-6 w-6" aria-hidden /></span>
        <h3 className="mt-3 text-lg font-semibold text-primary">{result.ids.length} worker{result.ids.length === 1 ? "" : "s"} checked in</h3>
        <p className="text-sm text-muted">{result.campName}{result.assigned.length > 0 ? " · beds assigned" : ""}</p>
        {result.assigned.length > 0 && (
          <ul className="card mt-4 overflow-hidden text-left text-sm">
            {result.assigned.map((a) => (
              <li key={a.employeeName} className="flex items-center justify-between gap-3 border-b border-default px-3.5 py-2.5 last:border-b-0">
                <b className="text-primary">{a.employeeName}</b>
                <Badge color="green">{a.bedLabel}</Badge>
              </li>
            ))}
          </ul>
        )}
        {result.waiting > 0 && (
          <p className="mt-3 rounded-lg bg-[var(--warning-soft)] px-3 py-2 text-sm text-primary">{result.waiting} {result.waiting === 1 ? "worker is" : "workers are"} checked in and waiting for a bed. <Link href="/accommodation/bed-allocation" className="font-medium text-[var(--brand-primary)] hover:underline">Open Bed Allocation</Link></p>
        )}
        <p className="mt-3 text-xs text-muted">
          {result.slip ? "The check-in slip was downloaded. " : ""}
          <a href={`/api/checkins/pdf?ids=${result.ids.join(",")}`} className="font-medium text-[var(--brand-primary)] hover:underline">{result.slip ? "Download again" : "Download the check-in slip"}</a>
        </p>
        <DialogFooter>
          <Link href="/accommodation/bed-allocation" className="btn btn-secondary">Open Bed Allocation</Link>
          <button type="button" onClick={onDone} className="btn btn-primary">Done</button>
        </DialogFooter>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      <div>
        <span className={label}>Camp</span>
        <SegmentedControl
          value={campType}
          onChange={(v) => {
            setCampType(v as CampType);
            setCampValue("");
            setError(null);
          }}
          options={[
            { value: "OWN", label: "Own camp" },
            { value: "SUPPLIER", label: "Supplier camp" },
            { value: "CLIENT", label: "Client camp" },
          ]}
        />
      </div>

      {campType === "OWN" ? (
        camps.length === 0 ? (
          <p className="text-sm text-muted">No own camps set up yet. Add one under Camps first.</p>
        ) : (
          <>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {camps.map((c) => {
                const on = c.id === campId;
                const pct = c.totalBeds ? (c.vacantBeds / c.totalBeds) * 100 : 0;
                return (
                  <button key={c.id} type="button" aria-pressed={on} onClick={() => { setCampId(c.id); setPicks({}); }}
                    className={cn("rounded-[14px] border-2 p-3 text-left transition", on ? "border-[var(--brand-primary)] bg-brand-soft" : "border-default hover:bg-surface-hover")}>
                    <b className="block text-sm text-primary">{c.name}</b>
                    <span className="text-xs text-muted">{c.roomCount} rooms</span>
                    <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-surface-sunken"><span className="block h-full bg-[var(--success)]" style={{ width: `${pct}%` }} /></span>
                    <span className="mt-1 block text-xs text-secondary"><b>{c.vacantBeds}</b> of {c.totalBeds} beds vacant</span>
                  </button>
                );
              })}
            </div>

            {camp && (
              <div>
                <span className={label}>Beds</span>
                <div className="card overflow-hidden text-sm">
                  <label className={cn("flex cursor-pointer items-start gap-3 px-3.5 py-2.5", assignNow && "bg-brand-soft")}>
                    <input type="radio" name="beds" checked={assignNow} onChange={() => setAssignNow(true)} className="mt-1 accent-[var(--brand-primary)]" />
                    <span><b className="text-primary">Assign beds now</b><span className="block text-xs text-muted">Fills the next vacant beds in order, room by room. Change any of them below.</span></span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-3 border-t border-default px-3.5 py-2.5">
                    <input type="radio" name="beds" checked={!assignNow} onChange={() => setAssignNow(false)} className="accent-[var(--brand-primary)]" />
                    <span>Assign beds later <span className="text-muted">(Bed Allocation)</span></span>
                  </label>
                </div>
                {assignNow && short > 0 && (
                  <p role="status" className="mt-2 flex items-start gap-2 rounded-lg bg-[var(--warning-soft)] px-3 py-2 text-xs text-primary">
                    <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--warning)]" aria-hidden />
                    <span>Only {camp.vacantBeds} bed{camp.vacantBeds === 1 ? " is" : "s are"} vacant in {camp.name.split(/ — |: /)[0]}, so {short} of the {employees.length} will be checked in without a bed.</span>
                  </p>
                )}
                {assignNow && plan.length > 0 && (
                  <ul className="card mt-2 max-h-52 overflow-y-auto text-sm">
                    {plan.map(({ employee, bed }) => (
                      <li key={employee.id} className="flex items-center justify-between gap-3 border-b border-default px-3.5 py-2 last:border-b-0">
                        <span className="min-w-0"><b className="block truncate text-primary">{employee.name}</b><span className="block truncate text-xs text-muted">{employee.supplierName ?? "No supplier"}</span></span>
                        {bed ? (
                          <div className="w-44 shrink-0">
                            <Select
                              value={bed.id}
                              onChange={(v) => setPicks((p) => ({ ...p, [employee.id]: v }))}
                              searchable={false}
                              options={camp.vacant.filter((b) => b.id === bed.id || !plan.some((x) => x.bed?.id === b.id)).map((b) => ({ value: b.id, label: `${b.room} · ${b.label}` }))}
                            />
                          </div>
                        ) : (
                          <Badge color="amber">Waiting for a bed</Badge>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )
      ) : (
        <>
          <div>
            <span className={label}>{campType === "SUPPLIER" ? "Supplier" : "Client"}</span>
            <Select
              value={partyId}
              onChange={(v) => {
                if (campType === "SUPPLIER") setSupplierId(v);
                else setClientId(v);
                setCampValue("");
              }}
              placeholder={campType === "SUPPLIER" ? "Select the supplier" : "Select the client"}
              options={(campType === "SUPPLIER" ? suppliers : clients).map((p) => ({ value: p.id, label: p.name }))}
            />
          </div>
          <div>
            <span className={label}>Camp name / location</span>
            <input
              key={`${campType}-${partyId}`}
              value={campValue}
              onChange={(e) => setCampValue(e.target.value)}
              disabled={!partyId}
              maxLength={80}
              placeholder={partyId ? "e.g. Sonapur camp, Block 3" : "Choose the " + (campType === "SUPPLIER" ? "supplier" : "client") + " first"}
              className="input w-full"
            />
          </div>
          <p className="text-xs text-muted">Housing is arranged by the {campType === "SUPPLIER" ? "supplier" : "client"}, so no room or bed is allocated here.</p>
        </>
      )}

      {expired.length > 0 && (
        <p role="status" className="flex items-start gap-2 rounded-lg bg-[var(--warning-soft)] px-3 py-2 text-xs text-primary">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--warning)]" aria-hidden />
          <span><b>{expired.length === 1 ? "1 worker has" : `${expired.length} workers have`} an expired visa:</b> {expired.map((e) => e.name).join(", ")}. You can still check {expired.length === 1 ? "them" : "them"} in.</span>
        </p>
      )}

      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div className="w-44">
          <span className={label}>Check-in date</span>
          <DatePicker value={date} onChange={setDate} max={today()} min="2020-01-01" />
          {backdated && <span className="mt-1 block text-xs text-[var(--warning)]">Backdated: recorded as {new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })}</span>}
        </div>
        <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm">
          <Checkbox checked={slip} onCheckedChange={(c) => setSlip(!!c)} ariaLabel="Download the check-in slip" />
          Download the check-in slip (PDF)
        </label>
      </div>

      {error && <p role="alert" className="text-sm text-[var(--error)]">{error}</p>}
      <DialogFooter>
        <button type="button" onClick={handleSubmit} disabled={!canSubmit || pending} className="btn btn-primary">
          {pending ? "Checking in…" : campType === "OWN" && assignNow ? "Check in & assign beds" : "Check in"}
        </button>
      </DialogFooter>
    </div>
  );
}

function SwitchCampModal({
  row,
  camps,
  suppliers,
  clients,
  onClose,
}: {
  row: EmployeeRow | null;
  camps: CampOption[];
  suppliers: Party[];
  clients: Party[];
  onClose: () => void;
}) {
  return (
    <Dialog modal={false} open={row !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title={`Switch Camp for ${row?.name ?? ""}`}
        description={`Currently checked into ${row?.campName ?? ""}. Pick a different camp.`}
      >
        {row && <SwitchCampForm key={row.id} row={row} camps={camps} suppliers={suppliers} clients={clients} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function SwitchCampForm({ row, camps, suppliers, clients, onClose }: { row: EmployeeRow; camps: CampOption[]; suppliers: Party[]; clients: Party[]; onClose: () => void }) {
  const [campType, setCampType] = useState<CampType>("OWN");
  const [campId, setCampId] = useState("");
  const [partyId, setPartyId] = useState("");
  const [campName, setCampName] = useState("");
  const [checkInDate, setCheckInDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const external = campType !== "OWN";
  const knownPartyId = campType === "SUPPLIER" ? row.supplierId : row.clientId;
  const effectivePartyId = knownPartyId ?? partyId;

  function submit() {
    const formData = new FormData();
    formData.append("checkInId", row.checkInId!);
    startTransition(async () => {
      if (external) {
        formData.append("campType", campType);
        formData.append("partyId", effectivePartyId);
        formData.append("campName", campName.trim());
        formData.append("checkInDate", checkInDate);
        const res = await switchToExternalCampAction(formData);
        if (res.error) {
          setError(res.error);
          return;
        }
      } else {
        formData.append("campId", campId);
        await switchCampAction(formData);
      }
      onClose();
    });
  }

  return (
    <div className="mt-4 space-y-4">
      <div>
        <span className="mb-1 block text-xs font-medium text-muted">Camp type</span>
        <SegmentedControl
          value={campType}
          onChange={(v) => {
            setCampType(v as CampType);
            setError(null);
          }}
          options={[
            { value: "OWN", label: "Own camp" },
            { value: "SUPPLIER", label: "Supplier camp" },
            { value: "CLIENT", label: "Client camp" },
          ]}
        />
      </div>
      {external ? (
        <ExternalCampFields
          kind={campType as "SUPPLIER" | "CLIENT"}
          knownPartyId={knownPartyId}
          knownPartyName={campType === "SUPPLIER" ? row.supplierName : row.clientName}
          parties={campType === "SUPPLIER" ? suppliers : clients}
          partyId={partyId}
          onParty={setPartyId}
          campName={campName}
          onCampName={setCampName}
        />
      ) : camps.length === 0 ? (
        <p className="text-sm text-muted">No other camps to switch to.</p>
      ) : (
        <Select value={campId} onChange={setCampId} placeholder="Select a camp" options={camps.map((c) => ({ value: c.id, label: campLabel(c) }))} />
      )}
      {external && (
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Check-in date</span>
          <DatePicker value={checkInDate} onChange={setCheckInDate} className="w-full" />
        </label>
      )}
      {error && <p role="alert" className="text-sm text-[var(--error)]">{error}</p>}
      <DialogFooter>
        <button type="button" onClick={onClose} className="btn btn-secondary">
          Cancel
        </button>
        <button type="button" disabled={(external ? !effectivePartyId || campName.trim() === "" : !campId) || pending} onClick={submit} className="btn btn-primary">
          {pending ? "Switching…" : "Switch"}
        </button>
      </DialogFooter>
    </div>
  );
}
