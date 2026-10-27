import Link from "next/link";
import { FileText, Globe, BarChart3, Clock, Users, type LucideIcon } from "lucide-react";
import { BRAND_LOGO, BRAND_LOGO_ASPECT } from "@/lib/brand-assets";

const FEATURES: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Users, title: "Workforce Management", text: "Employees, deployments and renewals" },
  { icon: FileText, title: "Compliance & Documents", text: "Visas, medicals, labour cards and more" },
  { icon: BarChart3, title: "Projects & Sites", text: "Assign, track and manage resources" },
  { icon: Clock, title: "Timesheets & Payroll", text: "Accurate records, faster processing" },
];

/**
 * The split sign-in layout (brand panel left, form right) shared by sign in, forgot password and reset password, so the
 * three read as one flow. The brand panel is a light sky photo with the product on a laptop; it only shows from lg up.
 * The form panel is always light, since this is a public entry point where a personal dark-mode choice shouldn't apply.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="theme-force-light min-h-screen w-full bg-[linear-gradient(135deg,#eceaff_0%,#f6f5fd_45%,#e8eeff_100%)] p-0 lg:p-5">
      <div className="mx-auto grid min-h-screen w-full max-w-[1760px] overflow-hidden bg-surface lg:min-h-[calc(100vh-2.5rem)] lg:grid-cols-[1.12fr_1fr] lg:rounded-[32px] lg:shadow-[0_30px_80px_rgb(60_45_160_/_0.18)]">
        {/* Brand panel: the photo sits on the right and fades into a pale wash on the left so the text stays readable.
            Purely decorative and hidden on small screens; the form panel restates everything a screen reader needs. */}
        <div
          aria-hidden
          className="relative hidden flex-col justify-between overflow-hidden p-12 lg:flex xl:p-16"
          style={{
            backgroundImage:
              "linear-gradient(90deg, rgb(244 242 255 / 0.96) 0%, rgb(244 242 255 / 0.86) 38%, rgb(244 242 255 / 0.12) 72%, rgb(244 242 255 / 0) 100%), linear-gradient(0deg, rgb(244 242 255 / 0.55) 0%, rgb(244 242 255 / 0) 30%), url(/brand-assets/login-hero.webp)",
            backgroundSize: "cover",
            backgroundPosition: "right bottom",
          }}
        >
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element -- data URI, no loader needed */}
            <img src={BRAND_LOGO} alt="" height={52} width={Math.round(52 * BRAND_LOGO_ASPECT)} className="h-[52px] w-auto" />
            <p className="mt-14 max-w-sm text-[13px] leading-6 font-medium tracking-[0.22em] text-[#3a3858] uppercase">
              Workforce, projects and timesheets. One place.
            </p>
            <h2 className="mt-5 text-[clamp(44px,4.6vw,68px)] leading-[1.04] font-extrabold tracking-[-0.03em] text-[#14132b]">
              Manage
              <br />
              <span className="bg-gradient-to-r from-[#4f46e5] to-[#8b3fe0] bg-clip-text text-transparent">your workforce</span>
              <br />
              with confidence
            </h2>
            <p className="mt-6 max-w-md text-[17px] leading-7 text-[#3a3858]">
              Streamline workforce management, track deployments, manage compliance and keep your projects running smoothly.
            </p>
            <ul className="mt-9 space-y-5">
              {FEATURES.map(({ icon: Icon, title: t, text }) => (
                <li key={t} className="flex items-center gap-4">
                  <span className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-2xl bg-[#e8e4ff] text-[#5645d4]">
                    <Icon className="h-6 w-6" strokeWidth={1.7} />
                  </span>
                  <span>
                    <span className="block text-[16px] font-semibold text-[#14132b]">{t}</span>
                    <span className="block text-[14px] text-[#4a4968]">{text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-10">
            <span className="block h-0.5 w-14 rounded bg-[#5645d4]" />
            <p className="mt-4 max-w-[16rem] text-[15px] leading-6 text-[#14132b]">Trusted by leading companies across the UAE and beyond.</p>
          </div>
        </div>

        {/* Form panel. */}
        <div className="relative flex flex-col bg-surface">
          <div className="flex justify-end px-6 pt-6 sm:px-10 lg:px-12 lg:pt-7">
            <span className="inline-flex items-center gap-2 rounded-full border border-default px-4 py-2 text-[14px] text-secondary" title="English is the only language for now">
              <Globe className="h-4 w-4" aria-hidden /> English
            </span>
          </div>
          <div className="flex flex-1 items-center justify-center px-6 pb-10 sm:px-10 lg:px-16">
            <div className="w-full max-w-[470px]">
              <Link href="https://manpowersync.com" aria-label="ManpowerSync home">
                {/* eslint-disable-next-line @next/next/no-img-element -- data URI, no loader needed */}
                <img src={BRAND_LOGO} alt="ManpowerSync" height={84} width={Math.round(84 * BRAND_LOGO_ASPECT)} className="mb-9 h-[84px] w-auto" />
              </Link>
              <h1 className="text-[36px] leading-[1.1] font-bold tracking-[-0.02em] text-[#14132b]">{title}</h1>
              {subtitle && <p className="mt-3 text-[16px] leading-6 text-secondary">{subtitle}</p>}
              <div className="mt-9">{children}</div>
              {footer && <p className="mt-6 text-center text-[14px] text-muted">{footer}</p>}
            </div>
          </div>
          <p className="pb-6 text-center text-[13px] text-muted lg:hidden">© {new Date().getFullYear()} ManpowerSync. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
