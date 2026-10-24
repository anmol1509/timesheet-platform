"use client";

import { Select } from "@/components/ui/Select";

export type PersonOption = { id: string; label: string };
export type NewPerson = { name: string; nationality: string; phone: string; email: string };
export const EMPTY_PERSON: NewPerson = { name: "", nationality: "", phone: "", email: "" };
export type PickerChoice = { kind: "none" } | { kind: "existing"; partyId: string } | { kind: "new" };

const NEW = "__new";

/**
 * Who a row is about: someone already on file (so nothing is typed or uploaded again), or a new person. People already
 * linked to the company in this role are left out so the same person can't be added twice.
 */
export function PersonPicker({ options, choice, onChoice, person, onPerson, hideIds = [], disabled = false }: {
  options: PersonOption[];
  choice: PickerChoice;
  onChoice: (c: PickerChoice) => void;
  person: NewPerson;
  onPerson: (p: NewPerson) => void;
  hideIds?: string[];
  disabled?: boolean;
}) {
  const value = choice.kind === "existing" ? choice.partyId : choice.kind === "new" ? NEW : "";
  const shown = options.filter((o) => !hideIds.includes(o.id) || (choice.kind === "existing" && choice.partyId === o.id));
  return (
    <div className="space-y-2">
      <Select
        value={value}
        onChange={(v) => onChoice(v === NEW ? { kind: "new" } : v ? { kind: "existing", partyId: v } : { kind: "none" })}
        placeholder="Choose a person…"
        disabled={disabled}
        options={[{ value: NEW, label: "＋ Add a new person" }, ...shown.map((o) => ({ value: o.id, label: o.label }))]}
      />
      {choice.kind === "new" && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input className="input w-full" placeholder="Full name *" value={person.name} onChange={(e) => onPerson({ ...person, name: e.target.value })} aria-label="Full name" />
          <input className="input w-full" placeholder="Nationality" value={person.nationality} onChange={(e) => onPerson({ ...person, nationality: e.target.value })} aria-label="Nationality" />
          <input className="input w-full" placeholder="Phone" value={person.phone} onChange={(e) => onPerson({ ...person, phone: e.target.value })} aria-label="Phone" />
          <input className="input w-full" type="email" placeholder="Email" value={person.email} onChange={(e) => onPerson({ ...person, email: e.target.value })} aria-label="Email" />
        </div>
      )}
    </div>
  );
}
