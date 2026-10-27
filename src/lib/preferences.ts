/**
 * A person's own look-and-feel choices. They are kept on the account (so they follow the person to any device) and
 * mirrored in plain cookies so the server can paint the first frame correctly, with no flash. Nothing here carries
 * any authority: a tampered cookie can only change how the page looks.
 */
export const THEMES = ["light", "dark", "system"] as const;
export type Theme = (typeof THEMES)[number];

export const ACCENTS = [
  { key: "purple", label: "Purple", light: "#5645d4" },
  { key: "blue", label: "Blue", light: "#2563eb" },
  { key: "teal", label: "Teal", light: "#0f766e" },
  { key: "green", label: "Green", light: "#15803d" },
  { key: "orange", label: "Orange", light: "#c2410c" },
  { key: "pink", label: "Pink", light: "#be185d" },
  { key: "slate", label: "Slate", light: "#475569" },
] as const;
export type Accent = (typeof ACCENTS)[number]["key"];

export const DENSITIES = ["comfortable", "compact"] as const;
export type Density = (typeof DENSITIES)[number];

export const TEXT_SIZES = ["small", "normal", "large"] as const;
export type TextSize = (typeof TEXT_SIZES)[number];

export const SIDEBARS = ["open", "icons"] as const;
export type SidebarMode = (typeof SIDEBARS)[number];

/** How the main menu is laid out. Every layout lists the same pages; phones always get the slide-out menu. */
export const LAYOUTS = [
  { key: "classic", label: "Classic", hint: "Full sidebar with groups" },
  { key: "rail", label: "Icon rail", hint: "Icons only, pages open in a flyout" },
  { key: "search", label: "Search first", hint: "Search box and pinned pages on top" },
  { key: "topbar", label: "Top bar", hint: "No sidebar, menu across the top" },
  { key: "twolevel", label: "Two-level", hint: "Icon rail plus a pages column" },
  { key: "tabs", label: "Modules and tabs", hint: "Module list, pages as tabs" },
] as const;
export type LayoutKey = (typeof LAYOUTS)[number]["key"];

/** Where a person lands after signing in. Only pages they are allowed to open are offered or followed. */
export const START_PAGES = [
  { href: "/", label: "Dashboard" },
  { href: "/approvals", label: "Approvals" },
  { href: "/employees", label: "Employees" },
  { href: "/timesheets", label: "Timesheets" },
  { href: "/payroll", label: "Payroll" },
  { href: "/invoices/history", label: "Invoices" },
  { href: "/finance/books", label: "Accounting" },
  { href: "/projects", label: "Projects" },
  { href: "/demand", label: "Demand" },
] as const;

export type Preferences = {
  theme: Theme;
  accent: Accent;
  density: Density;
  textSize: TextSize;
  sidebar: SidebarMode;
  layout: LayoutKey;
  startPage: string;
};

export const DEFAULT_PREFERENCES: Preferences = { theme: "light", accent: "purple", density: "comfortable", textSize: "normal", sidebar: "open", layout: "classic", startPage: "/" };

export const THEME_COOKIE = "theme";
export const ACCENT_COOKIE = "accent";
export const DENSITY_COOKIE = "density";
export const TEXT_COOKIE = "textsize";
export const LAYOUT_COOKIE = "layout";

const pick = <T extends string>(allowed: readonly T[], v: unknown, fallback: T): T => (typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback);

/** Reads stored or typed preferences defensively: anything unknown falls back to the default. */
export function parsePreferences(raw: unknown): Preferences {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_PREFERENCES;
  return {
    theme: pick(THEMES, r.theme, d.theme),
    accent: pick(ACCENTS.map((a) => a.key), r.accent, d.accent),
    density: pick(DENSITIES, r.density, d.density),
    textSize: pick(TEXT_SIZES, r.textSize, d.textSize),
    sidebar: pick(SIDEBARS, r.sidebar, d.sidebar),
    layout: pick(LAYOUTS.map((l) => l.key), r.layout, d.layout),
    startPage: typeof r.startPage === "string" && START_PAGES.some((p) => p.href === r.startPage) ? r.startPage : d.startPage,
  };
}

/** The attributes the root element carries so the stylesheet can apply these choices. */
export function htmlAttributes(p: Pick<Preferences, "theme" | "accent" | "density" | "textSize">) {
  return {
    "data-theme": p.theme,
    ...(p.accent !== "purple" ? { "data-accent": p.accent } : {}),
    ...(p.density !== "comfortable" ? { "data-density": p.density } : {}),
    ...(p.textSize !== "normal" ? { "data-text": p.textSize } : {}),
  } as Record<string, string>;
}
