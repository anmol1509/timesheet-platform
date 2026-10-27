/** Time shown on the screens of long jobs (imports, bulk uploads). Pure, so it can be tested. */

/** "1:05" for elapsed time. */
export function clock(ms: number): string {
  const t = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

/**
 * What is left, from how fast it has gone so far. Blank until there is enough progress (two items and eight seconds) to estimate
 * honestly, and when it is finished.
 */
export function timeLeft(startedAt: number, done: number, total: number, now: number = Date.now()): string | null {
  const elapsed = now - startedAt;
  if (done < 2 || elapsed < 8000 || done >= total) return null;
  const secs = ((elapsed / done) * (total - done)) / 1000;
  return secs < 60 ? "less than a minute left" : `about ${Math.round(secs / 60)} min left`;
}
