import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { NewProjectForm } from "./new-project-form";

export default async function NewProjectPage() {
  const { branchId } = await requireUserWithBranch();
  const [clients, sites] = await Promise.all([
    prisma.client.findMany({ where: branchWhere(branchId), orderBy: { name: "asc" } }),
    prisma.site.findMany({ orderBy: { name: "asc" } }),
  ]);
  return (
    <NewProjectForm
      clients={clients.map((c) => ({ id: c.id, name: c.name }))}
      sites={sites.map((s) => ({ id: s.id, name: s.name }))}
    />
  );
}
