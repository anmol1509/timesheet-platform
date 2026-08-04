import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/session";

export async function getCurrentUser() {
  const session = await getSessionFromCookies();
  if (!session) return null;
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  return user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN" && user.role !== "BRANCH_ADMIN") redirect("/");
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
