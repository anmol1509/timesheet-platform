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

export const NAV_STYLES = [
  { key: "glass", label: "Floating glass" },
  { key: "flat", label: "Flat white" },
  { key: "dark", label: "Dark" },
  { key: "brand", label: "Brand colour" },
] as const;
export type NavStyle = (typeof NAV_STYLES)[number]["key"];

export const FONTS = [
  { key: "dm", label: "DM Sans (default)" },
  { key: "jakarta", label: "Plus Jakarta Sans" },
  { key: "inter", label: "Inter" },
  { key: "system", label: "Your device's own font" },
  { key: "serif", label: "Serif" },
] as const;
export type FontKey = (typeof FONTS)[number]["key"];

export const BACKGROUNDS = [
  { key: "glow", label: "Colour glow" },
  { key: "soft", label: "Soft tint" },
  { key: "plain", label: "Plain" },
] as const;
export type Background = (typeof BACKGROUNDS)[number]["key"];

export const CORNERS = [
  { key: "sharp", label: "Sharp" },
  { key: "default", label: "Default" },
  { key: "round", label: "Round" },
] as const;
export type Corners = (typeof CORNERS)[number]["key"];

export const HEX_RE = /^#[0-9a-fA-F]{6}$/;

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
  layout: LayoutKey;
  navStyle: NavStyle;
  /** Slide the menu out of the way until the pointer reaches the left edge (Classic, Search first, Modules and tabs). */
  autoHide: boolean;
  font: FontKey;
  /** Own accent colour as #rrggbb; empty uses the accent chosen above. */
  accentHex: string;
  background: Background;
  corners: Corners;
  reduceMotion: boolean;
  highContrast: boolean;
  startPage: string;
};

export const DEFAULT_PREFERENCES: Preferences = { theme: "light", accent: "purple", density: "comfortable", textSize: "normal", layout: "classic", navStyle: "glass", autoHide: false, font: "dm", accentHex: "", background: "glow", corners: "default", reduceMotion: false, highContrast: false, startPage: "/" };

export const THEME_COOKIE = "theme";
export const ACCENT_COOKIE = "accent";
export const DENSITY_COOKIE = "density";
export const TEXT_COOKIE = "textsize";
export const LAYOUT_COOKIE = "layout";
/** The newer look choices (menu colour, font, corners …) travel in one cookie as JSON. */
export const LOOK_COOKIE = "look";

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
    // An older "icons only" sidebar choice becomes the Icon rail layout.
    layout: pick(LAYOUTS.map((l) => l.key), r.layout ?? (r.sidebar === "icons" ? "rail" : undefined), d.layout),
    navStyle: pick(NAV_STYLES.map((n) => n.key), r.navStyle, d.navStyle),
    autoHide: r.autoHide === true,
    font: pick(FONTS.map((f) => f.key), r.font, d.font),
    accentHex: typeof r.accentHex === "string" && HEX_RE.test(r.accentHex) ? r.accentHex.toLowerCase() : "",
    background: pick(BACKGROUNDS.map((b) => b.key), r.background, d.background),
    corners: pick(CORNERS.map((c) => c.key), r.corners, d.corners),
    reduceMotion: r.reduceMotion === true,
    highContrast: r.highContrast === true,
    startPage: typeof r.startPage === "string" && START_PAGES.some((p) => p.href === r.startPage) ? r.startPage : d.startPage,
  };
}

/** The look choices carried in the "look" cookie. */
export type Look = Pick<Preferences, "navStyle" | "autoHide" | "font" | "accentHex" | "background" | "corners" | "reduceMotion" | "highContrast">;
export const lookOf = (p: Look): Look => ({ navStyle: p.navStyle, autoHide: p.autoHide, font: p.font, accentHex: p.accentHex, background: p.background, corners: p.corners, reduceMotion: p.reduceMotion, highContrast: p.highContrast });

/** Reads the "look" cookie; anything unreadable gives the defaults. */
export function parseLook(raw: string | undefined): Look {
  let obj: unknown = {};
  try { obj = raw ? JSON.parse(raw) : {}; } catch { /* default look */ }
  return lookOf(parsePreferences(obj));
}

/** The attributes the root element carries so the stylesheet can apply these choices. */
export function htmlAttributes(p: Pick<Preferences, "theme" | "accent" | "density" | "textSize"> & Partial<Look>) {
  const d = DEFAULT_PREFERENCES;
  return {
    "data-theme": p.theme,
    ...(p.accentHex ? { "data-accent": "custom" } : p.accent !== "purple" ? { "data-accent": p.accent } : {}),
    ...(p.density !== "comfortable" ? { "data-density": p.density } : {}),
    ...(p.textSize !== "normal" ? { "data-text": p.textSize } : {}),
    ...(p.navStyle && p.navStyle !== d.navStyle ? { "data-navstyle": p.navStyle } : {}),
    ...(p.font && p.font !== d.font ? { "data-font": p.font } : {}),
    ...(p.background && p.background !== d.background ? { "data-bg": p.background } : {}),
    ...(p.corners && p.corners !== d.corners ? { "data-corners": p.corners } : {}),
    ...(p.reduceMotion ? { "data-motion": "reduce" } : {}),
    ...(p.highContrast ? { "data-contrast": "high" } : {}),
  } as Record<string, string>;
}

/** Inline style for the root element: only the own-colour accent needs one. */
export const htmlStyle = (p: Partial<Pick<Preferences, "accentHex">>) => (p.accentHex ? ({ "--accent": p.accentHex } as Record<string, string>) : undefined);
