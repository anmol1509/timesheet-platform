import { prisma } from "@/lib/db";
import { NewProjectForm } from "./new-project-form";

export default async function NewProjectPage() {
  const [clients, sites] = await Promise.all([
    prisma.client.findMany({ orderBy: { name: "asc" } }),
    prisma.site.findMany({ orderBy: { name: "asc" } }),
  ]);
  return (
    <NewProjectForm
      clients={clients.map((c) => ({ id: c.id, name: c.name }))}
      sites={sites.map((s) => ({ id: s.id, name: s.name }))}
    />
  );
}
