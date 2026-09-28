import { MarketingAnalytics } from "./marketing-analytics";
import { SiteHeader, SiteFooter } from "./site-chrome";
import s from "./welcome.module.css";

/**
 * Shared chrome for every non-homepage page. Same `.page` scope, same
 * SiteHeader/SiteFooter, same nav (SITE_NAV) and same design tokens as the
 * homepage, so the whole site reads as one design with one menu.
 */
export function ContentShell({ children }: { children: React.ReactNode }) {
  return (
    <div className={s.page}>
      <MarketingAnalytics />
      <SiteHeader logoHref="/" />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}
