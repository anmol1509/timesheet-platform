// Spread into a Prisma `where` clause for every branch-scoped list query.
// null branchId (SUPER_ADMIN viewing "all branches") means no filter.
export function branchWhere(branchId: string | null) {
  return branchId ? { branchId } : {};
}

// Guard for [id] detail pages after `findUnique`: Prisma can't express
// "this row's branchId must match the caller's branch" as part of a
// findUnique-by-id lookup, so every detail page checks this explicitly.
export function isOutsideBranch(
  recordBranchId: string | null | undefined,
  branchId: string | null,
  isSuperAdmin: boolean
) {
  if (isSuperAdmin) return false;
  return recordBranchId !== branchId;
}
