import { Mail } from "lucide-react";
import { HeroHeader } from "@/components/HeroHeader";
import { requireAdmin, resolveSuperAdminBranchId } from "@/lib/auth";
import { appBaseUrl, brandForBranch } from "@/lib/email/brand";
import { clientDecisionMail, notificationMail, passwordResetMail } from "@/lib/email/templates";
import { isEmailConfigured } from "@/lib/notifications/email";
import { EmailPreviews, type EmailSample } from "./email-previews";

export const metadata = { title: "Emails" };

export default async function EmailsPage() {
  const user = await requireAdmin();
  const branchId = user.role === "SUPER_ADMIN" ? await resolveSuperAdminBranchId().catch(() => null) : user.branchId;
  const brand = await brandForBranch(branchId);
  const appUrl = appBaseUrl() || "https://app.example.com";
  const n = (kind: string, title: string, body: string, href: string) => notificationMail({ kind, title, body, href, name: user.name, appUrl, brand });
  const mails: { key: string; label: string; mail: { subject: string; html: string } }[] = [
    { key: "approval", label: "Approval needed", mail: n("PAYROLL_SUBMITTED", `Payroll submitted for ${brand.name} 2026-10`, "24 workers · net pay AED 33,326.00\nSubmitted by Fatima Khan. Review it before it can be paid.", "/approvals") },
    { key: "returned", label: "Returned for changes", mail: n("PAYROLL_RETURNED", `Payroll returned for ${brand.name} 2026-10`, "Two workers have no bank details. Fix them and submit again.", "/payroll") },
    { key: "decision", label: "Decision made", mail: n("ADVANCE_DECIDED", "Advance approved for Abhimanu Kumar", "AED 600.00, recovered from the July salary.", "/payroll/advances") },
    { key: "renewals", label: "Renewals due", mail: n("DOCUMENT_REMINDER", "3 documents expire within 30 days", "- Visa: Zainuddin Hashmi, 12 Nov\n- Passport: Ajay Lalan, 19 Nov\n- Medical: Raju Thakur, 24 Nov", "/employees/renewals") },
    { key: "ai-low", label: "AI credits low", mail: n("AI_CREDITS", `${brand.name}: 80% of this month's AI credits are used`, "1,000 credits are left this month.", "/settings/ai") },
    { key: "ai-out", label: "AI credits used up", mail: n("AI_CREDITS", `${brand.name}: AI credits are used up`, "AI features are paused until the credits reset or more are added. Everything can still be done by hand.", "/settings/ai") },
    { key: "client", label: "Client approval", mail: clientDecisionMail({ clientName: "Gulf Build", subject: "Demand request #12 approved", body: "Your demand request #12 has been approved: Mason × 4, Helper × 10.", brand }) },
    { key: "reset", label: "Password reset", mail: passwordResetMail({ name: user.name, link: `${appUrl}/login/reset?token=example`, brand }) },
  ];
  const samples: EmailSample[] = mails.map((m) => ({ key: m.key, label: m.label, subject: m.mail.subject, html: m.mail.html }));
  return (
    <div className="space-y-6">
      <HeroHeader
        icon={Mail}
        title="Emails"
        subtitle={`Every email the app sends uses one layout with ${brand.name}'s name${brand.logoUrl ? " and logo" : ""}, a button to the right screen, and a plain-text copy.`}
        pills={[{ label: "Sending", value: isEmailConfigured() ? "On" : "Not set up", warn: !isEmailConfigured() }]}
      />
      {!isEmailConfigured() && (
        <p className="rounded-lg border border-[var(--warning-border,var(--border))] bg-[var(--warning-soft,var(--surface-sunken))] px-4 py-3 text-sm text-primary">
          Email sending isn&apos;t switched on for this server yet, so people get in-app notifications only. Set the email service key and the sender address to start sending. The previews below are exactly what will go out.
        </p>
      )}
      <EmailPreviews samples={samples} email={user.email} />
    </div>
  );
}
