"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogIn } from "lucide-react";
import { Checkbox } from "@/components/ui/Checkbox";
import { Select } from "@/components/ui/Select";
import { SegmentedControl } from "@/components/ui/RadioGroup";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/ui/Button";
import { EmployeeAvatar } from "@/components/Avatar";
import { Nationality } from "@/components/Nationality";
import { cn } from "@/lib/cn";
import { createCheckInAction, switchCampAction, switchToExternalCampAction } from "../checkin-actions";
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
};

type CampType = "OWN" | "SUPPLIER" | "CLIENT";
const KIND_LABEL: Record<string, string> = { OWN: "Own camp", SUPPLIER: "Supplier camp", CLIENT: "Client camp" };

type CampOption = {
  id: string;
  name: string;
  ownerType: string;
  supplierName: string | null;
  roomCount: number;
  vacantBeds: number;
  totalBeds: number;
};

type Filter = "all" | "not_checked_in" | "awaiting_bed";

function campLabel(c: CampOption) {
  const type = c.ownerType === "SUPPLIER" ? `Supplier${c.supplierName ? ` — ${c.supplierName}` : ""}` : "Own";
  return `${c.name} (${type}) — ${c.roomCount} rooms, ${c.vacantBeds}/${c.totalBeds} beds vacant`;
}

export function CheckInTable({ rows, camps, suppliers, clients }: { rows: EmployeeRow[]; camps: CampOption[]; suppliers: Party[]; clients: Party[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [switchRow, setSwitchRow] = useState<EmployeeRow | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const counts = {
    all: rows.length,
    not_checked_in: rows.filter((r) => !r.checkInId).length,
    awaiting_bed: rows.filter((r) => !!r.checkInId && r.campKind === "OWN").length,
  };
  const visible =
    filter === "all" ? rows : rows.filter((r) => (filter === "not_checked_in" ? !r.checkInId : !!r.checkInId && r.campKind === "OWN"));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["all", `All (${counts.all})`],
              ["not_checked_in", `Not checked in (${counts.not_checked_in})`],
              ["awaiting_bed", `Awaiting bed allocation (${counts.awaiting_bed})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={cn(
                "rounded-control border px-3 py-1.5 text-xs font-medium transition",
                filter === key
                  ? "border-[var(--brand-primary)] bg-brand-soft text-[var(--brand-primary)]"
                  : "border-default bg-surface text-secondary hover:bg-surface-hover"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <Button
          variant="primary"
          onClick={() => setCheckInOpen(true)}
          disabled={selected.size === 0}
        >
          <LogIn className="h-3.5 w-3.5" />
          Check In Selected ({selected.size})
        </Button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[64rem] text-sm">
            <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium tracking-wide text-muted uppercase">
              <tr>
                <th className="w-10 px-4 py-3" />
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
                <tr key={r.id} className="hover:bg-surface-hover">
                  <td className="px-4 py-3">
                    <label
                      className={r.checkInId ? "cursor-not-allowed opacity-30" : "cursor-pointer"}
                      onClick={(e) => {
                        e.preventDefault();
                        if (!r.checkInId) toggle(r.id);
                      }}
                    >
                      <Checkbox checked={selected.has(r.id)} disabled={!!r.checkInId} />
                    </label>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
<EmployeeAvatar employeeId={r.id} name={r.name} hasPhoto={r.hasPhoto} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-primary">{r.name}</p>
                        <p className="truncate text-xs text-subtle">{r.employeeIdNo}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-secondary"><Nationality name={r.nationality} /></td>
                  <td className="px-4 py-3 text-secondary">
                    {r.supplierName ? (
                      <>
                        {r.supplierName}
                        {r.supplierCode && (
                          <span className="tabular ml-1.5 text-xs text-subtle">{r.supplierCode}</span>
                        )}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-secondary">
                    {r.projectName ? (
                      <>
                        {r.projectName}
                        {r.projectCode && (
                          <span className="tabular ml-1.5 text-xs text-subtle">{r.projectCode}</span>
                        )}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.checkInId ? (
                      r.campKind === "OWN" ? (
                        <Badge color="amber" dot>
                          Checked in — {r.campName}
                        </Badge>
                      ) : (
                        <Badge color="blue" dot>
                          {KIND_LABEL[r.campKind ?? ""] ?? "Camp"} — {r.campName}
                        </Badge>
                      )
                    ) : (
                      <Badge color="slate">Not checked in</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.checkInId && (
                      <button
                        type="button"
                        onClick={() => setSwitchRow(r)}
                        className="text-xs font-medium text-blue-600 hover:underline"
                      >
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
            {rows.length === 0 ? "Every registered employee already has a bed." : "Nothing matches this filter."}
          </p>
        )}
      </div>

      <CheckInModal
        open={checkInOpen}
        employeeIds={[...selected]}
        employees={rows.filter((r) => selected.has(r.id))}
        camps={camps}
        suppliers={suppliers}
        clients={clients}
        onDone={() => {
          setSelected(new Set());
          setCheckInOpen(false);
        }}
        onClose={() => setCheckInOpen(false)}
      />

      <SwitchCampModal row={switchRow} camps={camps.filter((c) => c.id !== switchRow?.campId)} suppliers={suppliers} clients={clients} onClose={() => setSwitchRow(null)} />
    </div>
  );
}

function CheckInModal({
  open,
  employeeIds,
  employees,
  camps,
  suppliers,
  clients,
  onDone,
  onClose,
}: {
  open: boolean;
  employeeIds: string[];
  employees: EmployeeRow[];
  camps: CampOption[];
  suppliers: Party[];
  clients: Party[];
  onDone: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog modal={false} open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title={`Check In ${employeeIds.length} Employee${employeeIds.length === 1 ? "" : "s"}`}
        description="Choose whose camp they are staying in. Own camps continue to Bed Allocation; supplier and client camps are recorded here."
      >
        <CheckInForm employeeIds={employeeIds} employees={employees} camps={camps} suppliers={suppliers} clients={clients} onDone={onDone} />
      </DialogContent>
    </Dialog>
  );
}

function CheckInForm({
  employeeIds,
  employees,
  camps,
  suppliers,
  clients,
  onDone,
}: {
  employeeIds: string[];
  employees: EmployeeRow[];
  camps: CampOption[];
  suppliers: Party[];
  clients: Party[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [campType, setCampType] = useState<CampType>("OWN");
  const [campId, setCampId] = useState("");
  // Start with the supplier / client the selected workers all share, if they do.
  const common = (pick: (e: EmployeeRow) => string | null) => {
    const ids = new Set(employees.map(pick));
    return ids.size === 1 ? ([...ids][0] ?? "") : "";
  };
  const [supplierId, setSupplierId] = useState(() => common((e) => e.supplierId));
  const [clientId, setClientId] = useState(() => common((e) => e.clientId));
  const [campValue, setCampValue] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const partyId = campType === "SUPPLIER" ? supplierId : clientId;
  const canSubmit =
    employeeIds.length > 0 && (campType === "OWN" ? !!campId : !!partyId && campValue.trim() !== "");

  function handleSubmit() {
    if (!canSubmit) return;
    setError(null);
    const formData = new FormData();
    formData.append("campType", campType);
    if (campType === "OWN") formData.append("campId", campId);
    else {
      formData.append("partyId", partyId);
      formData.append("campName", campValue.trim());
    }
    for (const id of employeeIds) formData.append("employeeId", id);
    startTransition(async () => {
      const result = await createCheckInAction(formData);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      // Direct navigation, not window.open: a popup opened after an awaited server action is
      // routinely blocked once the browser's user-activation window has expired. Same-tab
      // navigation to a download isn't, and Content-Disposition makes it download, not navigate.
      window.location.href = `/api/checkins/pdf?ids=${result.ids.join(",")}`;
      router.refresh();
      onDone();
    });
  }

  const label = "mb-1 block text-xs font-medium text-muted";
  return (
    <div className="mt-4 space-y-4">
      <div>
        <span className={label}>Camp type</span>
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
        <div>
          <span className={label}>Camp</span>
          {camps.length === 0 ? (
            <p className="text-sm text-muted">No own camps set up yet — add one under Camps first.</p>
          ) : (
            <Select value={campId} onChange={setCampId} placeholder="Select a camp" options={camps.map((c) => ({ value: c.id, label: campLabel(c) }))} />
          )}
          <p className="mt-1.5 text-xs text-muted">A bed isn&apos;t picked yet — that&apos;s the next step, Bed Allocation.</p>
        </div>
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

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <DialogFooter>
        <button type="button" onClick={handleSubmit} disabled={!canSubmit || pending} className="btn btn-primary">
          {pending ? "Checking in…" : "Check In"}
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
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
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
