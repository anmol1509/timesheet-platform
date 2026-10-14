"use client";

import { useState, useTransition } from "react";
import { BedDouble, Building2 } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/ui/Button";
import { EmployeeAvatar } from "@/components/Avatar";
import { cn } from "@/lib/cn";
import { allocateBedAction, switchToExternalCampAction } from "../checkin-actions";
import { ExternalCampFields, type Party } from "../external-camp-fields";
import { SegmentedControl } from "@/components/ui/RadioGroup";
import { DatePicker } from "@/components/ui/DatePicker";

type BedOption = { id: string; label: string; employeeId: string | null };
type RoomOption = { id: string; name: string; beds: BedOption[] };
type CampChoice = { id: string; name: string; rooms: RoomOption[] };
type Row = {
  checkInId: string;
  checkInNo: number;
  employeeName: string;
  employeeIdNo: string;
  employeeRecordId: string;
  employeeHasPhoto: boolean;
  nationality: string | null;
  supplierId: string | null;
  supplierName: string | null;
  clientId: string | null;
  clientName: string | null;
  campId: string;
  campName: string;
  roomName: string | null;
  bedLabel: string | null;
  bedId: string | null;
  checkInDate: string;
};

type Filter = "all" | "awaiting" | "allocated";

export function BedAllocationTable({ rows, camps, suppliers, clients }: { rows: Row[]; camps: CampChoice[]; suppliers: Party[]; clients: Party[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [activeRow, setActiveRow] = useState<Row | null>(null);

  const counts = {
    all: rows.length,
    awaiting: rows.filter((r) => !r.bedId).length,
    allocated: rows.filter((r) => r.bedId).length,
  };
  const visible =
    filter === "all" ? rows : rows.filter((r) => (filter === "awaiting" ? !r.bedId : !!r.bedId));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ["all", `All (${counts.all})`],
            ["awaiting", `Awaiting allocation (${counts.awaiting})`],
            ["allocated", `Bed allocated (${counts.allocated})`],
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

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {visible.map((r) => (
          <div
            key={r.checkInId}
            className={cn(
              "card flex items-center gap-3 p-4 transition",
              !r.bedId && "border-[var(--warning-border)] bg-[var(--warning-soft)]/30"
            )}
          >
<EmployeeAvatar employeeId={r.employeeRecordId} name={r.employeeName} hasPhoto={r.employeeHasPhoto} size="lg" />

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="truncate text-sm font-semibold text-primary">{r.employeeName}</p>
                <span className="tabular shrink-0 text-[10px] text-subtle">
                  CHK-{String(r.checkInNo).padStart(5, "0")}
                </span>
              </div>
              <p className="truncate text-xs text-subtle">
                {r.employeeIdNo}
                {r.nationality ? ` · ${r.nationality}` : ""}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 text-xs text-secondary">
                  <Building2 className="h-3 w-3 text-subtle" /> {r.campName}
                </span>
                {r.bedId ? (
                  <Badge color="green" dot>
                    {r.roomName} · {r.bedLabel}
                  </Badge>
                ) : (
                  <Badge color="amber" dot>
                    Not allocated
                  </Badge>
                )}
              </div>
            </div>

            <Button
              variant={r.bedId ? "secondary" : "primary"}
              size="sm"
              onClick={() => setActiveRow(r)}
              className="shrink-0"
            >
              <BedDouble className="h-3.5 w-3.5" />
              {r.bedId ? "Switch Camp / Room" : "Allocate Bed"}
            </Button>
          </div>
        ))}
      </div>

      {visible.length === 0 && (
        <p className="empty-state py-10 text-center text-sm text-muted">
          {rows.length === 0
            ? "No one is checked into a camp right now — start under Create Check-In."
            : "Nothing matches this filter."}
        </p>
      )}

      <AllocateModal row={activeRow} camps={camps} suppliers={suppliers} clients={clients} onClose={() => setActiveRow(null)} />
    </div>
  );
}

function AllocateModal({ row, camps, suppliers, clients, onClose }: { row: Row | null; camps: CampChoice[]; suppliers: Party[]; clients: Party[]; onClose: () => void }) {
  return (
    <Dialog modal={false} open={row !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title={row?.bedId ? `Switch Camp / Room for ${row?.employeeName ?? ""}` : `Allocate Bed for ${row?.employeeName ?? ""}`}
        description={`Currently in ${row?.campName ?? ""}. Pick a camp, then a room and a vacant bed, and the check-in date.`}
      >
        {row && <AllocateForm key={row.checkInId} row={row} camps={camps} suppliers={suppliers} clients={clients} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function AllocateForm({ row, camps, suppliers, clients, onClose }: { row: Row; camps: CampChoice[]; suppliers: Party[]; clients: Party[]; onClose: () => void }) {
  const [campType, setCampType] = useState<"OWN" | "SUPPLIER" | "CLIENT">("OWN");
  const [partyId, setPartyId] = useState("");
  const [campName, setCampName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const external = campType !== "OWN";
  const knownPartyId = campType === "SUPPLIER" ? row.supplierId : row.clientId;
  const effectivePartyId = knownPartyId ?? partyId;
  const [campId, setCampId] = useState(row.campId);
  const camp = camps.find((c) => c.id === campId) ?? null;
  const [roomId, setRoomId] = useState(camps.find((c) => c.id === row.campId)?.rooms.find((r) => r.beds.some((b) => b.id === row.bedId))?.id ?? "");
  const [bedId, setBedId] = useState(row.bedId ?? "");
  const [checkInDate, setCheckInDate] = useState(row.checkInDate);
  const [pending, startTransition] = useTransition();

  // A bed is free if nobody is in it, or if it is this worker's own current bed.
  const isVacant = (b: BedOption) => !b.employeeId || b.id === row.bedId;
  const rooms = camp?.rooms ?? [];
  const room = rooms.find((r) => r.id === roomId) ?? null;
  const bedsInRoom = room ? room.beds.filter(isVacant) : [];

  return (
    <div className="mt-4 space-y-4">
      <div>
        <span className="mb-1 block text-xs font-medium text-muted">Camp type</span>
        <SegmentedControl
          value={campType}
          onChange={(v) => {
            setCampType(v as "OWN" | "SUPPLIER" | "CLIENT");
            setError(null);
          }}
          options={[
            { value: "OWN", label: "Own camp" },
            { value: "SUPPLIER", label: "Supplier camp" },
            { value: "CLIENT", label: "Client camp" },
          ]}
        />
      </div>

      {external && (
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
      )}

      {!external && (<>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Camp</span>
        <Select
          value={campId}
          onChange={(v) => {
            setCampId(v);
            setRoomId("");
            setBedId("");
          }}
          placeholder="Select a camp"
          options={camps.map((c) => {
            const beds = c.rooms.flatMap((r) => r.beds);
            return { value: c.id, label: `${c.name} (${beds.filter(isVacant).length}/${beds.length} beds vacant)` };
          })}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Room</span>
        <Select
          value={roomId}
          onChange={(v) => {
            setRoomId(v);
            setBedId("");
          }}
          disabled={!campId}
          placeholder={campId ? "Select a room" : "Select a camp first"}
          options={rooms.map((r) => ({
            value: r.id,
            label: `${r.name} (${r.beds.filter(isVacant).length}/${r.beds.length} vacant)`,
          }))}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Bed</span>
        <Select
          value={bedId}
          onChange={setBedId}
          disabled={!roomId}
          placeholder={roomId ? "Select a vacant bed" : "Select a room first"}
          options={bedsInRoom.map((b) => ({ value: b.id, label: b.label }))}
        />
      </label>
      </>)}
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Check-in date</span>
        <DatePicker value={checkInDate} onChange={(v) => setCheckInDate(v)} className="w-full" />
      </label>
      {error && <p role="alert" className="text-sm text-[var(--error)]">{error}</p>}
      <DialogFooter>
        <button type="button" onClick={onClose} className="btn btn-secondary">
          Cancel
        </button>
        <button
          type="button"
          disabled={(external ? !effectivePartyId || campName.trim() === "" : !bedId) || pending}
          onClick={() => {
            const formData = new FormData();
            formData.append("checkInId", row.checkInId);
            if (external) {
              formData.append("campType", campType);
              formData.append("partyId", effectivePartyId);
              formData.append("campName", campName.trim());
              formData.append("checkInDate", checkInDate);
              startTransition(async () => {
                const res = await switchToExternalCampAction(formData);
                if (res.error) setError(res.error);
                else onClose();
              });
              return;
            }
            formData.append("bedId", bedId);
            formData.append("checkInDate", checkInDate);
            startTransition(async () => {
              await allocateBedAction(formData);
              onClose();
            });
          }}
          className="btn btn-primary"
        >
          {pending ? "Saving…" : row.bedId || external ? "Switch" : "Allocate"}
        </button>
      </DialogFooter>
    </div>
  );
}
