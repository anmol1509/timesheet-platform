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

// ---- Pay typed into a sheet -----------------------------------------------------------------------------------------

/** "Itemised", "Flat", "Hourly" and the other ways people write them. Anything else is not recognised. */
export function parsePayStructure(text: string): PayStructure | null {
  const t = text.trim().toLowerCase().replace(/[^a-z]/g, "");
  if (!t) return null;
  if (["itemised", "itemized", "basic", "basicplusallowances", "basicallowances"].includes(t)) return "ITEMISED";
  if (["flat", "monthly", "fixed", "salary", "flatmonthly", "monthlysalary"].includes(t)) return "FLAT";
  if (["hourly", "hour", "perhour", "byhour"].includes(t)) return "HOURLY";
  return null;
}

/** A money cell: "1,500", "AED 1500.50", "1 500". Blank gives null; anything unreadable gives NaN. */
export function parseMoneyCell(text: string | null | undefined): number | null {
  const t = String(text ?? "").trim();
  if (t === "") return null;
  const cleaned = t.replace(/aed/gi, "").replace(/[,\s]/g, "");
  return /^-?\d+(\.\d+)?$/.test(cleaned) ? Number(cleaned) : Number.NaN;
}

/**
 * The pay columns of a sheet row. A row with neither structure nor rate leaves pay alone. Otherwise both are required: every
 * worker has their own rate, so a structure without a rate (or a rate without a structure) is an error on that row.
 */
export function parsePayCells(cells: { structure?: string | null; rate?: string | null; housing?: string | null; food?: string | null; transport?: string | null; other?: string | null }): { skip: true } | { error: string } | { input: PayInput } {
  const structureText = String(cells.structure ?? "").trim();
  const rateText = String(cells.rate ?? "").trim();
  const allowanceTexts = [cells.housing, cells.food, cells.transport, cells.other].map((v) => String(v ?? "").trim());
  if (!structureText && !rateText && allowanceTexts.every((v) => !v)) return { skip: true };
  if (!structureText) return { error: "Pay structure is missing. Use Itemised, Flat or Hourly." };
  const structure = parsePayStructure(structureText);
  if (!structure) return { error: `"${structureText}" isn't a pay structure. Use Itemised, Flat or Hourly.` };
  const rate = parseMoneyCell(rateText);
  if (rate === null) return { error: "Pay rate is required whenever a pay structure is given." };
  const [housing, food, transport, other] = allowanceTexts.map((v) => parseMoneyCell(v));
  if ([rate, housing, food, transport, other].some((v) => v !== null && Number.isNaN(v))) return { error: "A pay amount isn't a number." };
  if (structure !== "ITEMISED" && [housing, food, transport, other].some((v) => v)) return { error: "Allowances only go with the Itemised structure." };
  return { input: payInputFromRate(structure, rate, { housing, food, transport, other }) };
}

// ---- Working terms typed into a sheet: daily hours, overtime, gas -----------------------------------------------------

/** The highest overtime multiplier accepted (a multiple of the normal hourly rate). Night, holiday and special rates can run well above 3. */
export const MAX_OT_MULTIPLIER = 10;

export type WorkTerms = { dailyHours?: number; paysOvertime?: boolean; otMultiplier?: number; restOtMultiplier?: number; gasWaived?: boolean };

/** Yes / No in the ways people write them. Blank is null (leave alone); anything else is undefined (not understood). */
export function parseYesNo(text: string | null | undefined): boolean | null | undefined {
  const t = String(text ?? "").trim().toLowerCase();
  if (t === "") return null;
  if (["yes", "y", "true", "1", "on"].includes(t)) return true;
  if (["no", "n", "false", "0", "off"].includes(t)) return false;
  return undefined;
}

/**
 * The working-terms columns of a sheet row: standard hours in a day, whether overtime is paid and at what multiple, and whether the
 * daily gas charge is waived. A blank cell leaves the saved value alone. Same limits as the employee form.
 */
export function parseWorkTerms(cells: { dailyHours?: string | null; overtime?: string | null; otMultiplier?: string | null; restOtMultiplier?: string | null; gasWaived?: string | null }): { skip: true } | { error: string } | { terms: WorkTerms } {
  const texts = [cells.dailyHours, cells.overtime, cells.otMultiplier, cells.restOtMultiplier, cells.gasWaived].map((v) => String(v ?? "").trim());
  if (texts.every((t) => !t)) return { skip: true };
  const terms: WorkTerms = {};
  const hours = parseMoneyCell(cells.dailyHours);
  if (hours !== null) {
    if (Number.isNaN(hours) || hours < 1 || hours > 16) return { error: "Daily hours must be a number from 1 to 16." };
    terms.dailyHours = hours;
  }
  const ot = parseYesNo(cells.overtime);
  if (ot === undefined) return { error: `Overtime must be Yes or No (not "${texts[1]}").` };
  if (ot !== null) terms.paysOvertime = ot;
  for (const [key, text, label] of [["otMultiplier", cells.otMultiplier, "Overtime multiplier"], ["restOtMultiplier", cells.restOtMultiplier, "Rest-day overtime multiplier"]] as const) {
    const m = parseMoneyCell(text);
    if (m === null) continue;
    if (Number.isNaN(m) || m < 1 || m > MAX_OT_MULTIPLIER) return { error: `${label} must be a number from 1 to ${MAX_OT_MULTIPLIER}.` };
    terms[key] = m;
  }
  const gas = parseYesNo(cells.gasWaived);
  if (gas === undefined) return { error: `Gas charge waived must be Yes or No (not "${texts[4]}").` };
  if (gas !== null) terms.gasWaived = gas;
  return { terms };
}
