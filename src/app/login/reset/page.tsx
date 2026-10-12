import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { findValidReset } from "@/lib/passwordReset";
import { AuthShell } from "../auth-shell";
import { ResetForm } from "./reset-form";

export const metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  if (await getCurrentUser()) redirect("/");
  const { token = "" } = await searchParams;
  const valid = await findValidReset(token);

  if (!valid) {
    return (
      <AuthShell
        title="This link has expired"
        subtitle="Reset links work once and last 1 hour. Ask for a new one and we'll email it straight away."
        footer={
          <a href="/login" className="hover:underline">
            ← Back to sign in
          </a>
        }
      >
        <a
          href="/login/forgot"
          className="flex h-12 w-full items-center justify-center rounded-full bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-navy)] font-semibold text-white shadow-sm transition hover:brightness-110"
        >
          Send a new link
        </a>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Choose a new password"
      subtitle={`For ${valid.user.email}. Use at least 8 characters.`}
      footer={
        <a href="/login" className="hover:underline">
          ← Back to sign in
        </a>
      }
    >
      <ResetForm token={token} />
    </AuthShell>
  );
}
