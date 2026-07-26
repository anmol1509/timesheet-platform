// Leave: first 2 leave days in a month are free; each leave day from the
// 3rd onward costs AED 30.
const FREE_LEAVE_DAYS = 2;
const LEAVE_DEDUCTION_PER_DAY = 30;

// Gas/camp: AED 1 per day the employee is present at camp (i.e. not on
// leave that month).
const GAS_DEDUCTION_PER_DAY = 1;

export function calculateAbsentDeduction(absentCount: number): number {
  return Math.max(0, absentCount - FREE_LEAVE_DAYS) * LEAVE_DEDUCTION_PER_DAY;
}

// A blank cell means the employee wasn't on the roster that day (joined or
// left mid-month) — not at camp, so no gas charge. "A" (leave) also isn't
// charged, since they weren't at camp that day either. Everything else
// (worked hours, "OFF") counts as a day present at camp.
export function calculateGasDeduction(dailyHours: { value: string }[]): number {
  const daysAtCamp = dailyHours.filter(
    (d) => d.value !== "" && !/^a$/i.test(d.value)
  ).length;
  return daysAtCamp * GAS_DEDUCTION_PER_DAY;
}
