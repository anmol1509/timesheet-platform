/**
 * Turning "this worker is paid X this way" into the pay columns on a worker, and the dated pay-history record that goes with a
 * change. Pure, shared by the places that set pay in bulk (the payroll run's fix panel, imports, the add-to-employees screen).
 */
export type PayChoice = "LATER" | "FLAT" | "ITEMISED" | "HOURLY";

export type PayInput = { choice: PayChoice; flat?: number | null; basic?: number | null; housing?: number | null; food?: number | null; transport?: number | null; other?: number | null; hourly?: number | null };

/** The employee pay columns for what was typed, or an error in plain words. "Set later" leaves pay alone. */
export function payFieldsFor(p: PayInput): { error: string } | { fields: Record<string, unknown> } {
  const amounts = [p.flat, p.basic, p.housing, p.food, p.transport, p.other, p.hourly];
  if (amounts.some((a) => a != null && (!Number.isFinite(a) || a < 0))) return { error: "Pay amounts can't be negative." };
  if (p.choice === "FLAT") {
    if (!p.flat) return { error: "Enter the monthly salary, or choose Set later." };
    return { fields: { payStructure: "FLAT", flatMonthlyRate: p.flat, payOverride: true } };
  }
  if (p.choice === "ITEMISED") {
    if (!p.basic) return { error: "Enter the basic salary, or choose Set later." };
    return { fields: { payStructure: "ITEMISED", basicSalary: p.basic, housingAllowance: p.housing ?? null, foodAllowance: p.food ?? null, transportAllowance: p.transport ?? null, otherAllowance: p.other ?? null, payOverride: true } };
  }
  if (p.choice === "HOURLY") {
    if (!p.hourly) return { error: "Enter the hourly rate, or choose Set later." };
    return { fields: { payStructure: "HOURLY", hourlyRate: p.hourly, payOverride: true } };
  }
  return { fields: {} };
}

/** Pay entered as a structure plus one "pay rate" and optional allowances, the way a sheet or the fix panel gives it. */
export function payInputFromRate(structure: "FLAT" | "ITEMISED" | "HOURLY", rate: number | null, allowances: { housing?: number | null; food?: number | null; transport?: number | null; other?: number | null } = {}): PayInput {
  if (structure === "FLAT") return { choice: "FLAT", flat: rate };
  if (structure === "HOURLY") return { choice: "HOURLY", hourly: rate };
  return { choice: "ITEMISED", basic: rate, ...allowances };
}

export type PayColumns = { payStructure: string | null; basicSalary: number | null; housingAllowance: number | null; foodAllowance: number | null; transportAllowance: number | null; otherAllowance: number | null; flatMonthlyRate: number | null; hourlyRate: number | null };

/** All the pay columns for a structure, with every figure the structure doesn't use cleared, so switching can't leave stale pay behind. */
export function payColumns(fields: Record<string, unknown>): PayColumns {
  const num = (v: unknown) => (v == null ? null : Number(v));
  const structure = (fields.payStructure as string | undefined) ?? null;
  return {
    payStructure: structure,
    basicSalary: structure === "ITEMISED" ? num(fields.basicSalary) : null,
    housingAllowance: structure === "ITEMISED" ? num(fields.housingAllowance) : null,
    foodAllowance: structure === "ITEMISED" ? num(fields.foodAllowance) : null,
    transportAllowance: structure === "ITEMISED" ? num(fields.transportAllowance) : null,
    otherAllowance: structure === "ITEMISED" ? num(fields.otherAllowance) : null,
    flatMonthlyRate: structure === "FLAT" ? num(fields.flatMonthlyRate) : null,
    hourlyRate: structure === "HOURLY" ? num(fields.hourlyRate) : null,
  };
}

/** What a worker is paid each month on a fixed structure: basic plus allowances, or the flat rate. Hourly has no fixed figure. */
export type PaySnapshot = { payStructure: string | null; basicSalary?: unknown; housingAllowance?: unknown; foodAllowance?: unknown; transportAllowance?: unknown; otherAllowance?: unknown; flatMonthlyRate?: unknown; hourlyRate?: unknown };

export function fixedMonthly(c: PaySnapshot): number {
  const x = (v: unknown) => (v == null ? 0 : Number(String(v)));
  if (c.payStructure === "ITEMISED") return x(c.basicSalary) + x(c.housingAllowance) + x(c.foodAllowance) + x(c.transportAllowance) + x(c.otherAllowance);
  if (c.payStructure === "FLAT") return x(c.flatMonthlyRate);
  return 0;
}

/** The pay-history record for a change of pay, or null when nothing a person would call a change happened. */
export function payRevision(before: PaySnapshot, after: PaySnapshot): { fixedBefore: number; fixedAfter: number; before: PayColumns; after: PayColumns } | null {
  const fixedBefore = fixedMonthly(before);
  const fixedAfter = fixedMonthly(after);
  const structureChanged = (before.payStructure ?? null) !== (after.payStructure ?? null);
  const hourlyChanged = Number(before.hourlyRate ?? 0) !== Number(after.hourlyRate ?? 0);
  if (fixedBefore === fixedAfter && !structureChanged && !hourlyChanged) return null;
  return { fixedBefore, fixedAfter, before: payColumns({ ...before }), after: payColumns({ ...after }) };
}

export type PayStructure = "FLAT" | "ITEMISED" | "HOURLY";

/** The structures a company's pay type allows: a monthly-salary company can't pay by the hour, and the other way round. */
export function structuresFor(companyPayType: string | null | undefined): PayStructure[] {
  return companyPayType === "HOURLY" ? ["HOURLY"] : companyPayType === "BASIC" ? ["FLAT", "ITEMISED"] : ["FLAT", "ITEMISED", "HOURLY"];
}
