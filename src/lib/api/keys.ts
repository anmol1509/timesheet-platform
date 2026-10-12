import { createHash, randomBytes } from "crypto";

/** What a key may do. Anything not listed here is refused, so a new endpoint is closed until a scope is added for it. */
export const API_SCOPES = [
  { key: "employees:read", label: "Employees", description: "Names, trade, status, supplier, project and document expiry dates.", sensitive: false },
  { key: "employees:pii", label: "Employee personal details", description: "Adds passport, Emirates ID and labour card numbers, date of birth and phone numbers.", sensitive: true },
  { key: "suppliers:read", label: "Suppliers", description: "Supplier details and trade licences.", sensitive: false },
  { key: "clients:read", label: "Clients", description: "Client details and payment terms.", sensitive: false },
  { key: "projects:read", label: "Projects", description: "Projects and their dates.", sensitive: false },
  { key: "attendance:read", label: "Attendance", description: "Daily attendance and hours.", sensitive: false },
  { key: "timesheets:read", label: "Timesheets", description: "Monthly timesheet entries and hours.", sensitive: false },
  { key: "invoices:read", label: "Client invoices", description: "Invoice numbers, totals and status.", sensitive: false },
  { key: "renewals:read", label: "Document expiries", description: "Documents expiring soon, by person.", sensitive: false },
  { key: "payroll:read", label: "Payroll", description: "Payroll runs and each worker's pay lines.", sensitive: true },
] as const;

export type ApiScope = (typeof API_SCOPES)[number]["key"];
export const SCOPE_KEYS: string[] = API_SCOPES.map((s) => s.key);
export const isScope = (v: string): v is ApiScope => SCOPE_KEYS.includes(v);

const PREFIX = "mps_live_";

/** A new secret. The caller shows it once and stores only its hash. */
export function generateApiKey() {
  const secret = PREFIX + randomBytes(24).toString("base64url");
  return { secret, hash: hashApiKey(secret), prefix: secret.slice(0, PREFIX.length + 4) };
}

export const hashApiKey = (secret: string) => createHash("sha256").update(secret).digest("hex");

export const looksLikeApiKey = (v: string) => /^mps_live_[A-Za-z0-9_-]{32}$/.test(v);
