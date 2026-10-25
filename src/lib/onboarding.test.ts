import test from "node:test";
import assert from "node:assert/strict";
import { AFTER_ARRIVAL_STAGES, STAGES, STAGE_BY_KEY, computeReadyToJoin, currentStage, overallStatusLabel, papersApply, papersPending, pendingPapers, stagesFor, type OnboardingStatuses } from "./onboarding";

const base = (over: Partial<OnboardingStatuses> = {}): OnboardingStatuses => ({
  candidateType: "OVERSEAS",
  hireApprovalStatus: "Not Required", interviewStatus: "Not Required", clientApprovalStatus: "Not Required", permitTransferStatus: "Pending",
  offerStatus: "Accepted", wppStatus: "Completed", workPermitPaymentStatus: "Payment Completed", entryPermitStatus: "Received", arrivalStatus: "Arrived UAE",
  medicalStatus: "Pending", tawjeehStatus: "Pending", iloeStatus: "Pending", healthCardStatus: "Pending", eidBiometricsStatus: "Pending", contractStatus: "Pending", idVisaStatus: "Pending",
  ...over,
});

test("the pipeline ends at arrival; the papers that follow are listed separately", () => {
  assert.deepEqual(stagesFor("OVERSEAS").map((s) => s.key), ["HIRE_APPROVAL", "INTERVIEW", "CLIENT_APPROVAL", "OFFER", "WPP", "WORK_PERMIT_PAYMENT", "ENTRY_PERMIT", "ARRIVAL"]);
  assert.deepEqual(AFTER_ARRIVAL_STAGES.map((s) => s.key), ["MEDICAL", "TAWJEEH", "ILOE", "HEALTH_CARD", "EID_BIOMETRICS", "ID_VISA", "CONTRACT"]);
  assert.ok(STAGES.every((s) => !AFTER_ARRIVAL_STAGES.some((a) => a.key === s.key)));
});

test("an inside-UAE transfer has a permit transfer instead of entry permit and travel", () => {
  assert.deepEqual(stagesFor("INSIDE_UAE").map((s) => s.key), ["HIRE_APPROVAL", "INTERVIEW", "CLIENT_APPROVAL", "OFFER", "PERMIT_TRANSFER"]);
  assert.deepEqual(stagesFor(undefined).map((s) => s.key), stagesFor("OVERSEAS").map((s) => s.key));
});

test("an overseas hire is ready on arrival, whatever the post-arrival papers say", () => {
  assert.equal(computeReadyToJoin(base()), true);
  assert.equal(computeReadyToJoin(base({ arrivalStatus: "Flight Booked" })), false);
  assert.equal(computeReadyToJoin(base({ medicalStatus: "Unfit" })), true);
});

test("optional steps don't block until someone switches them on", () => {
  assert.equal(computeReadyToJoin(base({ clientApprovalStatus: "Pending" })), false);
  assert.equal(currentStage(base({ clientApprovalStatus: "Pending" }))?.key, "CLIENT_APPROVAL");
  assert.equal(computeReadyToJoin(base({ clientApprovalStatus: "Approved", interviewStatus: "Passed" })), true);
  assert.equal(computeReadyToJoin(base({ interviewStatus: "Failed" })), false);
});

test("an inside-UAE candidate is ready when the permit transfer completes, and travel steps are ignored", () => {
  const inside = base({ candidateType: "INSIDE_UAE", entryPermitStatus: "Pending", arrivalStatus: "Travel Pending", wppStatus: "Pending", workPermitPaymentStatus: "Pending" });
  assert.equal(computeReadyToJoin(inside), false);
  assert.equal(currentStage(inside)?.key, "PERMIT_TRANSFER");
  assert.equal(computeReadyToJoin({ ...inside, permitTransferStatus: "Completed" }), true);
  assert.equal(overallStatusLabel({ ...inside, permitTransferStatus: "Rejected", joined: false, readyToJoin: false }), "Blocked at Permit Transfer");
});

test("every step key can still be looked up, including the post-arrival ones", () => {
  for (const s of [...STAGES, ...AFTER_ARRIVAL_STAGES]) assert.equal(STAGE_BY_KEY[s.key], s);
});

const here = (over: Partial<OnboardingStatuses> = {}) => base({ arrivalStatus: "Arrived UAE", ...over });
const cleared = { medicalStatus: "Fit", idVisaStatus: "Completed", contractStatus: "Approved" };

test("arrival papers only matter once the person has arrived or joined", () => {
  assert.equal(papersApply({ ...base({ arrivalStatus: "Flight Booked" }), joined: false }), false);
  assert.equal(papersApply({ ...here(), joined: false }), true);
  assert.equal(papersApply({ ...base({ arrivalStatus: "Flight Booked" }), joined: true }), true);
});

test("papers are pending until medical is fit, the visa is stamped and the labour card is done", () => {
  assert.deepEqual(pendingPapers(here()).map((s) => s.key), ["MEDICAL", "ID_VISA", "CONTRACT"]);
  assert.equal(papersPending({ ...here(), joined: false }), true);
  assert.deepEqual(pendingPapers(here({ ...cleared, contractStatus: "Submitted" })).map((s) => s.key), ["CONTRACT"]);
  assert.equal(papersPending({ ...here(cleared), joined: true }), false);
});

test("an unfit medical keeps papers pending, and the other papers never hold them up", () => {
  assert.equal(papersPending({ ...here({ ...cleared, medicalStatus: "Unfit" }), joined: true }), true);
  assert.equal(papersPending({ ...here({ ...cleared, iloeStatus: "Pending", eidBiometricsStatus: "Pending" }), joined: true }), false);
});

test("a labour card marked Issued counts as done", () => {
  assert.equal(papersPending({ ...here({ ...cleared, contractStatus: "Issued" }), joined: true }), false);
});

test("a dropped candidate is never overdue and reads as Dropped; days pending count from the last stage change", async () => {
  const { isOverdue, overallStatusLabel, pendingSince } = await import("./onboarding");
  const old = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const row = { ...Object.fromEntries([...STAGES, ...AFTER_ARRIVAL_STAGES].map((s) => [s.field, s.statuses[0].value])), candidateType: "OVERSEAS", joined: false, readyToJoin: false } as never as Parameters<typeof isOverdue>[0];
  assert.equal(isOverdue(row, old), true);
  assert.equal(isOverdue({ ...row, dropped: true }, old), false);
  assert.equal(overallStatusLabel({ ...(row as object), dropped: true } as never), "Dropped");
  const recent = new Date();
  assert.equal(pendingSince({ lastStageChangeAt: recent, createdAt: old }), recent);
  assert.equal(pendingSince({ lastStageChangeAt: null, createdAt: old }), old);
});
