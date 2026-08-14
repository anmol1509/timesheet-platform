import Image from "next/image";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata = {
  title: "Login • Burj Al Aweer",
};

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <div className="flex min-h-screen">
      <div className="flex w-full flex-col justify-center px-6 py-12 sm:px-12 lg:w-[480px] lg:flex-none lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-10 flex items-center gap-3">
            <Image
              src="/brand/burj-al-aweer-mark.svg"
              alt=""
              width={48}
              height={37}
              preload
            />
            <div>
              <div className="text-lg font-bold leading-tight text-[#1E2A6E]">
                Burj Al Aweer
              </div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                Construction Manpower
              </div>
            </div>
          </div>

          <h1 className="text-xl tracking-tight text-primary font-semibold">Login</h1>
          <p className="mt-2 text-sm text-muted">
            Need workforce or site access? Contact your site administrator.
          </p>

          <div className="mt-8">
            <LoginForm />
          </div>

          <p className="mt-10 text-xs text-subtle">
            Copyright © {new Date().getFullYear()} Burj Al Aweer. All rights
            reserved.
          </p>
        </div>
      </div>

      <div className="relative hidden flex-1 lg:block">
        <Image
          src="/brand/construction-scene.svg"
          alt=""
          fill
          className="object-cover"
          preload
        />
      </div>
    </div>
  );
}
