/**
 * What to do when the database refuses a duplicate (Prisma code P2002): say so in plain words instead of letting it reach the
 * "Something went wrong" page. The code or number is almost always taken a moment earlier by someone else, or typed by hand
 * and already used, and the fix is to change it and try again, which the person can only do if they are told.
 */
const WHAT: Record<string, string> = {
  Project: "project", Client: "client", Supplier: "supplier", Employee: "employee", Bank: "bank", Quotation: "quotation",
  Vehicle: "vehicle", Lpo: "LPO", ClientInvoice: "invoice", Enquiry: "enquiry", Camp: "camp", Site: "site", Trade: "trade",
  SupplierParty: "person", SupplierPartyLink: "owner or sponsor", Branch: "company", User: "user",
  Room: "room", Bed: "bed", Skill: "trade", InventoryItem: "inventory item", InventoryVariant: "variant", LookupValue: "list value",
  TimesheetTemplate: "template", ExpenseBudget: "budget", Account: "account", ExchangeRate: "exchange rate", AccessRole: "role",
};
const FIELD: Record<string, string> = {
  code: "code", name: "name", employeeIdNo: "employee ID", plateNumber: "plate number", email: "email address",
  invoiceNumber: "invoice number", quotationNumber: "quotation number", lpoNumber: "LPO number",
};

type PrismaLike = { code?: string; meta?: { modelName?: string; target?: string | string[]; driverAdapterError?: { cause?: { constraint?: { fields?: string[] } } } } };

export function isUniqueClash(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as PrismaLike).code === "P2002";
}

/** "Another project already uses that code. Change it and try again." Falls back to a general sentence when the field is not known. */
export function uniqueClashMessage(e: unknown): string {
  const meta = (e as PrismaLike | null)?.meta;
  const what = (meta?.modelName && WHAT[meta.modelName]) || "record";
  const raw = meta?.target ?? meta?.driverAdapterError?.cause?.constraint?.fields;
  const fields = (Array.isArray(raw) ? raw : raw ? [raw] : []).map((f) => FIELD[f]).filter(Boolean);
  const field = fields[0];
  return field
    ? `Another ${what} already uses that ${field}. Change it and try again.`
    : `Another ${what} already has one of these values. Change it and try again.`;
}

/** Runs `run`; if the database says something already exists, returns `fail(message)` instead of throwing. Any other error still throws. */
export async function guardUnique<T>(run: () => Promise<T>, fail: (message: string) => T): Promise<T> {
  try {
    return await run();
  } catch (e) {
    if (isUniqueClash(e)) return fail(uniqueClashMessage(e));
    throw e;
  }
}
