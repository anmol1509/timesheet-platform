import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { NewProjectForm } from "./new-project-form";

export default async function NewProjectPage() {
  const { branchId } = await requireUserWithBranch();
  const clients = await prisma.client.findMany({ where: branchWhere(branchId), orderBy: { name: "asc" } });
  return <NewProjectForm clients={clients.map((c) => ({ id: c.id, name: c.name }))} />;
}
