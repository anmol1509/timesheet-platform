import { redirect } from "next/navigation";
import { getEssEmployee } from "@/lib/ess/session";
import { isSmsConfigured } from "@/lib/notifications/sms";
import { EssLoginForm } from "./login-form";

export const metadata = { title: "Employee sign in" };

export default async function EssLoginPage() {
  if (await getEssEmployee()) redirect("/me");
  const whatsappConfigured = Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM);
  // In development a code is printed to the server log, so the form is usable
  // without a provider; in production it genuinely needs one.
  const deliveryConfigured = isSmsConfigured() || whatsappConfigured || process.env.NODE_ENV !== "production";

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-4">
      <div className="card w-full max-w-sm space-y-6 p-6 sm:p-8">
        <div>
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">Burj Al Aweer</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-primary">Employee sign in</h1>
          <p className="mt-2 text-sm text-muted">See your payslips, attendance, leave and documents. We&apos;ll text you a code — no password needed.</p>
        </div>
        <EssLoginForm deliveryConfigured={deliveryConfigured} />
        <p className="text-center text-xs text-muted">
          Office staff? <a href="/login" className="text-[var(--brand-primary)] hover:underline">Sign in here</a>
        </p>
      </div>
    </main>
  );
}
