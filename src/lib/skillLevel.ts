/**
 * The proficiency scale for a worker's skill, shared by the registration
 * wizard and the employee page.
 *
 * Both screens set the same `EmployeeSkill.proficiencyPercent`, so they need
 * the same range and the same words for it — otherwise "50%" set at
 * registration and "50" typed later mean different things to whoever reads the
 * roster.
 */
export const SKILL_LEVEL_MIN = 10;
export const SKILL_LEVEL_MAX = 100;
export const SKILL_LEVEL_STEP = 10;
export const DEFAULT_SKILL_LEVEL = 50;

/** Plain-language band, so the number isn't the only thing carrying meaning. */
export function skillLevelLabel(level: number) {
  if (level <= 20) return "Beginner";
  if (level <= 40) return "Basic";
  if (level <= 60) return "Competent";
  if (level <= 80) return "Skilled";
  return "Expert";
}

/** Clamps anything arriving from a form onto the scale. */
export function clampSkillLevel(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_SKILL_LEVEL;
  return Math.min(SKILL_LEVEL_MAX, Math.max(SKILL_LEVEL_MIN, Math.round(n)));
}
