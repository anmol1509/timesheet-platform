/**
 * Name of the cookie holding the light/dark/system choice. Same pattern as SIDEBAR_COOKIE ((app)/sidebar-preference.ts):
 * read server-side in the root layout so the first paint already has the right `data-theme` attribute, with no flash.
 * "system" follows the device through the `prefers-color-scheme` rules in foundation.css (they apply whenever the
 * attribute is not "light" or "dark"). Absent means light.
 */
export const THEME_COOKIE = "theme";

export type ThemePreference = "light" | "dark" | "system";

export function isThemePreference(value: string | undefined): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}
