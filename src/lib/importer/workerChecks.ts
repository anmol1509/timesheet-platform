import { normalizeNationality } from "@/lib/nationality";
import { parseLooseDate } from "@/lib/looseDate";

/**
 * What is wrong with a worker row, in plain code (no AI, nothing sent out).
 * The same rules decide both what gets flagged and whether a correction typed
 * on the review screen is accepted, so a fix can't introduce a new problem.
 */
export type WorkerProblem = { field: string; label: string; reason: string; kind: "country" | "gender" | "date" | "text"; current: string };

const DATES: [key: string, label: string][] = [
  ["dateOfBirth", "Date of birth"],
  ["joinDate", "Joining date"],
  ["passportExpiry", "Passport expiry"],
  ["emiratesIdExpiry", "Emirates ID expiry"],
  ["visaExpiry", "Visa expiry"],
  ["laborCardExpiry", "Labour card expiry"],
];
const DAY = 86_400_000;
const YEAR = 365.25 * DAY;
const clean = (s: string | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

export function genderOf(v: string): "Male" | "Female" | null {
  const g = v.trim().toLowerCase();
  if (["m", "male"].includes(g)) return "Male";
  if (["f", "female"].includes(g)) return "Female";
  return null;
}

/** Why a date can't be right for this field, or null when it is plausible. */
export function dateProblem(field: string, d: Date, now = new Date()): string | null {
  const t = d.getTime();
  const n = now.getTime();
  if (field === "dateOfBirth") {
    if (t > n) return "is in the future";
    const age = (n - t) / YEAR;
    if (age < 16) return "would make the worker under 16";
    if (age > 75) return "would make the worker over 75";
    return null;
  }
  if (field === "joinDate") {
    if (t > n + YEAR) return "is more than a year ahead";
    if (d.getUTCFullYear() < 1990) return "is before 1990";
    return null;
  }
  if (t < n - 10 * YEAR) return "expired more than 10 years ago — check the year";
  if (t > n + 12 * YEAR) return "is more than 12 years ahead — check the year";
  return null;
}

const digits = (s: string) => s.replace(/\D/g, "");

export function workerProblems(values: Record<string, string>, now = new Date()): WorkerProblem[] {
  const out: WorkerProblem[] = [];
  const nat = clean(values.nationality);
  if (nat) {
    const r = normalizeNationality(nat);
    if (!r.value) out.push({ field: "nationality", label: "Nationality", reason: r.status === "region" ? "is a region, not a country" : "wasn't recognised", kind: "country", current: nat });
  }
  const gd = clean(values.gender);
  if (gd && !genderOf(gd)) out.push({ field: "gender", label: "Gender", reason: "wasn't recognised", kind: "gender", current: gd });
  for (const [key, label] of DATES) {
    const raw = clean(values[key]);
    if (!raw) continue;
    const d = parseLooseDate(raw);
    if (d === "invalid") out.push({ field: key, label, reason: "isn't a date", kind: "date", current: raw });
    else if (d) {
      const why = dateProblem(key, d, now);
      if (why) out.push({ field: key, label, reason: why, kind: "date", current: raw });
    }
  }
  const eid = clean(values.emiratesId);
  if (eid && digits(eid).length !== 15) out.push({ field: "emiratesId", label: "Emirates ID", reason: "should have 15 digits (784-YYYY-NNNNNNN-C)", kind: "text", current: eid });
  const mob = clean(values.mobileNumber);
  if (mob && (digits(mob).length < 9 || digits(mob).length > 15)) out.push({ field: "mobileNumber", label: "Mobile number", reason: "doesn't look like a phone number", kind: "text", current: mob });
  return out;
}

/** The value to store for a typed correction, or null when it still has the problem (so it is ignored and shown again). */
export function checkWorkerFix(field: string, value: string, now = new Date()): string | null {
  const v = clean(value);
  if (!v || v.length > 60) return null;
  const problems = workerProblems({ [field]: v }, now);
  if (problems.some((p) => p.field === field)) return null;
  if (field === "nationality") return normalizeNationality(v).value;
  if (field === "gender") return genderOf(v);
  return v;
}

export const WORKER_FIX_FIELDS = new Set(["nationality", "gender", "dateOfBirth", "joinDate", "passportExpiry", "emiratesIdExpiry", "visaExpiry", "laborCardExpiry", "emiratesId", "mobileNumber"]);
