import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { BRAND_ICON, BRAND_LOGO, BRAND_LOGO_ASPECT } from "@/lib/brand-assets";
import { NAV } from "@/app/welcome/content";
import { BookDemoButton } from "@/components/BookDemoButton";
import { LoginForm } from "./login-form";

// The marketing site nav, floating over the top of the login page so
// visitors can get back to manpowersync.com. Login lives on its own
// subdomain, so these links point at the marketing site's absolute URL
// rather than local anchors.
const MARKETING_URL = "https://manpowersync.com";

function SiteNav() {
  return (
    <header className="theme-force-light fixed inset-x-3 top-3 z-50 mx-auto flex h-14 max-w-4xl items-center justify-between rounded-full border border-black/5 bg-white px-3 shadow-[0_10px_32px_-16px_rgba(15,15,15,0.3)] sm:px-4">
      <a
        href={MARKETING_URL}
        className="flex shrink-0 items-center"
        aria-label="ManpowerSync home"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- data URI, no loader needed */}
        <img
          src={BRAND_LOGO}
          alt="ManpowerSync"
          height={28}
          width={Math.round(28 * BRAND_LOGO_ASPECT)}
          className="h-7 w-auto"
        />
      </a>
      <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
        {NAV.map((item) => (
          <a
            key={item.href}
            href={`${MARKETING_URL}/${item.href}`}
            className="rounded-full px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            {item.label}
          </a>
        ))}
      </nav>
      <BookDemoButton className="shrink-0 rounded-full bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90">
        Book a demo
      </BookDemoButton>
    </header>
  );
}

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
      <SiteNav />
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
          className="absolute top-24 left-12 h-10 w-10 lg:left-16"
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
          rounded body, which left a visible notch beside the logo.)
          theme-force-light: this panel stays light regardless of the
          visitor's theme choice — a public entry point, not somewhere
          personal dark-mode preference should apply. */}
      <div className="theme-force-light absolute inset-y-0 right-0 flex w-full flex-col bg-surface lg:w-[48%]">
        <div className="relative flex flex-1 items-center justify-center p-6 pt-24 sm:p-10 sm:pt-24 lg:px-20 lg:py-10 lg:pt-24">
          <div className="w-full max-w-sm">
            {/* eslint-disable-next-line @next/next/no-img-element -- data URI, no loader needed */}
            <img
              src={BRAND_LOGO}
              alt="ManpowerSync"
              height={72}
              width={Math.round(72 * BRAND_LOGO_ASPECT)}
              className="mb-8 h-[72px] w-auto"
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
        {/* The dark panel's own logo + copyright are hidden below lg along
            with the rest of that panel, so this panel needs its own footer
            for narrow screens — the lg+ view already has one on the left. */}
        <p className="pb-6 text-center text-xs text-muted lg:hidden">
          © {new Date().getFullYear()} ManpowerSync. All rights reserved.
        </p>
      </div>
    </div>
  );
}
