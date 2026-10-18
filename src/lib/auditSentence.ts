/**
 * Turns an audit entry into something a person reads: "Anmol changed Rahul Khan's basic salary from 3,000 to 3,200".
 * Pure, so the client list, the employee page and the tests all share it.
 */
import { entityMeta, fieldLabel } from "@/lib/auditPresentation";

export type AuditLike = { entityType: string; action: string; changes: Record<string, unknown> | null };

/** Words people use, where turning the column name into words would read badly. */
const LABELS: Record<string, string> = {
  basicSalary: "basic salary", housingAllowance: "housing allowance", foodAllowance: "food allowance", transportAllowance: "transport allowance",
  otherAllowance: "other allowance", flatMonthlyRate: "monthly rate", hourlyRate: "hourly rate", otMultiplier: "overtime multiplier", paysOvertime: "pays overtime",
  payStructure: "pay structure", payOverride: "pay override", gasWaived: "gas charge waived", siteArrivalDate: "site arrival date", mobilisationDate: "mobilisation date",
  employeeIdNo: "employee ID", emiratesId: "Emirates ID", emiratesIdExpiry: "Emirates ID expiry", eidStatus: "Emirates ID status", laborCardExpiry: "labour card expiry",
  laborCardNumber: "labour card number", laborCardPersonalNo: "labour card personal no.", medicalExpiry: "medical expiry", passportExpiry: "passport expiry",
  passportNumber: "passport number", visaExpiry: "visa expiry", essEnabled: "self-service access", mobileNumber: "mobile number", joinDate: "join date",
  dateOfBirth: "date of birth", sponsorSupplierId: "sponsor", projectId: "project", tradeLicenseExpiry: "trade licence expiry", tradeLicenseNumber: "trade licence number",
  absentDeductionPerDay: "absence deduction per day", absentFreeDays: "free absence days", gasPerDay: "gas charge per day", gasMonthlyCap: "gas monthly cap",
  isOwnCompany: "own company", payrollApprovalThreshold: "payroll approval limit", letterheadTopMm: "letterhead top margin", letterheadBottomMm: "letterhead bottom margin", letterheadLeftMm: "letterhead left margin", letterheadRightMm: "letterhead right margin", plainTopMm: "plain-paper top margin", plainBottomMm: "plain-paper bottom margin", plainLeftMm: "plain-paper left margin", plainRightMm: "plain-paper right margin",
  scheduledCheckOut: "scheduled check-out", checkInDate: "check-in date", wpsIban: "IBAN", wpsBankName: "bank", wpsAccountNumber: "bank account number",
  trn: "tax number (TRN)", poBox: "PO box", fullName: "full name", contactPerson: "contact person", contactEmail: "contact email", contactPhone: "contact phone",
  paymentTerms: "payment terms", approvalStatus: "approval status", invoiceApprovalStatus: "invoice approval", labourApprovalStatus: "labour approval", portalEnabled: "portal access",
};

/** Fields that only people allowed to see pay should see. */
const PAY_FIELD = /salary|allowance|rate$|^rate|iban|bank|account|multiplier|overtime|deduction|advance|loan|amount|^gas|threshold|override|flat/i;
export const isPayField = (key: string) => PAY_FIELD.test(key);

const MONEY_FIELD = /salary|allowance|rate$|amount|deduction|cap$|perDay$|threshold|balance|principal|instalment|price|cost/i;
const DATE_ISO = /^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/;
const LOOKS_LIKE_ID = /^c[a-z0-9]{20,30}$/;

/** Bookkeeping columns nobody needs to read. Foreign-key ids are hidden too: they say nothing to a person. */
export function isHiddenField(key: string): boolean {
  if (key === "null" || key === "id" || key === "createdAt" || key === "updatedAt") return true;
  if (key === "employeeIdNo") return false;
  return /Id$/.test(key) && key !== "emiratesId";
}

export const auditFieldLabel = (key: string) => LABELS[key] ?? fieldLabel(key).toLowerCase();

const money = (n: number) => n.toLocaleString("en-AE", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 });
const dmy = (s: string) => s.slice(0, 10).split("-").reverse().join("-");

export function auditValue(key: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "empty";
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (typeof v === "number") return MONEY_FIELD.test(key) ? money(v) : String(v);
  if (typeof v === "string") {
    if (DATE_ISO.test(v)) return dmy(v);
    if (LOOKS_LIKE_ID.test(v)) return "a linked record";
    if (MONEY_FIELD.test(key) && v.trim() !== "" && !Number.isNaN(Number(v))) return money(Number(v));
    const clean = v.replace(/_/g, " ");
    return clean.length > 60 ? `${clean.slice(0, 57)}…` : clean;
  }
  if (Array.isArray(v)) return `${v.length} item${v.length === 1 ? "" : "s"}`;
  return "details";
}

/** The best name this entry gives for the thing that changed, when the record itself isn't at hand. */
export function nameFromChanges(changes: Record<string, unknown> | null): string | null {
  if (!changes) return null;
  const pick = (k: string) => {
    const raw = changes[k];
    const v = raw && typeof raw === "object" && "to" in (raw as object) ? (raw as { to: unknown }).to : raw;
    return typeof v === "string" && v.trim() && !LOOKS_LIKE_ID.test(v) ? v.trim() : null;
  };
  for (const k of ["name", "fullName", "candidateName", "title", "filename", "itemName", "ref", "label", "code"]) {
    const v = pick(k);
    if (v) return v;
  }
  const month = pick("month");
  if (month) return `${pick("company") ?? "payroll"} ${month}`;
  return null;
}

export type FieldChange = { key: string; label: string; from: string | null; to: string };

/** The fields to show: only those with something to say, and no pay figures for people who can't see pay. */
export function auditFields(e: AuditLike, opts: { canSeePay: boolean }): { shown: FieldChange[]; hiddenPay: number } {
  const shown: FieldChange[] = [];
  let hiddenPay = 0;
  for (const [key, raw] of Object.entries(e.changes ?? {})) {
    if (isHiddenField(key)) continue;
    if (!opts.canSeePay && isPayField(key)) { hiddenPay++; continue; }
    const isDiff = e.action === "UPDATE" && !!raw && typeof raw === "object" && "from" in (raw as object);
    if (isDiff) {
      const d = raw as { from: unknown; to: unknown };
      shown.push({ key, label: auditFieldLabel(key), from: auditValue(key, d.from), to: auditValue(key, d.to) });
    } else if (raw !== null && raw !== undefined && raw !== "" && raw !== false) {
      shown.push({ key, label: auditFieldLabel(key), from: null, to: auditValue(key, raw) });
    }
  }
  return { shown, hiddenPay };
}

const possessive = (name: string) => (name.endsWith("s") ? `${name}'` : `${name}'s`);
const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

/** "changed Rahul Khan's basic salary from 3,000 to 3,200", without the person who did it (the list shows that separately). */
export function auditSentence(e: AuditLike, name: string | null, opts: { canSeePay: boolean }): string {
  const meta = entityMeta(e.entityType);
  const label = meta.label.toLowerCase();
  const who = name ?? nameFromChanges(e.changes);
  const noun = who ? `${label} ${who}` : label;
  if (e.action === "CREATE") return `added ${noun}`;
  if (e.action === "DELETE") return `deleted ${noun}`;
  const { shown, hiddenPay } = auditFields(e, opts);
  // "for Rahul Khan" names the employee a record belongs to, so the record can't take a possessive.
  const about = !!who && who.startsWith("for ");
  const target = who ? (about ? "" : e.entityType === "EMPLOYEE" ? possessive(who) : `${label} ${possessive(who)}`) : `the ${label}'s`;
  if (about) {
    if (shown.length === 0) return `saved ${noun} with no visible changes`;
    if (shown.length === 1 && shown[0].from !== null) return `changed ${noun}: ${shown[0].label} from ${shown[0].from} to ${shown[0].to}`;
    return `updated ${noun}: ${list(shown.slice(0, 3).map((f) => f.label))}${shown.length > 3 ? ` and ${shown.length - 3} more` : ""}`;
  }
  if (shown.length === 0) return hiddenPay > 0 ? `changed pay details on ${noun}` : `saved ${noun} with no visible changes`;
  if (shown.length === 1 && shown[0].from !== null) {
    const f = shown[0];
    return `changed ${target} ${f.label} from ${f.from} to ${f.to}`;
  }
  const names = shown.slice(0, 3).map((f) => f.label);
  const more = shown.length - names.length;
  return `updated ${target} ${list(more > 0 ? [...names, `${more} more`] : names)}`;
}
