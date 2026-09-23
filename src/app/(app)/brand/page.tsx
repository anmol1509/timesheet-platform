import { cookies } from "next/headers";
import { BrandClient } from "./brand-client";
import { THEME_COOKIE, isThemePreference, type ThemePreference } from "@/lib/theme-preference";

/** Design-system reference for tokens, motion and the shared UI primitives. Behind auth, like every other (app) route. */
export default async function BrandPage() {
  const cookieStore = await cookies();
  const themeCookieValue = cookieStore.get(THEME_COOKIE)?.value;
  const initialTheme: ThemePreference = isThemePreference(themeCookieValue)
    ? themeCookieValue
    : "system";

  return <BrandClient initialTheme={initialTheme} />;
}
