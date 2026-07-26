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
  if (user.role !== "ADMIN") redirect("/");
  return user;
}
