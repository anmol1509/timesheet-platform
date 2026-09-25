/**
 * Name of the cookie holding the explicit light/dark override. Same pattern
 * as SIDEBAR_COOKIE ((app)/sidebar-preference.ts): read server-side in the
 * root layout so the first paint already has the right `data-theme`
 * attribute — no client mount effect, no flash. Absent means light — the app
 * no longer follows the OS/browser preference by default (see the root
 * layout); only an explicit ThemeToggle choice switches it.
 */
export const THEME_COOKIE = "theme";

/** "system" is accepted for backward compatibility with any cookie already
 * carrying that value; `isThemePreference` treats it as unset (-> light) and
 * ThemeToggle no longer offers it as a choice. */
export type ThemePreference = "light" | "dark" | "system";

export function isThemePreference(value: string | undefined): value is "light" | "dark" {
  return value === "light" || value === "dark";
}
