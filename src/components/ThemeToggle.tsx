"use client";

import { useState } from "react";
import { Moon, Sun, SunMoon } from "lucide-react";
import { cn } from "@/lib/cn";
import { THEME_COOKIE, type ThemePreference } from "@/lib/theme-preference";

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: SunMoon },
];

/** Plain module-level helper (not a component/hook) so the DOM writes it
 * does are unambiguously outside any render path. */
function writeThemePreference(next: ThemePreference) {
  if (next === "system") {
    document.documentElement.removeAttribute("data-theme");
    document.cookie = `${THEME_COOKIE}=;path=/;max-age=0;samesite=lax`;
  } else {
    document.documentElement.setAttribute("data-theme", next);
    document.cookie = `${THEME_COOKIE}=${next};path=/;max-age=31536000;samesite=lax`;
  }
}

/**
 * Three-way light/dark/system switch. `initial` comes from the server (the
 * theme cookie, read in the app layout — same pattern as the sidebar collapse
 * preference), so the first paint already matches and there's no mount
 * effect or flash. Writes both the `data-theme` attribute and the cookie on
 * change.
 */
export function ThemeToggle({
  initial,
  className,
}: {
  initial: ThemePreference;
  className?: string;
}) {
  const [value, setValue] = useState<ThemePreference>(initial);

  function apply(next: ThemePreference) {
    setValue(next);
    writeThemePreference(next);
  }

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={cn("flex items-center gap-0.5 rounded-control bg-surface-sunken p-0.5", className)}
    >
      {OPTIONS.map(({ value: v, label, icon: Icon }) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          aria-label={label}
          onClick={() => apply(v)}
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-sm transition",
            value === v
              ? "bg-surface text-primary shadow-xs"
              : "text-subtle hover:text-secondary"
          )}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </button>
      ))}
    </div>
  );
}
