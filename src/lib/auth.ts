import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/session";
import {
  can,
  canWrite,
  moduleForPath,
  type PermissionAction,
  type PermissionSubject,
} from "@/lib/permissions";

export async function getCurrentUser() {
  const session = await getSessionFromCookies();
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { accessRole: { select: { id: true, name: true, permissions: true } } },
  });
  // A suspended user is signed out everywhere on their next request.
  if (user && !user.isActive) return null;
  return user;
}

type UserWithRole = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/** What the permission helpers need from a user row. */
export function subjectOf(user: UserWithRole): PermissionSubject {
  return { role: user.role, permissions: user.accessRole?.permissions ?? null };
}

/**
 * Module gate shared by every page, server action and API route.
 *
 * proxy.ts stamps each request with `x-pathname` / `x-method`. A server action
 * POSTs to the page it was invoked from, so the same path→module map covers
 * pages, actions and API routes with one check: GET needs `view`, anything
 * else needs at least one write permission on that module. Finer checks
 * (delete / approve / export) are asked for explicitly via requirePermission.
 */
export async function isBlockedByPermissions(user: UserWithRole): Promise<boolean> {
  const h = await headers();
  const pathname = h.get("x-pathname");
  if (!pathname) return false;
  const mod = moduleForPath(pathname);
  if (!mod) return false;
  const subject = subjectOf(user);
  const method = h.get("x-method") ?? "GET";
  return method === "GET" || method === "HEAD"
    ? !can(subject, mod, "view")
    : !canWrite(subject, mod);
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (await isBlockedByPermissions(user)) redirect("/no-access");
  return user;
}

/** Explicit check for one module action — use on delete / approve / export paths. */
export async function requirePermission(module: string, action: PermissionAction) {
  const user = await requireUser();
  if (!can(subjectOf(user), module, action)) redirect("/no-access");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN" && user.role !== "BRANCH_ADMIN") redirect("/");
  return user;
}

// Stricter than requireAdmin: for actions a BRANCH_ADMIN should never reach,
// like bulk data reset.
export async function requireSuperAdmin() {
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN") redirect("/");
  return user;
}

// The one place every branch-scoped page/action should start from. Resolves
// which branch the current request should operate on:
// - SUPER_ADMIN has no home branch; sees whichever branch they last picked
//   via the branch switcher (null = "all branches").
// - BRANCH_ADMIN/STAFF always resolve to their own User.branchId — the
//   session's activeBranchId is ignored for them, so a stale/tampered
//   cookie value can never widen their access.
export async function requireUserWithBranch() {
  const user = await requireUser();
  const isSuperAdmin = user.role === "SUPER_ADMIN";
  let branchId: string | null;
  if (isSuperAdmin) {
    const session = await getSessionFromCookies();
    branchId = session?.activeBranchId ?? null;
  } else {
    branchId = user.branchId;
  }
  return { user, branchId, isSuperAdmin };
}
