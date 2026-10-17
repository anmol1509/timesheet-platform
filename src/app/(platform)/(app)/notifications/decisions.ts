"use server";

import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { loadApprovals, type ApprovalKind } from "@/lib/approvals";

/** What the bell needs to show and decide one pending approval, without the page-sized detail the Approvals screen carries. */
export type BellDecision = {
  key: string;
  kind: ApprovalKind;
  id: string;
  ids?: string[];
  field?: string;
  title: string;
  subtitle: string;
  requester: string | null;
  amount: number | null;
  ageDays: number;
  href: string;
  /** Can be approved from the bell. Money-moving and hard-to-undo kinds ask for a confirmation, so they are reviewed on their own screen instead. */
  quickApprove: boolean;
};

/**
 * The oldest items waiting on this person, loaded when the bell opens rather than on every page. Only kinds the
 * person may decide are ever returned (the same filter the Approvals screen applies).
 */
export async function loadBellDecisionsAction(): Promise<{ items: BellDecision[]; total: number }> {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const all = await loadApprovals({ branchId, isSuperAdmin, subject: subjectOf(user), role: user.role });
  const now = Date.now();
  const items = all.slice(0, 5).map((i) => ({
    key: i.key,
    kind: i.kind,
    id: i.id,
    ids: i.ids,
    field: i.field,
    title: i.title,
    subtitle: i.subtitle,
    requester: i.requester,
    amount: i.amount,
    ageDays: Math.floor((now - i.at.getTime()) / 86_400_000),
    href: i.href,
    quickApprove: i.inline && !i.confirmApprove,
  }));
  return { items, total: all.length };
}
