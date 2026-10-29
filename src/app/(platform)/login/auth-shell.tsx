import { FileText, BarChart3, Clock, Users, type LucideIcon } from "lucide-react";
import { BRAND_LOGO_URL, BRAND_LOGO_ASPECT } from "@/lib/brand-urls";
import { AuthHeader } from "./auth-header";

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
// A customer's own deployment has the owner API switched on and no owner console; the website menus are for ManpowerSync's own site.
const customerApp = !!process.env.OWNER_API_SECRET && process.env.OWNER_CONSOLE !== "1";

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
    <div className="theme-force-light min-h-screen w-full bg-[linear-gradient(135deg,#eceaff_0%,#f6f5fd_45%,#e8eeff_100%)] pt-[84px] lg:px-5 lg:pb-5">
      <AuthHeader customerApp={customerApp} />
      <div className="mx-auto grid w-full max-w-[1760px] overflow-hidden bg-surface lg:h-[calc(100vh-104px)] lg:min-h-[560px] lg:grid-cols-[1.25fr_1fr] lg:rounded-[32px] lg:shadow-[0_30px_80px_rgb(60_45_160_/_0.18)]">
        {/* Brand panel: the photo sits on the right and fades into a pale wash on the left so the text stays readable.
            Purely decorative and hidden on small screens; the form panel restates everything a screen reader needs. */}
        <div
          aria-hidden
          className="relative hidden flex-col justify-between overflow-hidden bg-[linear-gradient(180deg,#9fb0f6_0%,#c5c3f8_38%,#efeafc_100%)] px-12 py-[clamp(20px,4vh,44px)] lg:flex xl:px-16"
        >
          {/* The photo sits along the bottom and fades into the sky colour above it; a pale wash on the left keeps the text readable. */}
          <div
            className="absolute inset-x-0 bottom-0 h-[82%] bg-no-repeat"
            style={{
              backgroundImage: "url(/brand-assets/login-hero.webp)",
              backgroundSize: "cover",
              backgroundPosition: "72% bottom",
              maskImage: "linear-gradient(to bottom, transparent 0%, #000 22%)",
              WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, #000 22%)",
            }}
          />
          <div
            className="absolute inset-0"
            style={{ backgroundImage: "linear-gradient(90deg, rgb(244 242 255 / 0.93) 0%, rgb(244 242 255 / 0.7) 34%, rgb(244 242 255 / 0) 62%), linear-gradient(0deg, rgb(244 242 255 / 0.5) 0%, rgb(244 242 255 / 0) 22%)" }}
          />
          <div className="relative">
            <p className="max-w-lg text-[12px] leading-5 font-medium tracking-[0.22em] text-[#3a3858] uppercase">
              Workforce, projects and timesheets. One place.
            </p>
            <h2 className="mt-3 text-[clamp(32px,min(4.4vw,6.4vh),64px)] leading-[1.04] font-extrabold tracking-[-0.03em] text-[#14132b]">
              Manage
              <br />
              <span className="bg-gradient-to-r from-[#4f46e5] to-[#8b3fe0] bg-clip-text text-transparent">your workforce</span>
              <br />
              with confidence
            </h2>
            <p className="mt-[clamp(10px,2.4vh,22px)] max-w-md text-[clamp(14px,2vh,17px)] leading-[1.55] text-[#3a3858] [@media(max-height:700px)]:hidden">
              Streamline workforce management, track deployments, manage compliance and keep your projects running smoothly.
            </p>
            <ul className="mt-[clamp(14px,3.4vh,32px)] space-y-[clamp(8px,2.2vh,20px)]">
              {FEATURES.map(({ icon: Icon, title: t, text }) => (
                <li key={t} className="flex items-center gap-4">
                  <span className="grid h-[clamp(38px,5.6vh,52px)] w-[clamp(38px,5.6vh,52px)] shrink-0 place-items-center rounded-2xl bg-[#e8e4ff] text-[#5645d4]">
                    <Icon className="h-5 w-5" strokeWidth={1.7} />
                  </span>
                  <span>
                    <span className="block text-[15px] font-semibold text-[#14132b]">{t}</span>
                    <span className="block text-[13px] text-[#4a4968]">{text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="relative mt-4 [@media(max-height:720px)]:hidden">
            <span className="block h-0.5 w-14 rounded bg-[#5645d4]" />
            <p className="mt-3 max-w-[16rem] text-[14px] leading-5 text-[#14132b]">Trusted by leading companies across the UAE and beyond.</p>
          </div>
        </div>

        {/* Form panel. */}
        <div className="relative flex min-h-0 flex-col overflow-y-auto bg-surface">
          <div className="flex flex-1 items-center justify-center px-6 py-8 sm:px-10 lg:px-16">
            <div className="w-full max-w-[440px]">
              {/* eslint-disable-next-line @next/next/no-img-element -- data URI, no loader needed */}
              <img src={BRAND_LOGO_URL} alt="ManpowerSync" height={72} width={Math.round(72 * BRAND_LOGO_ASPECT)} className="mb-[clamp(10px,2.6vh,26px)] h-[clamp(48px,8vh,72px)] w-auto" />
              <h1 className="text-[clamp(26px,4.2vh,34px)] leading-[1.1] font-bold tracking-[-0.02em] text-[#14132b]">{title}</h1>
              {subtitle && <p className="mt-2 text-[15px] leading-6 text-secondary">{subtitle}</p>}
              <div className="mt-[clamp(14px,3.4vh,30px)]">{children}</div>
              {footer && <p className="mt-6 text-center text-[14px] text-muted">{footer}</p>}
            </div>
          </div>
          <p className="pb-6 text-center text-[13px] text-muted lg:hidden">© {new Date().getFullYear()} ManpowerSync. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
