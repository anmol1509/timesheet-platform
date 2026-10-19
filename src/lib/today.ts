/** Today's date in the UAE as "YYYY-MM-DD" (a form default must not be yesterday between midnight and 4am). */
export function todayInUae(now: Date = new Date()): string {
  return new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
