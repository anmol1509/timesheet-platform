import assert from "node:assert/strict";
import { test } from "node:test";
import { STAGES, AFTER_ARRIVAL_STAGES, type OnboardingStatuses } from "./onboarding";
import { agencyStats, type AgencyCandidate } from "./agencyStats";

const pending = Object.fromEntries([...STAGES, ...AFTER_ARRIVAL_STAGES].map((s) => [s.field, s.statuses[0].value])) as unknown as OnboardingStatuses;
const day = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
const make = (o: Partial<AgencyCandidate>): AgencyCandidate => ({
  ...pending, candidateType: "OVERSEAS", joined: false, readyToJoin: false, droppedAt: null, createdAt: day(1), joiningDate: null, lastStageChangeAt: null, ...o,
});

test("counts joined, dropped and live candidates, and the success rate over decided ones", () => {
  const s = agencyStats([
    make({ joined: true, joiningDate: day(0), createdAt: day(20) }),
    make({ joined: true, joiningDate: day(0), createdAt: day(30) }),
    make({ droppedAt: day(2) }),
    make({}),
  ]);
  assert.equal(s.submitted, 4);
  assert.equal(s.joined, 2);
  assert.equal(s.dropped, 1);
  assert.equal(s.inProgress, 1);
  assert.equal(s.successRate, 67);
  assert.equal(s.avgDaysToJoin, 25);
});

test("no outcome yet means no rate; dropped candidates are never overdue", () => {
  const s = agencyStats([make({ createdAt: day(60), lastStageChangeAt: day(60) }), make({ droppedAt: day(1), createdAt: day(60), lastStageChangeAt: day(60) })]);
  assert.equal(s.overdue, 1);
  assert.equal(s.successRate, 0);
  assert.equal(agencyStats([make({})]).successRate, null);
  assert.equal(agencyStats([]).avgDaysToJoin, null);
});
