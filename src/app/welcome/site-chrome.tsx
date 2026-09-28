"use client";

import { useState } from "react";
import { m } from "motion/react";
import { BRAND_ICON, BRAND_LOGO, BRAND_LOGO_ASPECT } from "@/lib/brand-assets";
import { BookDemoButton } from "@/components/BookDemoButton";
import { FOOTER, SITE, appHref } from "./content";
import { MobileMenu } from "./mobile-menu";
import { EASE_PREMIUM, MagneticButton, Reveal, useScrolled } from "./motion";
import s from "./welcome.module.css";

export type NavLink = { label: string; href: string };

/** The one header design for the whole site — the homepage passes its
 * scroll-anchor links and "#top" as the logo target; every other page
 * passes real page links and "/" instead. Same look and motion everywhere. */
export function Logo({ href }: { href: string }) {
  const height = 44;
  return (
    <a href={href} className={s.logo} aria-label={`${SITE.name} home`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- data URI, no loader needed */}
      <img
        src={BRAND_LOGO}
        alt={SITE.name}
        height={height}
        width={Math.round(height * BRAND_LOGO_ASPECT)}
        style={{ height: "auto", width: "auto", maxHeight: height, maxWidth: "100%" }}
      />
    </a>
  );
}

// The full BRAND_LOGO wordmark renders "ManpowerSync" in dark navy, so it
// disappears on the footer's dark background — use the colour icon mark plus
// a plain white text wordmark instead of the flattened PNG.
export function FooterLogo() {
  const height = 40;
  return (
    <span className={s.footerLogoRow}>
      {/* eslint-disable-next-line @next/next/no-img-element -- data URI, no loader needed */}
      <img src={BRAND_ICON} alt="" height={height} width={height} style={{ height: "auto", width: "auto", maxHeight: height, maxWidth: height }} />
      <span className={s.footerWordmark}>{SITE.name}</span>
    </span>
  );
}

function NavLinks({ links }: { links: NavLink[] }) {
  const [hovered, setHovered] = useState<string | null>(null);
  return (
    <ul className={s.navLinks} onPointerLeave={() => setHovered(null)}>
      {links.map((n) => (
        <li key={n.href} className={s.navLinkItem}>
          <a href={n.href} onPointerEnter={() => setHovered(n.href)}>
            {n.label}
          </a>
          {hovered === n.href && (
            <m.span
              layoutId="nav-hover-pill"
              className={s.navHoverPill}
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
            />
          )}
        </li>
      ))}
    </ul>
  );
}

export function SiteHeader({ links, logoHref }: { links: NavLink[]; logoHref: string }) {
  const scrolled = useScrolled();
  return (
    <m.header
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE_PREMIUM }}
      className={`${s.nav} ${scrolled ? s.navScrolled : ""}`}
    >
      <div className={`${s.container} ${s.navInner}`}>
        <Logo href={logoHref} />
        <nav aria-label="Primary" className={s.navPrimary}>
          <NavLinks links={links} />
        </nav>
        <div className={s.navActions}>
          <a href={appHref("/login")} className={`${s.btn} ${s.btnGhost}`}>
            Sign in
          </a>
          <MagneticButton>
            <BookDemoButton className={`${s.btn} ${s.btnPrimary}`}>Book a demo</BookDemoButton>
          </MagneticButton>
        </div>
        <MobileMenu links={links} />
      </div>
    </m.header>
  );
}

export function SiteFooter() {
  return (
    <footer className={s.footer}>
      <div className={s.container}>
        <Reveal as="div" className={s.footerGrid} y={16} amount={0.2}>
          <div className={s.footerBrand}>
            <FooterLogo />
            <p className={s.footerAbout}>
              Timesheets, payroll, billing and operations software for manpower suppliers in the UAE and GCC.
            </p>
          </div>
          {FOOTER.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <p className={s.footerTitle}>{col.title}</p>
              <ul className={s.footerList}>
                {col.links.map((l) => (
                  <li key={l.label}>
                    {l.label === "Book a demo" ? (
                      <BookDemoButton className={s.footerDemoLink}>{l.label}</BookDemoButton>
                    ) : (
                      <a href={l.href}>{l.label}</a>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </Reveal>
        <div className={s.footerBottom}>
          <span>
            &copy; {new Date().getFullYear()} {SITE.name}. All rights reserved.
          </span>
          <span>Made for the people who build the region.</span>
        </div>
      </div>
    </footer>
  );
}
