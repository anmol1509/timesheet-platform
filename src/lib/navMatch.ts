/** Whether `pathname` is `pattern` or sits under it. A `*` in the pattern stands for one path segment (an id), so
 * "/demand/*\/mobilise" matches "/demand/abc123/mobilise" and anything below it. */
export function pathMatches(pathname: string, pattern: string): boolean {
  if (!pattern.includes("*")) return pathname === pattern || pathname.startsWith(pattern + "/");
  const want = pattern.split("/");
  const have = pathname.split("/");
  if (have.length < want.length) return false;
  return want.every((seg, i) => (seg === "*" ? have[i] !== "" : seg === have[i]));
}
