import test from "node:test";
import assert from "node:assert/strict";
import { AFTER_ARRIVAL_STAGES, STAGES, STAGE_BY_KEY, computeReadyToJoin, currentStage, overallStatusLabel, stagesFor, type OnboardingStatuses } from "./onboarding";

const base = (over: Partial<OnboardingStatuses> = {}): OnboardingStatuses => ({
  candidateType: "OVERSEAS",
  hireApprovalStatus: "Not Required", interviewStatus: "Not Required", clientApprovalStatus: "Not Required", permitTransferStatus: "Pending",
  offerStatus: "Accepted", wppStatus: "Completed", workPermitPaymentStatus: "Payment Completed", entryPermitStatus: "Received", arrivalStatus: "Arrived UAE",
  medicalStatus: "Pending", tawjeehStatus: "Pending", iloeStatus: "Pending", contractStatus: "Pending", idVisaStatus: "Pending",
  ...over,
});

test("the pipeline ends at arrival; the papers that follow are listed separately", () => {
  assert.deepEqual(stagesFor("OVERSEAS").map((s) => s.key), ["HIRE_APPROVAL", "INTERVIEW", "CLIENT_APPROVAL", "OFFER", "WPP", "WORK_PERMIT_PAYMENT", "ENTRY_PERMIT", "ARRIVAL"]);
  assert.deepEqual(AFTER_ARRIVAL_STAGES.map((s) => s.key), ["MEDICAL", "TAWJEEH", "ILOE", "CONTRACT", "ID_VISA"]);
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
