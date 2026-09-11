// Same gradient-initials treatment as the dashboard's AssignedStaffList,
// reused wherever a person needs a lightweight visual identity without a
// photo (accommodation rosters, bed tiles).
export const AVATAR_GRADIENTS = [
  "from-rose-400 to-rose-600",
  "from-amber-400 to-amber-600",
  "from-sky-400 to-sky-600",
  "from-violet-400 to-violet-600",
  "from-emerald-400 to-emerald-600",
  "from-fuchsia-400 to-fuchsia-600",
];

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
}

// Deterministic on the name itself (not array index), so the same person's
// avatar colour doesn't shift as a list is filtered or reordered.
export function avatarGradient(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
}
