// Fixed set of admin-configurable dropdown categories. The category set
// itself is fixed by code (matching the competitor ERP's own fixed set of
// Administration lookup tables) — admins manage values within a category,
// not the categories themselves.
export const LOOKUP_CATEGORIES = [
  { key: "TRADE", label: "Trade" },
  { key: "POSITION", label: "Position" },
  { key: "DEPARTMENT", label: "Department" },
  { key: "BLOOD_GROUP", label: "Blood Group" },
  { key: "RELIGION", label: "Religion" },
  { key: "STATE", label: "State" },
  { key: "ACCOMMODATION_TYPE", label: "Accommodation Type" },
  { key: "VISA_TYPE", label: "Visa Type" },
  { key: "VISA_STATUS", label: "Visa Status" },
  { key: "PASSPORT_STATUS", label: "Passport Status" },
  { key: "LABOR_CARD_STATUS", label: "Labour Card Status" },
  { key: "CICPA_STATUS", label: "CICPA Status" },
  { key: "INSURANCE_CARD_TYPE", label: "Insurance Card Type" },
  { key: "INSURANCE_STATUS", label: "Insurance Status" },
  { key: "DRIVING_LICENCE_TYPE", label: "Driving Licence Type" },
  { key: "DRIVING_LICENCE_STATUS", label: "Driving Licence Status" },
  { key: "MEDICAL_STATUS", label: "Medical Status" },
  { key: "EID_STATUS", label: "EID Status" },
  { key: "VISA_APPLICATION_STAGE", label: "Visa Application Stage" },
  { key: "LABOUR_CARD_APPLICATION_STAGE", label: "Labour Card Application Stage" },
  { key: "ROOM_TYPE", label: "Room Type" },
] as const;

export type LookupCategoryKey = (typeof LOOKUP_CATEGORIES)[number]["key"];

export function lookupCategoryLabel(key: string) {
  return LOOKUP_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

/**
 * What the visa and labour card history "Stage" dropdowns offer until an admin adds their own under Settings › Lookups.
 * Once any value is configured for a category, those replace these.
 */
export const DEFAULT_APPLICATION_STAGES = {
  VISA_APPLICATION_STAGE: ["Applied", "Entry permit issued", "Entered UAE", "Medical test done", "Emirates ID applied", "Visa stamped", "Renewed", "Cancelled"],
  LABOUR_CARD_APPLICATION_STAGE: ["Quota approved", "Applied", "Fee paid", "Issued", "Renewed", "Cancelled"],
} as const;

export function stagesFor<K extends keyof typeof DEFAULT_APPLICATION_STAGES>(key: K, configured: { value: string }[] | undefined): { value: string }[] {
  return configured && configured.length > 0 ? configured : DEFAULT_APPLICATION_STAGES[key].map((value) => ({ value }));
}
