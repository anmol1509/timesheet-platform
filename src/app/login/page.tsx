import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AuthShell } from "./auth-shell";
import { LoginForm } from "./login-form";

// The root layout's title template already appends "• Workforce ERP",
// so this must carry the page name only.
export const metadata = {
  title: "Login",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reset?: string }> }) {
  const user = await getCurrentUser();
  if (user) redirect("/");
  const { reset } = await searchParams;

  return (
    <AuthShell
      title="Sign in"
      subtitle="Need workforce or site access? Contact your site administrator."
      footer={
        <a href="https://manpowersync.com" className="hover:underline">
          ← Back to manpowersync.com
        </a>
      }
    >
      {reset === "1" && (
        <p role="status" className="mb-4 rounded-full bg-[var(--success-soft)] px-4 py-2.5 text-sm text-[var(--success)]">
          Your password has been updated. Sign in with the new one.
        </p>
      )}
      <LoginForm />
    </AuthShell>
  );
}
