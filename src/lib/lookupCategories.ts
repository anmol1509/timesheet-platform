// Fixed set of admin-configurable dropdown categories. The category set
// itself is fixed by code (matching the competitor ERP's own fixed set of
// Administration lookup tables) — admins manage values within a category,
// not the categories themselves.
export const LOOKUP_CATEGORIES = [
  { key: "TRADE", label: "Trade" },
  { key: "POSITION", label: "Position" },
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
] as const;

export type LookupCategoryKey = (typeof LOOKUP_CATEGORIES)[number]["key"];

export function lookupCategoryLabel(key: string) {
  return LOOKUP_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}
