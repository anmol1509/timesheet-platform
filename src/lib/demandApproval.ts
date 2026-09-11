/**
 * How much of a demand line has been agreed.
 *
 * Approval used to be a yes/no on the whole line, so asking for ten masons and
 * being given six could only be recorded as ten. `approvedQuantity` is the
 * number of heads actually agreed: null while nobody has decided, 0 once the
 * line has been refused, and anything up to the requested quantity otherwise.
 */

export type ApprovalState = "PENDING" | "REFUSED" | "PARTIAL" | "FULL";

export type ApprovableLine = {
  quantity: number;
  approvedQuantity: number | null;
};

export function approvalStateOf(line: ApprovableLine): ApprovalState {
  if (line.approvedQuantity === null) return "PENDING";
  if (line.approvedQuantity <= 0) return "REFUSED";
  return line.approvedQuantity >= line.quantity ? "FULL" : "PARTIAL";
}

/**
 * How many workers this line may actually take.
 *
 * Nothing may be mobilised against a line nobody has agreed, and an agreed line
 * is capped at what was agreed rather than what was asked for — that cap is the
 * whole point of approving a number instead of a flag. Never more than the
 * request itself, in case a stored value has drifted above it.
 */
export function approvedHeadcount(line: ApprovableLine): number {
  if (line.approvedQuantity === null) return 0;
  return Math.max(0, Math.min(line.approvedQuantity, line.quantity));
}

export function isApproved(line: ApprovableLine): boolean {
  return approvedHeadcount(line) > 0;
}

export const APPROVAL_LABEL: Record<ApprovalState, string> = {
  PENDING: "Not approved",
  REFUSED: "Refused",
  PARTIAL: "Part approved",
  FULL: "Approved",
};

export const APPROVAL_COLOR: Record<ApprovalState, "green" | "amber" | "slate" | "red"> = {
  PENDING: "slate",
  REFUSED: "red",
  PARTIAL: "amber",
  FULL: "green",
};

/** "6 of 10 approved", or the plain state when there is no number to show. */
export function approvalSummary(line: ApprovableLine): string {
  const state = approvalStateOf(line);
  if (state === "PENDING") return "Awaiting approval";
  if (state === "REFUSED") return "Refused";
  return `${approvedHeadcount(line)} of ${line.quantity} approved`;
}

/**
 * Whether a proposed approved quantity can be saved.
 *
 * Cutting an approval below the number already mobilised would leave workers
 * committed to something no longer agreed, which is the same objection the old
 * Unapprove button raised — it just has a number to check against now.
 */
export function validateApproval(
  next: number,
  line: ApprovableLine & { allocatedCount: number }
): { ok: true; value: number } | { ok: false; error: string } {
  if (!Number.isInteger(next) || next < 0) {
    return { ok: false, error: "Approve a whole number of workers, or zero to refuse." };
  }
  if (next > line.quantity) {
    return { ok: false, error: `Only ${line.quantity} were requested.` };
  }
  if (next < line.allocatedCount) {
    return {
      ok: false,
      error:
        `${line.allocatedCount} worker(s) are already mobilised on this line — ` +
        `remove ${line.allocatedCount - next} before cutting the approval to ${next}.`,
    };
  }
  return { ok: true, value: next };
}
