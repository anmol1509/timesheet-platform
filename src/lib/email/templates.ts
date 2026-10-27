import { renderEmail, type EmailBrand, type EmailTone } from "./layout";

/** One email ready to send: the subject, the HTML and the plain-text copy for programs that don't show HTML. */
export type Mail = { subject: string; html: string; text: string };

type Style = { eyebrow: string; tone: EmailTone; cta: string };

const APPROVAL = (cta: string): Style => ({ eyebrow: "Approval needed", tone: "default", cta });
const DECISION = (cta: string): Style => ({ eyebrow: "Decision made", tone: "default", cta });
const REMINDER = (eyebrow: string, cta: string): Style => ({ eyebrow, tone: "warning", cta });

/** How each in-app notification kind looks as an email: the label above the heading, the colour and what the button says. */
const KINDS: Record<string, Style> = {
  PAYROLL_SUBMITTED: APPROVAL("Review the payroll run"),
  ADVANCE_REQUESTED: APPROVAL("Review the advance"),
  EXPENSE_SUBMITTED: APPROVAL("Review the expense"),
  SUPPLIER_INVOICE_SUBMITTED: APPROVAL("Review the invoice"),
  SUPPLIER_CHANGE_REQUEST: APPROVAL("Review the change"),
  SUPPLIER_WORKER_SUBMITTED: APPROVAL("Review the workers"),
  DEMAND_REQUEST: APPROVAL("Review the request"),
  PAYROLL_RETURNED: { eyebrow: "Returned for changes", tone: "warning", cta: "Open the payroll run" },
  ADVANCE_DECIDED: DECISION("Open the advance"),
  EXPENSE_DECIDED: DECISION("Open the expense"),
  CHANGE_DECISION: DECISION("See the decision"),
  INVOICE_DECISION: DECISION("Open the invoice"),
  WORKER_DECISION: DECISION("See the decision"),
  DEMAND_SUPPLIER_REPLY: { eyebrow: "Reply received", tone: "default", cta: "Open the request" },
  SUPPLIER_TICKET: { eyebrow: "New support ticket", tone: "default", cta: "Open the ticket" },
  TICKET_REPLY: { eyebrow: "Reply received", tone: "default", cta: "Open the ticket" },
  DOCUMENT_REMINDER: REMINDER("Renewals due", "Open renewals"),
  EXPIRY_DIGEST: REMINDER("Renewals due", "Open renewals"),
  ONBOARDING_OVERDUE: REMINDER("Overdue", "Open onboarding"),
  SUPPLIER_HOLD: REMINDER("Needs attention", "Open the supplier"),
  LOW_BALANCE: REMINDER("Needs attention", "Open the account"),
  FOLLOWUP: REMINDER("Follow up", "Open the follow-up"),
  AI_CREDITS: REMINDER("AI credits", "See AI credits"),
  WEBHOOK_DISABLED: { eyebrow: "Action needed", tone: "danger", cta: "Open developer settings" },
};

const DEFAULT_STYLE: Style = { eyebrow: "Notification", tone: "default", cta: "Open in ManpowerSync" };

export const styleForKind = (kind: string, title = ""): Style => {
  const s = KINDS[kind] ?? DEFAULT_STYLE;
  return kind === "AI_CREDITS" && /used up/i.test(title) ? { ...s, tone: "danger" } : s;
};

const firstName = (name: string) => name.trim().split(/\s+/)[0] || "there";

/** Splits a notification's text into paragraphs: blank lines separate them, and a run of "- " lines stays together as a list. */
function paragraphs(body: string | null | undefined): string[] {
  return (body ?? "").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
}

/** The email for an in-app notification: a person is told what happened, and the button opens the screen it is about. */
export function notificationMail(input: { kind: string; title: string; body?: string | null; href?: string | null; name: string; appUrl: string; brand: EmailBrand }): Mail {
  const style = styleForKind(input.kind, input.title);
  const { html, text } = renderEmail({
    preheader: (input.body ?? input.title).replace(/\s+/g, " ").slice(0, 110),
    eyebrow: style.eyebrow,
    heading: input.title,
    paragraphs: [`Hi ${firstName(input.name)},`, ...paragraphs(input.body)],
    button: input.href ? { label: style.cta, url: `${input.appUrl}${input.href}` } : undefined,
    tone: style.tone,
    brand: input.brand,
    footer: `You get this email because email notifications are on for your ${input.brand.name} account. You can turn them off under your profile.`,
  });
  return { subject: input.title, html, text };
}

export function passwordResetMail(input: { name: string; link: string; brand: EmailBrand }): Mail {
  const { html, text } = renderEmail({
    preheader: "Choose a new password. The link works once and expires in 1 hour.",
    heading: "Reset your password",
    paragraphs: [`Hi ${firstName(input.name)},`, `Someone asked to reset the password for your ${input.brand.name} account. Use the button below to choose a new one.`],
    button: { label: "Choose a new password", url: input.link },
    note: "The link works once and expires in 1 hour. If you didn't ask for this, you can ignore this email and your password stays the same.",
    brand: input.brand,
    footer: "You get this email because a password reset was asked for on your account.",
  });
  return { subject: `Reset your ${input.brand.name} password`, html, text };
}

/** Sent to a client when their request is approved: a confirmation from the company they hire from. */
export function clientDecisionMail(input: { clientName: string; subject: string; body: string; brand: EmailBrand }): Mail {
  const { html, text } = renderEmail({
    preheader: input.body.slice(0, 110),
    eyebrow: "Approved",
    heading: input.subject,
    paragraphs: [`Hi ${input.clientName} team,`, input.body],
    tone: "success",
    brand: input.brand,
    footer: `Sent by ${input.brand.name}. Reply to this email if anything looks wrong.`,
  });
  return { subject: input.subject, html, text };
}

export function supportRequestMail(input: { fromName: string; fromEmail: string; page?: string | null; subject: string; message: string; brand: EmailBrand }): Mail {
  const { html, text } = renderEmail({
    preheader: input.message.replace(/\s+/g, " ").slice(0, 110),
    eyebrow: "Support request",
    heading: input.subject,
    paragraphs: [input.message],
    facts: [{ label: "From", value: `${input.fromName} <${input.fromEmail}>` }, ...(input.page ? [{ label: "Page", value: input.page }] : [])],
    note: "Reply to this email to answer them directly.",
    brand: input.brand,
    footer: "Sent from the support form in the app.",
  });
  return { subject: `[${input.brand.name} support] ${input.subject}`, html, text };
}

export function demoRequestMail(input: { name: string; company: string; email: string; phone: string; brand: EmailBrand }): Mail {
  const { html, text } = renderEmail({
    preheader: `${input.name} from ${input.company} asked for a demo.`,
    eyebrow: "New demo request",
    heading: input.company,
    paragraphs: [`${input.name} asked for a demo.`],
    facts: [{ label: "Name", value: input.name }, { label: "Company", value: input.company }, { label: "Email", value: input.email }, { label: "Phone", value: input.phone }],
    brand: input.brand,
    footer: "Sent from the demo request form on the website.",
  });
  return { subject: `New demo request: ${input.company}`, html, text };
}

/** What an admin gets from "Send me a test", so the look can be checked in a real inbox. */
export function testMail(input: { name: string; appUrl: string; brand: EmailBrand }): Mail {
  const { html, text } = renderEmail({
    preheader: "This is a test email from your account.",
    eyebrow: "Test email",
    heading: "Your emails look like this",
    paragraphs: [`Hi ${firstName(input.name)},`, "This is a test. Every email from your account, such as approvals, reminders and password resets, uses this layout with your company name and logo."],
    button: { label: "Open ManpowerSync", url: input.appUrl || "https://manpowersync.com" },
    tone: "success",
    brand: input.brand,
  });
  return { subject: `Test email from ${input.brand.name}`, html, text };
}
