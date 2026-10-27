import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AuthShell } from "./auth-shell";
import { LoginForm } from "./login-form";

// The root layout's title template already appends "• ManpowerSync",
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
      subtitle="Welcome back! Sign in to access your ManpowerSync account."
    >
      {reset === "1" && (
        <p role="status" className="mb-4 rounded-full bg-[var(--success-soft)] px-4 py-2.5 text-[14px] text-[var(--success)]">
          Your password has been updated. Sign in with the new one.
        </p>
      )}
      <LoginForm />
    </AuthShell>
  );
}
