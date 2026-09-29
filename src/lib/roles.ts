/**
 * Whether a role is an administrator: a super admin, or a branch admin.
 *
 * A client's admin is a branch admin and is the highest authority inside their
 * own company — there is nobody above them to "ask". Rules like overriding an
 * approved-and-locked attendance day or timesheet row therefore belong to every
 * admin, not only the platform owner. That is separate from branch containment,
 * which is enforced with isOutsideBranch: an admin can override locks inside
 * their own branch and nowhere else.
 */
export function isAdminRole(role: string): boolean {
  return role === "SUPER_ADMIN" || role === "BRANCH_ADMIN";
}
