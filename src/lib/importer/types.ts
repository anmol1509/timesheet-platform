import type { Prisma, PrismaClient } from "@/generated/prisma/client";

/** A client that can be the real database or a transaction (a dry run is the
 * real import run inside a transaction that is rolled back). */
export type Db = PrismaClient | Prisma.TransactionClient;

export type ImportKind = "SUPPLIERS" | "CLIENTS" | "WORKERS" | "TIMESHEETS";

export type FieldDef = {
  key: string;
  label: string;
  required?: boolean;
  /** Other names this column goes by in the wild. */
  aliases?: string[];
  hint?: string;
};

export type ImportNote = { tone: "warn" | "info"; title: string; detail?: string };

export type RowReport = {
  /** Row number in the source sheet (header row is not counted as data). */
  row: number;
  name?: string;
  status: "created" | "updated" | "skipped" | "error";
  message?: string;
  notes?: ImportNote[];
};

/** Something in a timesheet file that can be corrected before it is imported. */
export type Fixable = {
  type: "rate" | "hours" | "nationality" | "field";
  /** For a worker field fix: which field, what to call it, why it was flagged and what kind of value it takes. */
  field?: string;
  label?: string;
  reason?: string;
  kind?: "country" | "gender" | "date" | "text" | "phone";
  /** The worker's employee code, as in the sheet. */
  id: string;
  name: string;
  /** Month key ("2026-09") the row is in; nationality belongs to the worker, not a month. */
  month?: string;
  monthLabel?: string;
  /** For an hours fix: the day. */
  date?: string;
  /** What the sheet has now. */
  current: string;
};

/** A correction the person typed in: replaces the value from the sheet when the import runs. */
export type Fix = { type: Fixable["type"]; id: string; month?: string; date?: string; field?: string; value: string };

/** What to do with a supplier name in the file that isn't on record yet. Nothing is added unless the person chose to. */
export type SupplierDecision = { action: "add"; name?: string } | { action: "existing"; supplierId: string } | { action: "ignore" };
export type NewSupplier = { key: string; name: string; role: "supplier" | "sponsor" | "both"; rows: number };

export type ApplyResult = {
  rows: RowReport[];
  counts: Record<string, number>;
  /** Things about the file as a whole (not tied to one row). */
  notes: ImportNote[];
  /** Problems that can be corrected on the review screen before importing. */
  fixables?: Fixable[];
  /** Supplier names in the file that aren't on record; each needs a decision before importing. */
  newSuppliers?: NewSupplier[];
  /** The suppliers already on record, to pick from. */
  existingSuppliers?: { id: string; name: string }[];
};

export type ApplyCtx = {
  db: Db;
  branchId: string;
  user: { id: string; name: string };
  /** False during a dry run: audit-log writes go to the real database and would outlive the rollback. */
  audit: boolean;
  progress?: (done: number, total: number) => void | Promise<void>;
};

/** One source row, already mapped to field keys. */
export type MappedRow = { row: number; values: Record<string, string> };

/** How the user (or the auto-detector) lined the file up with our fields. */
export type Mapping = {
  sheet?: string;
  headerRow?: number;
  /** field key -> the header text of the source column */
  columns: Record<string, string>;
};
