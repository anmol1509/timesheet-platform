"use server";

import { requireUser } from "@/lib/auth";
import { sendEmail } from "@/lib/notifications/email";

const SUPPORT_INBOX = "info@manpowersync.com";

export type SupportTicketState = { error?: string; ok?: boolean };

/** Emails whatever the signed-in user is stuck on straight to the support inbox — no ticket queue to check, just a message with enough context (who, and which page) to follow up from. */
export async function submitSupportTicketAction(
  _prev: SupportTicketState,
  formData: FormData
): Promise<SupportTicketState> {
  const user = await requireUser();
  const subject = String(formData.get("subject") || "").trim();
  const message = String(formData.get("message") || "").trim();
  const page = String(formData.get("page") || "").trim();
  if (!subject) return { error: "Please give it a short subject." };
  if (!message) return { error: "Please describe the issue you're facing." };

  const result = await sendEmail(
    SUPPORT_INBOX,
    `[ManpowerSync support] ${subject}`,
    [
      `From: ${user.name} <${user.email}>`,
      page ? `Page: ${page}` : null,
      "",
      message,
    ]
      .filter((line): line is string => line !== null)
      .join("\n")
  );

  if (!result.sent) {
    return { error: "Couldn't send your message right now — please try again in a moment, or email info@manpowersync.com directly." };
  }
  return { ok: true };
}
