import Link from "next/link";
import { BRAND_ICON, BRAND_LOGO, BRAND_LOGO_ASPECT } from "@/lib/brand-assets";
import { BookDemoButton } from "@/components/BookDemoButton";
import { FOOTER, SITE, demoHref } from "./content";
import { MarketingAnalytics } from "./marketing-analytics";

const CONTENT_NAV = [
  { label: "Features", href: "/features" },
  { label: "Solutions", href: "/solutions" },
  { label: "Guides", href: "/guides" },
  { label: "FAQ", href: "/faq" },
  { label: "Pricing", href: "/pricing" },
];

/**
 * Shared chrome for content/blog pages — a plainer header and footer than the
 * homepage's animated one, since these are read-then-convert pages rather
 * than the flagship scroll experience. Server component: no motion needed.
 */
export function ContentShell({ children }: { children: React.ReactNode }) {
  const logoHeight = 36;
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <MarketingAnalytics />
      <header className="border-b border-slate-100">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4">
          <Link href="/" aria-label={`${SITE.name} home`} className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element -- data URI, no loader needed */}
            <img
              src={BRAND_LOGO}
              alt={SITE.name}
              height={logoHeight}
              width={Math.round(logoHeight * BRAND_LOGO_ASPECT)}
              style={{ height: "auto", width: "auto", maxHeight: logoHeight, maxWidth: "100%" }}
            />
          </Link>
          <nav aria-label="Primary" className="hidden items-center gap-6 md:flex">
            {CONTENT_NAV.map((link) => (
              <Link key={link.href} href={link.href} className="text-sm font-medium text-slate-600 hover:text-slate-900">
                {link.label}
              </Link>
            ))}
          </nav>
          <BookDemoButton className="shrink-0 rounded-full bg-[var(--brand-primary,#5645d4)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90">
            Book a demo
          </BookDemoButton>
        </div>
      </header>

      <main>{children}</main>

      <footer className="border-t border-slate-100 bg-slate-950 text-slate-300">
        <div className="mx-auto max-w-5xl px-5 py-12">
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            <div className="col-span-2 sm:col-span-1">
              <span className="flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- data URI, no loader needed */}
                <img src={BRAND_ICON} alt="" height={28} width={28} style={{ height: "auto", width: "auto", maxHeight: 28, maxWidth: 28 }} />
                <span className="font-semibold text-white">{SITE.name}</span>
              </span>
              <p className="mt-3 text-sm text-slate-400">{SITE.tagline}</p>
            </div>
            {FOOTER.map((col) => (
              <div key={col.title}>
                <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{col.title}</p>
                <ul className="mt-3 space-y-2">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <a href={link.href} className="text-sm text-slate-300 hover:text-white hover:underline">
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-6 text-xs text-slate-500">
            <span>&copy; {new Date().getFullYear()} {SITE.name}. All rights reserved.</span>
            <a href={demoHref} className="hover:text-slate-300 hover:underline">
              Contact sales
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
