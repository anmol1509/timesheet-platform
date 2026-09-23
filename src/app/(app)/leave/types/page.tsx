import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { can } from "@/lib/permissions";
import { TypesManager } from "./types-manager";

export const metadata = { title: "Leave types" };

export default async function LeaveTypesPage() {
  const { user, branchId } = await requireUserWithBranch();
  const types = await prisma.leaveType.findMany({ where: branchWhere(branchId), orderBy: { name: "asc" } });
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-primary">Leave types</h1>
        <p className="mt-1 text-sm text-muted">The kinds of leave this branch offers and the yearly entitlement for each.</p>
      </div>
      <TypesManager
        canEdit={can(subjectOf(user), "leave", "edit")}
        types={types.map((t) => ({ id: t.id, name: t.name, code: t.code, paid: t.paid, daysPerYear: t.daysPerYear, isActive: t.isActive }))}
      />
    </div>
  );
}
