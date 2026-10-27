"use client";

import { StatusRow, type StatusItem } from "@/components/StatusRow";

export type { StatusItem };

/** The payroll run's status row: the four steps, what to do now, and a chip for each thing needing attention. */
export function RunStatus({ step, lead, leadTone, items }: { step: 0 | 1 | 2 | 3 | 4; lead: string; leadTone: "go" | "stop" | "wait" | "done"; items: StatusItem[] }) {
  return <StatusRow steps={{ labels: ["Review", "Submit", "Approve", "Pay"], current: step }} lead={lead} leadTone={leadTone} items={items} label="Where this run stands" />;
}
