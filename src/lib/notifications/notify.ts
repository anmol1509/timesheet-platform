import { after } from "next/server";
import { prisma } from "@/lib/db";
import { sendEmail } from "./email";
import { appBaseUrl, brandForBranch, PRODUCT_BRAND } from "@/lib/email/brand";
import { notificationMail } from "@/lib/email/templates";
import { parseEmailPrefs, planEmail } from "@/lib/emailPrefs";

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
 * emails them. The inbox rows are written inline; the outbound
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
      select: { id: true, email: true, name: true, notifyEmail: true, emailPrefs: true, branchId: true },
    });
    if (users.length === 0) return;

    // Each person's own email settings decide whether this one is emailed now, held for their next summary, or not emailed.
    const now = new Date();
    const plan = new Map(users.map((u) => [u.id, planEmail(parseEmailPrefs(u.emailPrefs, u.notifyEmail), kind, now)] as const));
    await prisma.notification.createMany({
      data: users.map((u) => ({ userId: u.id, kind, title, body, href, emailQueued: plan.get(u.id) === "QUEUE" })),
    });
    const toEmail = users.filter((u) => plan.get(u.id) === "SEND_NOW");

    const appUrl = appBaseUrl();

    after(async () => {
      // Each person's email carries their own company's name and logo.
      const brands = new Map<string | null, Awaited<ReturnType<typeof brandForBranch>>>();
      for (const id of new Set(toEmail.map((u) => u.branchId))) brands.set(id, await brandForBranch(id));
      const sends: Promise<unknown>[] = [];
      for (const u of toEmail) {
        const mail = notificationMail({ kind, title, body, href, name: u.name, appUrl, brand: brands.get(u.branchId) ?? PRODUCT_BRAND });
        sends.push(sendEmail(u.email, mail.subject, mail.text, { html: mail.html }));
      }
      await Promise.allSettled(sends);
    });
  } catch (e) {
    console.error("[notify] failed:", e instanceof Error ? e.message : e);
  }
}

/** Active users in a company who may approve in a module: its admins, plus staff whose
 * permission set grants "<module>:approve". Legacy unrestricted staff are left out
 * so a request doesn't ping everyone. The platform owner is never one of them: a company
 * runs its own approvals and nothing waits on, or is sent to, the owner. */
export async function approverIds(module: string, branchId: string): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      OR: [
        { role: "BRANCH_ADMIN", branchId },
        { role: "STAFF", branchId, accessRole: { permissions: { has: `${module}:approve` } } },
      ],
    },
    select: { id: true },
  });
  return users.map((u) => u.id);
}
