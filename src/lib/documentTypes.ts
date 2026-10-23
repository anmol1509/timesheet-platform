/**
 * The document types a supplier company or one of its parties (owner, sponsor) can hold. The built-in list lives here;
 * a branch changes a built-in type, or adds its own, with DocumentType rows (see `resolveDocTypes`). An Attachment
 * stores the type's key in `docType`.
 */
export type DocAppliesTo = "SUPPLIER" | "SUPPLIER_PARTY" | "VEHICLE";
export const DOC_TARGETS: readonly DocAppliesTo[] = ["SUPPLIER", "SUPPLIER_PARTY", "VEHICLE"];
export type DocRequired = "NO" | "YES" | "OWN_COMPANY";

export type DocTypeDef = {
  appliesTo: DocAppliesTo;
  key: string;
  label: string;
  hasExpiry: boolean;
  required: DocRequired;
  reminderDays: number[];
  sortOrder: number;
  isActive: boolean;
  /** True for a built-in type (its key is fixed; a branch can edit it but not delete it). */
  builtIn: boolean;
};

/** The renewal queue looks 90 days ahead, so a reminder set further out would never fire. */
export const MAX_REMINDER_DAYS = 90;
export const DEFAULT_REMINDER_DAYS = [90, 60, 30, 7];

export const PARTY_ROLES = [
  { value: "OWNER", label: "Owner" },
  { value: "SPONSOR", label: "Sponsor" },
  { value: "PARTNER", label: "Partner" },
  { value: "MANAGER", label: "Manager" },
] as const;
export const PARTY_ROLE_LABEL: Record<string, string> = Object.fromEntries(PARTY_ROLES.map((r) => [r.value, r.label]));

type Seed = [key: string, label: string, hasExpiry: boolean, required?: DocRequired];

const COMPANY: Seed[] = [
  ["TRADE_LICENSE", "Trade licence", true, "YES"],
  ["ESTABLISHMENT_CARD", "Establishment card (e-channel)", true, "YES"],
  ["TRN_CERTIFICATE", "VAT certificate", false],
  ["MOHRE_PERMIT", "MOHRE permit", true],
  ["EJARI_TENANCY", "Tenancy agreement (Ejari)", true, "OWN_COMPANY"],
  ["CHAMBER_OF_COMMERCE", "Chamber of Commerce certificate", true],
  ["COMPANY_INSURANCE", "Company insurance", true],
  ["SPONSORSHIP_AGREEMENT", "Sponsorship agreement", true],
  ["CONTRACT", "Contract", true],
  ["LETTERHEAD", "Letterhead (blank, for letters)", false],
  ["OTHER", "Other", true],
];

const PARTY: Seed[] = [
  ["PASSPORT", "Passport", true, "YES"],
  ["EMIRATES_ID", "Emirates ID", true, "YES"],
  ["VISA", "Residence visa", true],
  ["INSURANCE", "Health insurance", true],
  ["POWER_OF_ATTORNEY", "Power of attorney", true],
  ["OTHER", "Other", true],
];

const VEHICLE: Seed[] = [
  ["VEHICLE_REGISTRATION", "Registration (Mulkiya)", true, "YES"],
  ["VEHICLE_INSURANCE", "Vehicle insurance", true, "YES"],
  ["VEHICLE_PASSING", "Annual passing / fitness test", true],
  ["TRANSPORT_PERMIT", "Transport / route permit", true],
  ["LEASE_CONTRACT", "Purchase or lease contract", true],
  ["WARRANTY", "Warranty", true],
  ["MAINTENANCE_RECORD", "Maintenance / service record", false],
  ["OTHER", "Other", true],
];

/** Vehicle document types whose latest expiry also keeps the vehicle's own date fields current. */
export const VEHICLE_EXPIRY_FIELD = { VEHICLE_REGISTRATION: "registrationExpiry", VEHICLE_INSURANCE: "insuranceExpiry" } as const;

function seeds(appliesTo: DocAppliesTo, list: Seed[]): DocTypeDef[] {
  return list.map(([key, label, hasExpiry, required], i) => ({
    appliesTo,
    key,
    label,
    hasExpiry,
    required: required ?? "NO",
    reminderDays: hasExpiry ? DEFAULT_REMINDER_DAYS : [],
    sortOrder: i,
    isActive: true,
    builtIn: true,
  }));
}

export const BUILT_IN_DOC_TYPES: DocTypeDef[] = [...seeds("SUPPLIER", COMPANY), ...seeds("SUPPLIER_PARTY", PARTY), ...seeds("VEHICLE", VEHICLE)];

export type DocTypeRow = {
  appliesTo: string;
  key: string;
  label: string;
  hasExpiry: boolean;
  required: string;
  reminderDays: number[];
  sortOrder: number;
  isActive: boolean;
};

/** The built-in types with the branch's rows laid over them; rows with a new key are custom types. Sorted for display. */
export function resolveDocTypes(rows: DocTypeRow[], appliesTo?: DocAppliesTo): DocTypeDef[] {
  const out = new Map<string, DocTypeDef>();
  for (const d of BUILT_IN_DOC_TYPES) out.set(`${d.appliesTo}|${d.key}`, d);
  for (const r of rows) {
    if (!(DOC_TARGETS as readonly string[]).includes(r.appliesTo)) continue;
    const id = `${r.appliesTo}|${r.key}`;
    out.set(id, {
      appliesTo: r.appliesTo as DocAppliesTo,
      key: r.key,
      label: r.label,
      hasExpiry: r.hasExpiry,
      required: r.required === "YES" || r.required === "OWN_COMPANY" ? r.required : "NO",
      reminderDays: r.reminderDays,
      // A custom type sorts after the built-ins unless given a position; a built-in keeps its place.
      sortOrder: out.get(id)?.sortOrder ?? 100 + r.sortOrder,
      isActive: r.isActive,
      builtIn: out.get(id)?.builtIn ?? false,
    });
  }
  return [...out.values()]
    .filter((d) => !appliesTo || d.appliesTo === appliesTo)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
}

/** Types shown in the upload dropdown and the checklist. An inactive type still reads, but can't take new files. */
export function activeDocTypes(types: DocTypeDef[]): DocTypeDef[] {
  return types.filter((t) => t.isActive);
}

export function isRequired(t: DocTypeDef, isOwnCompany: boolean): boolean {
  return t.isActive && (t.required === "YES" || (t.required === "OWN_COMPANY" && isOwnCompany));
}

export type ChecklistItem = {
  type: DocTypeDef;
  required: boolean;
  /** The file that stands for this type: the one that runs longest (a renewal replaces an older one). */
  current: { id: string; filename: string; expiryDate: string | null; uploadedAt: string } | null;
  count: number;
  state: "valid" | "expiring" | "expired" | "missing" | "uploaded";
  daysLeft: number | null;
};

export type ChecklistFile = { id: string; docType: string; filename: string; expiryDate: string | null; uploadedAt: string };

const DAY = 86400000;

/**
 * One row per active type (plus any inactive type that already holds a file), with the status of its current file.
 * "expiring" means inside the type's longest reminder window (30 days when it has none).
 */
export function buildChecklist(types: DocTypeDef[], files: ChecklistFile[], isOwnCompany: boolean, now: number = Date.now()): ChecklistItem[] {
  const by = new Map<string, ChecklistFile[]>();
  for (const f of files) by.set(f.docType, [...(by.get(f.docType) ?? []), f]);
  const rank = (f: ChecklistFile) => (f.expiryDate ? new Date(f.expiryDate).getTime() : new Date(f.uploadedAt).getTime() - 1e13);
  const items: ChecklistItem[] = [];
  for (const type of types) {
    const mine = by.get(type.key) ?? [];
    if (!type.isActive && mine.length === 0) continue;
    const current = mine.length ? [...mine].sort((a, b) => rank(b) - rank(a))[0] : null;
    let state: ChecklistItem["state"] = current ? "uploaded" : "missing";
    let daysLeft: number | null = null;
    if (current && type.hasExpiry && current.expiryDate) {
      daysLeft = Math.ceil((new Date(current.expiryDate).getTime() - now) / DAY);
      const window = type.reminderDays.length ? Math.max(...type.reminderDays) : 30;
      state = daysLeft < 0 ? "expired" : daysLeft <= window ? "expiring" : "valid";
    } else if (current && !type.hasExpiry) {
      state = "valid";
    }
    items.push({ type, required: isRequired(type, isOwnCompany), current, count: mine.length, state, daysLeft });
  }
  return items;
}

export function docTypeKey(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
}

export function parseReminderDays(raw: string): number[] {
  const days = raw.split(/[\s,]+/).map((s) => Number(s)).filter((n) => Number.isInteger(n) && n > 0 && n <= MAX_REMINDER_DAYS);
  return [...new Set(days)].sort((a, b) => b - a).slice(0, 8);
}
