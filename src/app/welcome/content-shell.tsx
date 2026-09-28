import { MarketingAnalytics } from "./marketing-analytics";
import { SiteHeader, SiteFooter } from "./site-chrome";
import s from "./welcome.module.css";

const CONTENT_NAV = [
  { label: "Features", href: "/features" },
  { label: "Solutions", href: "/solutions" },
  { label: "Guides", href: "/guides" },
  { label: "FAQ", href: "/faq" },
  { label: "Pricing", href: "/pricing" },
];

/**
 * Shared chrome for every non-homepage page. Same `.page` scope, same
 * SiteHeader/SiteFooter and same design tokens as the homepage — only the
 * nav links differ (real pages here, in-page scroll anchors there), so the
 * whole site reads as one design instead of two.
 */
export function ContentShell({ children }: { children: React.ReactNode }) {
  return (
    <div className={s.page}>
      <MarketingAnalytics />
      <SiteHeader links={CONTENT_NAV} logoHref="/" />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}
