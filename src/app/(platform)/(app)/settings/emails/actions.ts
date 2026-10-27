"use server";

import { requireAdmin, resolveSuperAdminBranchId } from "@/lib/auth";
import { brandForBranch, appBaseUrl } from "@/lib/email/brand";
import { testMail } from "@/lib/email/templates";
import { isEmailConfigured, sendEmail } from "@/lib/notifications/email";
import { rateLimit } from "@/lib/rateLimit";

type State = { error: string | null; ok?: boolean };

/** Sends the signed-in admin a test email in the real layout, so it can be checked in an actual inbox. */
export async function sendTestEmailAction(): Promise<State> {
  const user = await requireAdmin();
  if (!isEmailConfigured()) return { error: "Email sending isn't set up on this server yet (the email service key and sender address are missing), so nothing can be sent. The previews on this page show exactly what will go out." };
  const limit = rateLimit(`test-email:${user.id}`, { limit: 10, windowMs: 60 * 60 * 1000 });
  if (!limit.allowed) return { error: "You've sent a few tests already. Try again in a little while." };
  const branchId = user.role === "SUPER_ADMIN" ? await resolveSuperAdminBranchId().catch(() => null) : user.branchId;
  const mail = testMail({ name: user.name, appUrl: appBaseUrl(), brand: await brandForBranch(branchId) });
  const res = await sendEmail(user.email, mail.subject, mail.text, { html: mail.html });
  return res.sent ? { error: null, ok: true } : { error: "The email service didn't accept it. Check the sender address is verified, then try again." };
}
