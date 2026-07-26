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

export function calculateGasDeduction(dayCount: number, absentCount: number): number {
  return Math.max(0, dayCount - absentCount) * GAS_DEDUCTION_PER_DAY;
}
