// Shapes that travel between the import API and its screens. Types only, so a
// client component can import them without pulling in server code.
import type { TimesheetOverrides, TimesheetSheetInfo } from "@/lib/parseTimesheet";
import type { ImportKind, Mapping, RowReport, ImportNote } from "./types";
import type { SheetInfo } from "./sheet";

export type StoredMapping = Mapping & { timesheetOverrides?: TimesheetOverrides };

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
