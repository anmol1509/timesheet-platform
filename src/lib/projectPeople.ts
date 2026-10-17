/**
 * A named person on a project (manager, coordinator, sales executive) needs a reachable phone number. Anything
 * without a name is stored blank, so clearing the name clears the contact too. Shared by the project form and the
 * project quick view so both apply the same rule.
 */
export const PEOPLE = [
  { key: "manager", label: "Project manager" },
  { key: "projectCoordinator", label: "Project coordinator" },
  { key: "salesExecutive", label: "Sales executive" },
] as const;

export type PeopleResult = { error: string; data?: undefined } | { error?: undefined; data: Record<string, string | null> };

const stringOrNull = (value: FormDataEntryValue | null) => {
  const s = String(value || "").trim();
  return s || null;
};

export function readPeople(formData: FormData, keys: readonly string[]): PeopleResult {
  const data: Record<string, string | null> = {};
  for (const p of PEOPLE) {
    if (!keys.includes(p.key)) continue;
    const name = stringOrNull(formData.get(p.key));
    const phone = name ? stringOrNull(formData.get(`${p.key}Phone`)) : null;
    const email = name ? stringOrNull(formData.get(`${p.key}Email`)) : null;
    if (name && (!phone || phone.replace(/\D/g, "").length < 7)) {
      return { error: `Add a phone number for the ${p.label.toLowerCase()}.` };
    }
    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      return { error: `The ${p.label.toLowerCase()}'s email address isn't valid.` };
    }
    data[p.key] = name;
    data[`${p.key}Phone`] = phone;
    data[`${p.key}Email`] = email;
  }
  return { data };
}
