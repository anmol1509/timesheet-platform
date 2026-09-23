/**
 * Name of the cookie holding the explicit light/dark override. Same pattern
 * as SIDEBAR_COOKIE ((app)/sidebar-preference.ts): read server-side in the
 * root layout so the first paint already has the right `data-theme`
 * attribute — no client mount effect, no flash. Absent (or "system") means
 * "follow the OS/browser preference", handled purely in CSS
 * (@media prefers-color-scheme) with no attribute needed.
 */
export const THEME_COOKIE = "theme";

export type ThemePreference = "light" | "dark" | "system";

export function isThemePreference(value: string | undefined): value is "light" | "dark" {
  return value === "light" || value === "dark";
}
