import { isOverdue, papersPending, pendingSince, type OnboardingStatuses } from "@/lib/onboarding";

/** What an agency's candidates add up to. Pure, so the Agencies page, the Excel sheets and the tests share one set of numbers. */
export type AgencyCandidate = OnboardingStatuses & {
  joined: boolean;
  readyToJoin: boolean;
  droppedAt: Date | null;
  createdAt: Date;
  joiningDate: Date | null;
  lastStageChangeAt: Date | null;
};

export type AgencyStats = {
  submitted: number;
  /** Still moving: not joined, not dropped. */
  inProgress: number;
  ready: number;
  overdue: number;
  papersPending: number;
  joined: number;
  dropped: number;
  /** Joined as a share of those whose outcome is known (joined or dropped), whole percent; null until there is one. */
  successRate: number | null;
  /** Average days from being added to joining, over those who joined; null if none. */
  avgDaysToJoin: number | null;
};

const DAY = 24 * 60 * 60 * 1000;

export function agencyStats(candidates: AgencyCandidate[]): AgencyStats {
  const joined = candidates.filter((c) => c.joined);
  const dropped = candidates.filter((c) => c.droppedAt && !c.joined);
  const live = candidates.filter((c) => !c.joined && !c.droppedAt);
  const decided = joined.length + dropped.length;
  const spans = joined.filter((c) => c.joiningDate).map((c) => Math.max(0, (c.joiningDate!.getTime() - c.createdAt.getTime()) / DAY));
  return {
    submitted: candidates.length,
    inProgress: live.length,
    ready: live.filter((c) => c.readyToJoin).length,
    overdue: live.filter((c) => isOverdue({ ...c, dropped: false }, pendingSince(c))).length,
    papersPending: candidates.filter((c) => !c.droppedAt && papersPending(c)).length,
    joined: joined.length,
    dropped: dropped.length,
    successRate: decided ? Math.round((joined.length / decided) * 100) : null,
    avgDaysToJoin: spans.length ? Math.round(spans.reduce((a, b) => a + b, 0) / spans.length) : null,
  };
}
