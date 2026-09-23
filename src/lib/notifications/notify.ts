import { after } from "next/server";
import { prisma } from "@/lib/db";
import { sendEmail } from "./email";
import { sendWhatsAppMessage } from "./whatsapp";

export type NotifyInput = {
  userIds: string[];
  kind: string;
  title: string;
  body?: string | null;
  /** In-app path to open, e.g. "/leave?status=PENDING". */
  href?: string | null;
};

/**
 * Creates the in-app notification for each user and, per their preferences,
 * emails / WhatsApps them. The inbox rows are written inline; the outbound
 * copies run after the response so a slow provider never delays the action
 * that triggered them. Never throws — a failed notification must not fail the
 * business action that caused it.
 */
export async function notifyUsers({ userIds, kind, title, body = null, href = null }: NotifyInput) {
  try {
    const ids = [...new Set(userIds)];
    if (ids.length === 0) return;

    const users = await prisma.user.findMany({
      where: { id: { in: ids }, isActive: true },
      select: { id: true, email: true, name: true, notifyEmail: true, notifyWhatsapp: true, whatsappNumber: true },
    });
    if (users.length === 0) return;

    await prisma.notification.createMany({
      data: users.map((u) => ({ userId: u.id, kind, title, body, href })),
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
    const link = href ? `\n\n${appUrl}${href}` : "";
    const text = `${body ? `${body}\n` : ""}${link}`.trim() || title;

    after(async () => {
      const sends: Promise<unknown>[] = [];
      for (const u of users) {
        if (u.notifyEmail) sends.push(sendEmail(u.email, title, `Hi ${u.name},\n\n${text}`));
        if (u.notifyWhatsapp && u.whatsappNumber) sends.push(sendWhatsAppMessage(u.whatsappNumber, `*${title}*\n${text}`));
      }
      await Promise.allSettled(sends);
    });
  } catch (e) {
    console.error("[notify] failed:", e instanceof Error ? e.message : e);
  }
}

/** Active users in a branch who may approve in a module: admins, plus staff whose
 * permission set grants "<module>:approve". Legacy unrestricted staff are left out
 * so a request doesn't ping everyone. */
export async function approverIds(module: string, branchId: string): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      OR: [
        { role: "SUPER_ADMIN" },
        { role: "BRANCH_ADMIN", branchId },
        { role: "STAFF", branchId, accessRole: { permissions: { has: `${module}:approve` } } },
      ],
    },
    select: { id: true },
  });
  return users.map((u) => u.id);
}
