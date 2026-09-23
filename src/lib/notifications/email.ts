/**
 * Email delivery via Resend's REST API (no SDK). Same config-gate shape as the
 * WhatsApp sender: until RESEND_API_KEY and EMAIL_FROM are set, every call is a
 * logged no-op, so callers can send unconditionally.
 *
 * EMAIL_FROM must be an address on a domain verified in Resend, e.g.
 *   "Burj Al Aweer ERP <noreply@yourdomain.com>".
 */
export type EmailSendResult =
  | { sent: true }
  | { sent: false; reason: "not_configured" | "request_failed"; detail?: string };

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendEmail(to: string, subject: string, text: string): Promise<EmailSendResult> {
  if (!isEmailConfigured()) {
    console.warn("[email] RESEND_API_KEY/EMAIL_FROM not set — email not sent.");
    return { sent: false, reason: "not_configured" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, text }),
    });
    if (!res.ok) {
      const detail = await res.text();
      console.error(`[email] Resend failed (${res.status}): ${detail}`);
      return { sent: false, reason: "request_failed", detail };
    }
    return { sent: true };
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    console.error(`[email] Resend threw: ${detail}`);
    return { sent: false, reason: "request_failed", detail };
  }
}
