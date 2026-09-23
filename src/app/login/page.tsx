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
    <div className="login-page-bg flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
      <div className="flex w-full max-w-5xl overflow-hidden rounded-[28px] bg-surface shadow-xl">
        {/* Brand panel — hidden below lg, same as before. Purely decorative:
            the headline restates what the form already says, so it's aria-hidden. */}
        <div
          aria-hidden
          className="login-brand-panel relative hidden w-[46%] flex-col justify-between p-10 lg:flex"
        >
          <Image
            src="/brand/burj-al-aweer-mark.svg"
            alt=""
            width={36}
            height={28}
            preload
            className="brightness-0 invert"
          />
          <div>
            <p className="text-xs font-semibold tracking-wide text-white/60 uppercase">
              Burj Al Aweer · Construction Manpower
            </p>
            <h2 className="mt-3 text-4xl leading-[1.05] font-semibold tracking-tight text-white">
              Manage
              <br />
              your workforce
            </h2>
            <p className="mt-4 max-w-xs text-sm text-white/70">
              Employees, projects, demand and timesheets for every site — in one place.
            </p>
          </div>
          <p className="text-xs text-white/40">
            © {new Date().getFullYear()} Burj Al Aweer. All rights reserved.
          </p>
        </div>

        {/* Sign-in panel */}
        <div className="flex w-full flex-col justify-center px-6 py-12 sm:px-12 lg:w-[54%] lg:px-16">
          <div className="mx-auto w-full max-w-sm">
            <div className="mb-10 flex items-center gap-3 lg:hidden">
              <Image
                src="/brand/burj-al-aweer-mark.svg"
                alt=""
                width={40}
                height={31}
                preload
              />
              <div>
                <div className="text-lg font-bold leading-tight text-[#1E2A6E]">
                  Burj Al Aweer
                </div>
                <div className="text-[11px] font-semibold tracking-wide text-muted uppercase">
                  Construction Manpower
                </div>
              </div>
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

            <p className="mt-10 text-xs text-subtle lg:hidden">
              Copyright © {new Date().getFullYear()} Burj Al Aweer. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
