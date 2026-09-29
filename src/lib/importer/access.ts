import { NextResponse } from "next/server";
import { requireUserWithBranch } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAdminRole } from "@/lib/roles";

// Importing rewrites a company's records in bulk, so it is for its
// administrators, and a batch is only ever reachable from the company it
// belongs to. Anything else is answered as "not found" — a batch id from
// another company must not even confirm that it exists.

export type Importer = { user: { id: string; name: string }; branchId: string };

export async function requireImporter(): Promise<Importer | NextResponse> {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  if (!isAdminRole(user.role)) {
    return NextResponse.json({ error: "Only an administrator can import data." }, { status: 403 });
  }
  if (!branchId) {
    return NextResponse.json(
      { error: isSuperAdmin ? "Pick a branch from the switcher before importing." : "Your account has no branch assigned — contact an admin." },
      { status: 400 }
    );
  }
  return { user: { id: user.id, name: user.name }, branchId };
}

export async function loadOwnBatch(id: string, branchId: string) {
  const batch = await prisma.importBatch.findUnique({ where: { id } });
  if (!batch || batch.branchId !== branchId) return null;
  return batch;
}

export const notFound = () => NextResponse.json({ error: "Import not found." }, { status: 404 });
