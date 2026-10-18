/**
 * Page margins for printed letters, in millimetres.
 *
 * Plain paper carries no header from us, so it needs margins on all four sides. A pre-printed letterhead keeps
 * its own top and bottom clearance (set per company or supplier) and gains left and right.
 */
export type Margins = { top: number; bottom: number; left: number; right: number };

export const DEFAULT_PLAIN: Margins = { top: 25, bottom: 25, left: 25, right: 25 };
export const DEFAULT_SIDE_ON_LETTERHEAD = 18;

export const MARGIN_LIMITS = { plain: { min: 10, max: 60 }, side: { min: 10, max: 50 } } as const;

export const MARGIN_BRANCH_SELECT = {
  plainTopMm: true, plainBottomMm: true, plainLeftMm: true, plainRightMm: true, letterheadLeftMm: true, letterheadRightMm: true,
} as const;

type BranchMargins = { plainTopMm?: number | null; plainBottomMm?: number | null; plainLeftMm?: number | null; plainRightMm?: number | null; letterheadLeftMm?: number | null; letterheadRightMm?: number | null };

/** The company's margin settings, with the standard values where none were saved. */
export function marginsOfBranch(b: BranchMargins | null | undefined): { plain: Margins; letterheadSides: { left: number; right: number } } {
  return {
    plain: { top: b?.plainTopMm ?? DEFAULT_PLAIN.top, bottom: b?.plainBottomMm ?? DEFAULT_PLAIN.bottom, left: b?.plainLeftMm ?? DEFAULT_PLAIN.left, right: b?.plainRightMm ?? DEFAULT_PLAIN.right },
    letterheadSides: { left: b?.letterheadLeftMm ?? DEFAULT_SIDE_ON_LETTERHEAD, right: b?.letterheadRightMm ?? DEFAULT_SIDE_ON_LETTERHEAD },
  };
}

/** Whole millimetres inside [min, max], or null when the value is not a number. */
export function clampMargin(v: unknown, min: number, max: number): number | null {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : null;
}

const MM = 72 / 25.4;
/** Millimetres to PDF points. */
export const mmToPt = (mm: number) => mm * MM;
