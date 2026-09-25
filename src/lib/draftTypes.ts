/** Forms that can be saved as a draft, and where each one lives. Only these types are accepted by the server. */
export const DRAFT_TYPES = {
  EMPLOYEE_REGISTRATION: { label: "Employee registration", href: "/employees/new" },
  DEMAND_REQUEST: { label: "Demand request", href: "/demand/new" },
  QUOTATION: { label: "Quotation", href: "/sales/quotations/new" },
} as const;

export type DraftType = keyof typeof DRAFT_TYPES;
export const isDraftType = (t: string): t is DraftType => t in DRAFT_TYPES;
