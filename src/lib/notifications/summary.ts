import { prisma } from "@/lib/db";
import { sendEmail } from "./email";
import { appBaseUrl, brandForBranch } from "@/lib/email/brand";
import { summaryMail } from "@/lib/email/templates";
import { parseEmailPrefs, summaryAction } from "@/lib/emailPrefs";

/**
 * The morning run (08:00 UAE time, inside the daily expiry job): one email per person with everything held for them, which is
 * what they put in the summary plus anything quiet hours or the weekend hold delayed. A person who has since switched emails off
 * or paused them gets nothing and their queue is cleared; a person on a weekend hold waits for Monday. The in-app notifications
 * are never touched. A send that fails stays queued for the next day.
 */
export async function sendDueSummaries(now: Date = new Date()): Promise<{ sent: number; dropped: number; waiting: number; failed: number }> {
  const rows = await prisma.notification.findMany({
    where: { emailQueued: true, user: { isActive: true } },
    orderBy: { createdAt: "asc" },
    take: 5000,
    select: { id: true, kind: true, title: true, userId: true, user: { select: { id: true, email: true, name: true, branchId: true, notifyEmail: true, emailPrefs: true } } },
  });
  const byUser = new Map<string, typeof rows>();
  for (const r of rows) byUser.set(r.userId, [...(byUser.get(r.userId) ?? []), r]);
  const out = { sent: 0, dropped: 0, waiting: 0, failed: 0 };
  const appUrl = appBaseUrl();
  for (const items of byUser.values()) {
    const user = items[0].user;
    const ids = items.map((i) => i.id);
    const action = summaryAction(parseEmailPrefs(user.emailPrefs, user.notifyEmail), now);
    if (action === "WAIT") { out.waiting++; continue; }
    if (action === "DROP") { await prisma.notification.updateMany({ where: { id: { in: ids } }, data: { emailQueued: false } }); out.dropped++; continue; }
    const mail = summaryMail({ name: user.name, items: items.map((i) => ({ kind: i.kind, title: i.title })), appUrl, brand: await brandForBranch(user.branchId) });
    const res = await sendEmail(user.email, mail.subject, mail.text, { html: mail.html });
    // Not configured counts as done (there is nothing to retry); a real failure keeps the items for tomorrow.
    if (!res.sent && res.reason === "request_failed") { out.failed++; continue; }
    await prisma.notification.updateMany({ where: { id: { in: ids } }, data: { emailQueued: false } });
    out.sent++;
  }
  return out;
}
