import { requireAdmin, resolveSuperAdminBranchId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { branchWhere } from "@/lib/branch";
import { TeamManager, type TeamUser } from "./team-manager";

export const metadata = { title: "Team & access" };

export default async function TeamPage() {
  const admin = await requireAdmin();
  const isSuperAdmin = admin.role === "SUPER_ADMIN";
  const branchId = isSuperAdmin ? await resolveSuperAdminBranchId() : admin.branchId;

  const [users, branches, accessRoles] = await Promise.all([
    prisma.user.findMany({
      where: isSuperAdmin ? {} : branchWhere(branchId),
      orderBy: { createdAt: "asc" },
      include: { branch: { select: { code: true } }, accessRole: { select: { name: true } } },
    }),
    isSuperAdmin ? prisma.branch.findMany({ orderBy: { code: "asc" }, select: { id: true, code: true, name: true } }) : Promise.resolve([]),
    prisma.accessRole.findMany({
      where: isSuperAdmin ? {} : { OR: [{ branchId: null }, { branchId: admin.branchId }] },
      orderBy: { name: "asc" },
      select: { id: true, name: true, description: true, permissions: true, branchId: true },
    }),
  ]);

  const rows: TeamUser[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    branchId: u.branchId,
    branchCode: u.branch?.code ?? null,
    accessRoleId: u.accessRoleId,
    accessRoleName: u.accessRole?.name ?? null,
    phone: u.phone,
    jobTitle: u.jobTitle,
    isActive: u.isActive,
    avatarUrl: u.avatarId ? `/api/images/${u.avatarId}` : null,
    isSelf: u.id === admin.id,
    canManage: isSuperAdmin || u.role !== "SUPER_ADMIN",
  }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-primary">Team &amp; access</h1>
        <p className="mt-1 text-sm text-muted">
          Add sub-users, choose what each can open and do, suspend or reset them. Permission sets are built on the Roles &amp; permissions tab.
        </p>
      </div>
      <TeamManager users={rows} branches={branches} accessRoles={accessRoles} isSuperAdmin={isSuperAdmin} />
    </div>
  );
}
