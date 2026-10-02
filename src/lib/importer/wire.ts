// Shapes that travel between the import API and its screens. Types only, so a
// client component can import them without pulling in server code.
import type { TimesheetOverrides, TimesheetSheetInfo } from "@/lib/parseTimesheet";
import type { DeploymentRow, Fix, Fixable, ImportKind, Mapping, NewSupplier, RowReport, ImportNote, SupplierDecision, WorkerChoice, PlacementIssue, PlacementRow } from "./types";
import type { SheetInfo } from "./sheet";

export type StoredMapping = Mapping & {
  timesheetOverrides?: TimesheetOverrides;
  /** Names in the sheet that mean a company or client already on file, e.g. "AL NOOR MANPOWER SUPPLY LLC" -> "Al Noor Manpower Supply". */
  aliases?: Record<string, string>;
  /** Corrections typed in on the review screen, applied to the file when the import runs. */
  fixes?: Fix[];
  /** What to do with each new supplier name, keyed by NewSupplier.key. */
  supplierDecisions?: Record<string, SupplierDecision>;
  /** Camp imports: what to do with each worker name that needed a decision, keyed by PlacementIssue.key. */
  workerDecisions?: Record<string, WorkerChoice>;
  /** Camp imports: choices for files that name no camp or bed counts. */
  campOptions?: { campName?: string; autoBeds?: "bunks" | "singles" | "none" };
  /** Mobilisation imports: the date to use for rows that have none. */
  mobilisationOptions?: { defaultDate?: string };
};

export type Analysis =
  | {
      kind: Exclude<ImportKind, "TIMESHEETS">;
      sheets: SheetInfo[];
      sheet: string;
      headerRow: number;
      columns: Record<string, string>;
      matches: { header: string; field: string | null; confidence: number }[];
    }
  | { kind: "TIMESHEETS"; sheets: TimesheetSheetInfo[] };

export type BatchSummary = {
  counts: Record<string, number>;
  notes: ImportNote[];
  rows: RowReport[];
  totalRows: number;
  truncated: boolean;
  fixables?: Fixable[];
  newSuppliers?: NewSupplier[];
  existingSuppliers?: { id: string; name: string }[];
  existingClients?: { id: string; name: string }[];
  existingProjects?: { id: string; name: string }[];
  deployments?: DeploymentRow[];
  placementIssues?: PlacementIssue[];
  placements?: PlacementRow[];
  undo?: { restored: number; removed: number; kept: number };
};

export type BatchStatus = {
  id: string;
  kind: ImportKind;
  filename: string;
  status: "DRAFT" | "PREVIEWED" | "RUNNING" | "DONE" | "FAILED" | "UNDONE";
  progressDone: number;
  progressTotal: number;
  error: string | null;
  undoUntil: string | null;
  summary: BatchSummary | null;
};
