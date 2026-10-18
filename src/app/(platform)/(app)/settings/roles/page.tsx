import { KeyRound } from "lucide-react";
import { HeroHeader } from "@/components/HeroHeader";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { RolesManager } from "./roles-manager";

export const metadata = { title: "Roles & permissions" };

export default async function RolesPage() {
  const admin = await requireAdmin();
  const isSuperAdmin = admin.role === "SUPER_ADMIN";

  const [roles, branches] = await Promise.all([
    prisma.accessRole.findMany({
      where: isSuperAdmin ? {} : { OR: [{ branchId: null }, { branchId: admin.branchId }] },
      include: { branch: { select: { code: true } }, users: { select: { id: true, name: true }, orderBy: { name: "asc" } } },
      orderBy: { name: "asc" },
    }),
    isSuperAdmin ? prisma.branch.findMany({ orderBy: { code: "asc" }, select: { id: true, code: true, name: true } }) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-5">
      <HeroHeader
        icon={KeyRound}
        title="Roles & permissions"
        subtitle="A role is a set of modules and actions. Assign one on the Team tab to limit what a person can see and do. Admins always have full access."
        pills={[
          { label: "Roles", value: String(roles.length) },
          { label: "People assigned", value: String(roles.reduce((n, r) => n + r.users.length, 0)) },
          { label: "Unused roles", value: String(roles.filter((r) => r.users.length === 0).length) },
        ]}
      />
      <RolesManager
        isSuperAdmin={isSuperAdmin}
        branches={branches}
        roles={roles.map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          permissions: r.permissions,
          branchId: r.branchId,
          branchLabel: r.branch ? r.branch.code : "Every branch",
          userCount: r.users.length,
          members: r.users.map((u) => u.name),
          editable: isSuperAdmin || r.branchId === admin.branchId,
        }))}
      />
    </div>
  );
}
