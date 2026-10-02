"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, m } from "motion/react";
import { ChevronDown } from "lucide-react";
import { BRAND_ICON, BRAND_LOGO, BRAND_LOGO_ASPECT } from "@/lib/brand-assets";
import { BookDemoButton } from "@/components/BookDemoButton";
import { FOOTER, SITE } from "./content";
import { ICONS } from "./content-blocks";
import { MobileMenu } from "./mobile-menu";
import { SIGN_INS } from "./sign-ins";
import { SITE_NAV, navHrefs, type NavEntry } from "./nav-data";
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

/** True when `pathname` is this href or a page nested under it. */
function matches(pathname: string, href: string) {
  if (!href.startsWith("/")) return false;
  return pathname === href || pathname.startsWith(href + "/");
}

function MenuPanel({ entry, onNavigate }: { entry: Extract<NavEntry, { columns: object }>; onNavigate: () => void }) {
  return (
    <m.div
      className={s.megaPanel}
      style={{ width: `min(${entry.width}px, calc(100vw - 32px))` }}
      initial={{ opacity: 0, y: -8, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.985, transition: { duration: 0.14, ease: "easeIn" } }}
      transition={{ duration: 0.22, ease: EASE_PREMIUM }}
    >
      <div className={s.megaCols} style={{ gridTemplateColumns: `repeat(${entry.columns.length}, minmax(0, 1fr))` }}>
        {entry.columns.map((col, ci) => (
          <div key={`${col.title}-${ci}`}>
            <p className={s.megaColTitle}>{col.title}</p>
            <ul className={s.megaList}>
              {col.items.map((item) => {
                const Icon = item.icon ? ICONS[item.icon] : null;
                return (
                  <li key={item.href}>
                    <a href={item.href} className={s.megaLink} onClick={onNavigate}>
                      {Icon && (
                        <span className={s.megaIcon} aria-hidden>
                          <Icon size={16} strokeWidth={1.8} />
                        </span>
                      )}
                      <span className={s.megaCopy}>
                        <span className={s.megaLabel}>{item.label}</span>
                        {item.description && <span className={s.megaDesc}>{item.description}</span>}
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      <a href={entry.viewAll.href} className={s.megaFoot} onClick={onNavigate}>
        {entry.viewAll.label}
        <ICONS.arrow size={15} strokeWidth={2} />
      </a>
    </m.div>
  );
}

function NavLinks({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  // Moving the pointer from a trigger to its panel crosses a 10px gap, so
  // closing is delayed just long enough to survive that trip.
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }, []);
  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(null), 140);
  }, [cancelClose]);
  const closeNow = useCallback(() => {
    cancelClose();
    setOpen(null);
  }, [cancelClose]);

  useEffect(() => () => cancelClose(), [cancelClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeNow();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, closeNow]);

  const active = SITE_NAV.find((e) => navHrefs(e).some((h) => matches(pathname, h)));
  const openEntry = SITE_NAV.find((e) => e.label === open && e.columns);

  return (
    <div className={s.navMenuRoot} onPointerLeave={scheduleClose} onPointerEnter={cancelClose}>
      <ul className={s.navLinks} onPointerLeave={() => setHovered(null)}>
        {SITE_NAV.map((entry) => {
          const isActive = active?.label === entry.label;
          const isOpen = open === entry.label;
          const shared = {
            className: `${s.navLink} ${isActive ? s.navLinkActive : ""}`,
            onPointerEnter: () => {
              setHovered(entry.label);
              cancelClose();
              setOpen(entry.columns ? entry.label : null);
            },
          };
          return (
            <li key={entry.label} className={s.navLinkItem}>
              {entry.columns ? (
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-haspopup="true"
                  onClick={() => setOpen(isOpen ? null : entry.label)}
                  {...shared}
                >
                  {entry.label}
                  <ChevronDown size={14} strokeWidth={2.2} className={isOpen ? s.navChevronOpen : s.navChevron} aria-hidden />
                </button>
              ) : (
                <a href={entry.href} {...shared}>
                  {entry.label}
                </a>
              )}
              {hovered === entry.label && (
                <m.span
                  layoutId="nav-hover-pill"
                  className={s.navHoverPill}
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
            </li>
          );
        })}
      </ul>
      <div className={s.megaWrap}>
        <AnimatePresence>
          {openEntry?.columns && <MenuPanel key={openEntry.label} entry={openEntry} onNavigate={closeNow} />}
        </AnimatePresence>
      </div>
    </div>
  );
}

/** Sign in goes straight to the staff workspace for now; the employee and supplier portals are reachable from the footer. */
function SignInMenu() {
  return (
    <a href={SIGN_INS[0].href} className={`${s.btn} ${s.btnGhost}`}>
      Sign in
    </a>
  );
}

export function SiteHeader({ logoHref = "/" }: { logoHref?: string }) {
  const scrolled = useScrolled();
  const pathname = usePathname() ?? "/";
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
          <NavLinks pathname={pathname} />
        </nav>
        <div className={s.navActions}>
          <SignInMenu />
          <MagneticButton>
            <BookDemoButton className={`${s.btn} ${s.btnPrimary}`}>Book a demo</BookDemoButton>
          </MagneticButton>
        </div>
        <MobileMenu pathname={pathname} />
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
