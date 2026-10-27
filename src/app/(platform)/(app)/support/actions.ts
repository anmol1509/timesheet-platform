"use server";

import { requireUser } from "@/lib/auth";
import { sendEmail } from "@/lib/notifications/email";
import { PRODUCT_BRAND } from "@/lib/email/brand";
import { supportRequestMail } from "@/lib/email/templates";

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

  // Goes to the support inbox as a designed email, and a reply goes straight back to the person who wrote.
  const mail = supportRequestMail({ fromName: user.name, fromEmail: user.email, page: page || null, subject, message, brand: PRODUCT_BRAND });
  const result = await sendEmail(SUPPORT_INBOX, mail.subject, mail.text, { html: mail.html, replyTo: user.email });

  if (!result.sent) {
    return { error: "Couldn't send your message right now. Please try again in a moment, or email info@manpowersync.com directly." };
  }
  return { ok: true };
}
