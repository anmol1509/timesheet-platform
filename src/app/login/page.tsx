import Image from "next/image";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

// The root layout's title template already appends "• Burj Al Aweer ERP",
// so this must carry the page name only.
export const metadata = {
  title: "Login",
};

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <div className="login-brand-panel relative min-h-screen w-full overflow-hidden">
      {/* Dark panel — the page background itself, not a boxed-in card. Only
          shown once the sign-in panel stops covering the full width (lg+),
          so there's nothing to hide underneath on mobile. Purely decorative
          copy: aria-hidden, since the form panel restates everything a
          screen reader needs. */}
      <div
        aria-hidden
        className="absolute inset-0 hidden flex-col justify-between p-12 lg:flex lg:p-16"
      >
        <div className="max-w-md">
          <p className="text-xs font-semibold tracking-wide text-white/50 uppercase">
            Workforce, projects and timesheets — one place.
          </p>
          <h2 className="mt-3 text-5xl leading-[1.05] font-semibold tracking-tight text-white">
            Manage
            <br />
            your work
          </h2>
        </div>
        <p className="text-xs text-white/40">
          © {new Date().getFullYear()} All rights reserved.
        </p>
      </div>

      {/* Sign-in panel — full width on mobile (the curve disappears, since
          there's no dark sliver left to show it against); on large screens it
          overlays the right ~54% with one continuous arc for its whole left
          edge (a radius ≥ half its own width clamps to that shape). */}
      <div className="absolute inset-y-0 right-0 flex w-full items-center justify-center rounded-l-none bg-surface p-6 sm:p-10 lg:w-[54%] lg:rounded-l-full lg:p-16">
        <div className="w-full max-w-sm lg:ml-12">
          <div className="mb-10 flex items-center gap-3">
            <Image
              src="/brand/burj-al-aweer-mark.svg"
              alt="Burj Al Aweer"
              width={36}
              height={28}
              preload
            />
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-primary">
            Sign in
          </h1>
          <p className="mt-2 text-sm text-muted">
            Need workforce or site access? Contact your site administrator.
          </p>

          <div className="mt-8">
            <LoginForm />
          </div>
        </div>
      </div>
    </div>
  );
}
