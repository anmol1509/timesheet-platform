/** What a recurring or one-off pay item is, so payslips and reports can group them. */
export const EARNING_CATEGORIES = [
  { value: "ALLOWANCE", label: "Allowance" },
  { value: "BONUS", label: "Bonus" },
  { value: "COMMISSION", label: "Commission" },
  { value: "REIMBURSEMENT", label: "Reimbursement" },
  { value: "ARREARS", label: "Arrears" },
  { value: "CORRECTION", label: "Correction" },
  { value: "OTHER", label: "Other" },
] as const;
export const DEDUCTION_CATEGORIES = [
  { value: "FINE", label: "Fine" },
  { value: "DAMAGE", label: "Damage or loss" },
  { value: "UNIFORM", label: "Uniform or equipment" },
  { value: "CORRECTION", label: "Correction" },
  { value: "OTHER", label: "Other" },
] as const;

const ALL = new Set([...EARNING_CATEGORIES, ...DEDUCTION_CATEGORIES].map((c) => c.value as string));
export const cleanCategory = (v: string | null | undefined): string | null => (v && ALL.has(v) ? v : null);
export const categoryLabel = (v: string | null | undefined) => [...EARNING_CATEGORIES, ...DEDUCTION_CATEGORIES].find((c) => c.value === v)?.label ?? "Other";
