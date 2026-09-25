import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { BRAND_ICON, BRAND_LOGO, BRAND_LOGO_ASPECT } from "@/lib/brand-assets";
import { LoginForm } from "./login-form";

// The root layout's title template already appends "• Workforce ERP",
// so this must carry the page name only.
export const metadata = {
  title: "Login",
};

const BRAND_PHOTO =
  "https://res.cloudinary.com/degunlqed/image/upload/f_auto/q_auto/pexels-steve-12696432_nzrvxy.jpg";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <div className="login-brand-panel relative min-h-screen w-full overflow-hidden">
      {/* Dark panel — a photo with a gradient scrim for legibility, not a
          pattern. Plain CSS background-image (not next/image) since it's an
          external URL and this repo doesn't have a remote-image allowlist
          configured. Only shown once the sign-in panel stops covering the
          full width (lg+). Purely decorative: aria-hidden, since the form
          panel restates everything a screen reader needs. */}
      <div
        aria-hidden
        className="absolute inset-0 hidden lg:block"
        style={{
          backgroundImage: `linear-gradient(200deg, rgb(10 12 20 / 0.35) 0%, rgb(10 12 20 / 0.72) 65%, rgb(10 12 20 / 0.88) 100%), url(${BRAND_PHOTO})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 hidden flex-col justify-center p-12 lg:flex lg:p-16"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- data URI, no loader needed */}
        <img
          src={BRAND_ICON}
          alt=""
          width={40}
          height={40}
          className="absolute top-12 left-12 h-10 w-10 lg:top-16 lg:left-16"
        />
        <div className="max-w-md">
          <p className="text-xs font-semibold tracking-wide text-white/60 uppercase">
            Workforce, projects and timesheets — one place.
          </p>
          <h2 className="mt-3 text-5xl leading-[1.05] font-semibold tracking-tight text-white">
            Manage
            <br />
            your work
          </h2>
        </div>
        <p className="absolute bottom-12 left-12 text-xs text-white/50 lg:bottom-16 lg:left-16">
          © {new Date().getFullYear()} All rights reserved.
        </p>
      </div>

      {/* Sign-in panel: one flat, square-edged surface. Full width on mobile,
          ~48% on large screens with the logo pinned top-left inside it. (An
          earlier curved edge was built from a separate header strip plus a
          rounded body, which left a visible notch beside the logo.) */}
      <div className="absolute inset-y-0 right-0 flex w-full flex-col bg-surface lg:w-[48%]">
        <div className="relative flex flex-1 items-center justify-center p-6 sm:p-10 lg:px-20 lg:py-10">
          <div className="w-full max-w-sm">
            {/* eslint-disable-next-line @next/next/no-img-element -- data URI, no loader needed */}
            <img
              src={BRAND_LOGO}
              alt="ManpowerSync"
              height={36}
              width={Math.round(36 * BRAND_LOGO_ASPECT)}
              className="mb-8 h-9 w-auto"
            />
            <h1 className="text-2xl font-semibold tracking-tight text-primary">
              Sign in
            </h1>
            <p className="mt-2 text-sm text-muted">
              Need workforce or site access? Contact your site administrator.
            </p>

            <div className="mt-8">
              <LoginForm />
            </div>

            <p className="mt-6 text-center text-xs text-muted">
              Employee?{" "}
              <a href="/me/login" className="text-[var(--brand-primary)] hover:underline">
                Sign in to the employee portal
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
