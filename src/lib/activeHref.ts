/**
 * Whether a card or chart item points at what the page is already showing, so it can be marked as the active filter.
 * Pure (no router), so the cards, the charts and the tests all use the same rule.
 */

/** Address parameters that open or position something but don't filter the list. */
const NOT_FILTERS = new Set(["open", "tab", "renew", "registered", "page", "month"]);

const parse = (href: string) => {
  try {
    return new URL(href, "http://local");
  } catch {
    return null;
  }
};
const trimSlash = (p: string) => (p.length > 1 ? p.replace(/\/$/, "") : p);

/** Same page, and every filter the link sets is set the same way now. A link with no filters is active when none is set. */
export function hrefIsActive(href: string, pathname: string, search: URLSearchParams): boolean {
  const u = parse(href);
  if (!u || trimSlash(u.pathname) !== trimSlash(pathname)) return false;
  const want = [...u.searchParams.entries()].filter(([k]) => !NOT_FILTERS.has(k));
  if (want.length === 0) return [...search.keys()].filter((k) => !NOT_FILTERS.has(k)).length === 0;
  return want.every(([k, v]) => (search.get(k) ?? "").toLowerCase() === v.toLowerCase());
}

/** Where clicking an active item goes: the same page with the filters it set taken off, so a second click clears it. */
export function clearedHref(href: string, pathname: string, search: URLSearchParams): string {
  const u = parse(href);
  const next = new URLSearchParams(search.toString());
  for (const k of u?.searchParams.keys() ?? []) next.delete(k);
  const q = next.toString();
  return q ? `${pathname}?${q}` : pathname;
}
