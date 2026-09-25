"use client";

import { Select } from "@/components/ui/Select";

export type Party = { id: string; name: string };

/**
 * The fields for a supplier's or a client's camp: only the camp name / location. Whose camp it is comes from
 * the worker's own record (their supplier, or their project's client), so it is shown, not asked; if the worker
 * has none, a dropdown lets the user pick.
 */
export function ExternalCampFields({
  kind,
  knownPartyId,
  knownPartyName,
  parties,
  partyId,
  onParty,
  campName,
  onCampName,
}: {
  kind: "SUPPLIER" | "CLIENT";
  knownPartyId: string | null;
  knownPartyName: string | null;
  parties: Party[];
  partyId: string;
  onParty: (id: string) => void;
  campName: string;
  onCampName: (v: string) => void;
}) {
  const label = kind === "SUPPLIER" ? "supplier" : "client";
  return (
    <div className="space-y-4">
      {knownPartyId && knownPartyName ? (
        <p className="text-sm text-secondary">
          {kind === "SUPPLIER" ? "Supplier" : "Client"}: <span className="font-medium text-primary">{knownPartyName}</span>
        </p>
      ) : (
        <div>
          <span className="mb-1 block text-xs font-medium text-muted">{kind === "SUPPLIER" ? "Supplier" : "Client"}</span>
          <Select value={partyId} onChange={onParty} placeholder={`Select the ${label}`} options={parties.map((p) => ({ value: p.id, label: p.name }))} />
        </div>
      )}
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Camp name / location</span>
        <input value={campName} onChange={(e) => onCampName(e.target.value)} maxLength={80} placeholder="e.g. Sonapur camp, Block 3" className="input w-full" autoFocus />
      </label>
      <p className="text-xs text-muted">Housing is arranged by the {label}, so no room or bed is allocated here. Any bed the worker has now is freed.</p>
    </div>
  );
}
