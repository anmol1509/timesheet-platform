"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

function dateOrNull(value: FormDataEntryValue | null) {
  const s = String(value || "").trim();
  return s ? new Date(s) : null;
}

function stringOrNull(value: FormDataEntryValue | null) {
  const s = String(value || "").trim();
  return s || null;
}

async function nextProjectCode() {
  const count = await prisma.project.count();
  return `PRJ${String(count + 1).padStart(3, "0")}`;
}

export async function createProjectAction(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  await requireUser();
  const name = String(formData.get("name") || "").trim();
  const clientId = String(formData.get("clientId") || "");
  if (!name || !clientId) {
    return { error: "Project name and client are required." };
  }

  const project = await prisma.project.create({
    data: {
      code: await nextProjectCode(),
      name,
      clientId,
      description: stringOrNull(formData.get("description")),
      location: stringOrNull(formData.get("location")),
      manager: stringOrNull(formData.get("manager")),
      timelineStart: dateOrNull(formData.get("timelineStart")),
      timelineEnd: dateOrNull(formData.get("timelineEnd")),
      status: String(formData.get("status") || "PLANNING"),
    },
  });

  revalidatePath("/projects");
  redirect(`/projects/${project.id}`);
}

export async function updateProjectAction(formData: FormData) {
  await requireUser();
  const id = String(formData.get("projectId") || "");
  if (!id) return;

  await prisma.project.update({
    where: { id },
    data: {
      description: stringOrNull(formData.get("description")),
      location: stringOrNull(formData.get("location")),
      manager: stringOrNull(formData.get("manager")),
      timelineStart: dateOrNull(formData.get("timelineStart")),
      timelineEnd: dateOrNull(formData.get("timelineEnd")),
      status: String(formData.get("status") || "PLANNING"),
    },
  });

  revalidatePath(`/projects/${id}`);
  revalidatePath("/projects");
}

export async function deleteProjectAction(formData: FormData) {
  await requireUser();
  const id = String(formData.get("projectId") || "");
  if (!id) return;

  // Unassigning employees is a soft, reversible consequence -- unlike a
  // Client with real timesheet history, it's safe to do automatically
  // rather than blocking the delete.
  await prisma.employee.updateMany({
    where: { projectId: id },
    data: { projectId: null },
  });
  await prisma.project.delete({ where: { id } });

  revalidatePath("/projects");
  revalidatePath("/employees");
  redirect("/projects");
}
