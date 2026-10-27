import { cookies } from "next/headers";
import { ACCENT_COOKIE, DENSITY_COOKIE, LAYOUT_COOKIE, TEXT_COOKIE, THEME_COOKIE, type Preferences } from "@/lib/preferences";
import { SIDEBAR_COOKIE } from "@/app/(platform)/(app)/sidebar-preference";
import { can, moduleForPath, type PermissionSubject } from "@/lib/permissions";

const YEAR = 60 * 60 * 24 * 365;

/** Writes the cookies the server reads to paint the first frame in the person's own look. */
export async function writePreferenceCookies(p: Preferences) {
  const jar = await cookies();
  const opts = { path: "/", maxAge: YEAR, sameSite: "lax" as const };
  jar.set(THEME_COOKIE, p.theme, opts);
  jar.set(ACCENT_COOKIE, p.accent, opts);
  jar.set(DENSITY_COOKIE, p.density, opts);
  jar.set(TEXT_COOKIE, p.textSize, opts);
  jar.set(LAYOUT_COOKIE, p.layout, opts);
  jar.set(SIDEBAR_COOKIE, p.sidebar === "icons" ? "1" : "0", opts);
}

/** Whether a person may open a page, using the same module rules as the pages themselves. */
export function canOpenPage(subject: PermissionSubject, href: string): boolean {
  const mod = moduleForPath(href);
  return mod === null || can(subject, mod, "view");
}
