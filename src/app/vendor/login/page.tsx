import { redirect } from "next/navigation";
import { getVendor } from "@/lib/vendor/session";
import { isSmsConfigured } from "@/lib/notifications/sms";
import { VendorLoginForm } from "./login-form";

export const metadata = { title: "Supplier sign in" };

export default async function VendorLoginPage() {
  if (await getVendor()) redirect("/vendor");
  const whatsappConfigured = Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM);
  const deliveryConfigured = isSmsConfigured() || whatsappConfigured || process.env.NODE_ENV !== "production";
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-4">
      <div className="card w-full max-w-sm space-y-6 p-6 sm:p-8">
        <div>
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">Workforce ERP</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-primary">Supplier sign in</h1>
          <p className="mt-2 text-sm text-muted">See your workers, their timesheets and what we owe you. We&apos;ll text a code to the phone number we have on file for your company.</p>
        </div>
        <VendorLoginForm deliveryConfigured={deliveryConfigured} />
        <p className="text-center text-xs text-muted">
          Office staff? <a href="/login" className="text-[var(--brand-primary)] hover:underline">Sign in here</a>
        </p>
      </div>
    </main>
  );
}
