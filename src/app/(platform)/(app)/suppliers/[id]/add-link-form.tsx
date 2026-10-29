"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/Select";
import { EMPTY_PERSON, PersonPicker, type PersonOption, type PickerChoice } from "@/components/PersonPicker";
import { addPartyLinkAction } from "./party-actions";

import { Button } from "@/components/ui/Button";
const ROLES = [
  { value: "SPONSOR", label: "Sponsor" },
  { value: "MANAGER", label: "Manager" },
  { value: "PARTNER", label: "Partner" },
];

/** Adds a sponsor, manager or partner: someone already on file for another company, or a new person. */
export function AddLinkForm({ supplierId, people, linked }: { supplierId: string; people: PersonOption[]; /** "partyId:role" pairs this company already has. */ linked: string[] }) {
  const router = useRouter();
  const [role, setRole] = useState("SPONSOR");
  const [choice, setChoice] = useState<PickerChoice>({ kind: "none" });
  const [person, setPerson] = useState(EMPTY_PERSON);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const hide = linked.filter((l) => l.endsWith(`:${role}`)).map((l) => l.split(":")[0]);

  function add() {
    setError(null);
    if (choice.kind === "none") return setError("Choose a person, or add a new one.");
    start(async () => {
      const res = await addPartyLinkAction({ supplierId, role, partyId: choice.kind === "existing" ? choice.partyId : undefined, person: choice.kind === "new" ? person : undefined });
      if (res.error) return setError(res.error);
      setChoice({ kind: "none" });
      setPerson(EMPTY_PERSON);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-2xl border border-dashed border-strong p-4">
      <p className="text-sm font-medium text-primary">Add a sponsor, manager or partner</p>
      <div className="grid grid-cols-1 items-start gap-2 sm:grid-cols-[9rem_1fr_auto]">
        <Select value={role} onChange={(r) => { setRole(r); setChoice({ kind: "none" }); }} searchable={false} options={ROLES} />
        <PersonPicker options={people} choice={choice} onChoice={setChoice} person={person} onPerson={setPerson} hideIds={hide} />
        <Button size="btn" type="button" disabled={pending} onClick={add} loading={pending}>Add</Button>
      </div>
      {error && <p role="alert" className="text-sm text-[var(--error)]">{error}</p>}
    </div>
  );
}
