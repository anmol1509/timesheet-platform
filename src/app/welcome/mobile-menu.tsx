"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, m } from "motion/react";
import { ChevronDown, Menu, X } from "lucide-react";
import { BookDemoButton } from "@/components/BookDemoButton";
import { SITE_NAV, navHrefs } from "./nav-data";
import { SIGN_INS } from "./sign-ins";
import { EASE_PREMIUM } from "./motion";
import s from "./welcome.module.css";

/**
 * Full-screen sheet with one collapsible section per nav group. Replaces the
 * old flat `<details>` list, which couldn't grow past a handful of links and
 * ignored Escape, outside taps and background scroll.
 */
export function MobileMenu({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<string | null>(null);
  // The sheet is portalled to <body>: the header carries a Motion-driven
  // `transform`, which makes it a containing block for fixed-position
  // descendants — the scrim would otherwise size to the nav pill instead of
  // the viewport. `mounted` is false on the server and true once hydrated,
  // so the portal never runs during the server render.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Whichever group holds the current page — expanded by default on open.
  const activeGroup =
    SITE_NAV.find(
      (e) =>
        e.columns &&
        navHrefs(e).some((h) => pathname === h || pathname.startsWith(h + "/")),
    )?.label ?? null;

  return (
    <div className={s.mobileMenu}>
      <button
        type="button"
        className={s.mobileTrigger}
        aria-label="Open menu"
        aria-expanded={open}
        onClick={() => {
          setSection(activeGroup);
          setOpen(true);
        }}
      >
        <Menu size={20} />
      </button>
      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && (
              <m.div
                className={s.sheetScrim}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => setOpen(false)}
              >
                <m.div
                  className={s.sheet}
                  role="dialog"
                  aria-modal="true"
                  aria-label="Menu"
                  initial={{ y: "-4%", opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{
                    y: "-3%",
                    opacity: 0,
                    transition: { duration: 0.16, ease: "easeIn" },
                  }}
                  transition={{ duration: 0.28, ease: EASE_PREMIUM }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className={s.sheetHead}>
                    <span className={s.sheetTitle}>Menu</span>
                    <button
                      type="button"
                      className={s.mobileTrigger}
                      aria-label="Close menu"
                      onClick={() => setOpen(false)}
                    >
                      <X size={20} />
                    </button>
                  </div>

                  <div className={s.sheetBody}>
                    {SITE_NAV.map((entry) =>
                      entry.columns ? (
                        <div key={entry.label} className={s.sheetGroup}>
                          <button
                            type="button"
                            className={s.sheetRow}
                            aria-expanded={section === entry.label}
                            onClick={() =>
                              setSection(
                                section === entry.label ? null : entry.label,
                              )
                            }
                          >
                            {entry.label}
                            <ChevronDown
                              size={18}
                              strokeWidth={2}
                              className={
                                section === entry.label
                                  ? s.navChevronOpen
                                  : s.navChevron
                              }
                              aria-hidden
                            />
                          </button>
                          <AnimatePresence initial={false}>
                            {section === entry.label && (
                              <m.div
                                className={s.sheetSub}
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{
                                  duration: 0.24,
                                  ease: EASE_PREMIUM,
                                }}
                              >
                                {entry.columns
                                  .flatMap((c) => c.items)
                                  .map((item) => (
                                    <a
                                      key={item.href}
                                      href={item.href}
                                      onClick={() => setOpen(false)}
                                    >
                                      {item.label}
                                    </a>
                                  ))}
                                <a
                                  href={entry.viewAll.href}
                                  className={s.sheetViewAll}
                                  onClick={() => setOpen(false)}
                                >
                                  {entry.viewAll.label} &rarr;
                                </a>
                              </m.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ) : (
                        <div key={entry.label} className={s.sheetGroup}>
                          <a
                            href={entry.href}
                            className={s.sheetRow}
                            onClick={() => setOpen(false)}
                          >
                            {entry.label}
                          </a>
                        </div>
                      ),
                    )}

                    <p className={s.sheetSectionLabel}>Sign in</p>
                    {SIGN_INS.map((entry) => (
                      <a
                        key={entry.href}
                        href={entry.href}
                        className={s.sheetSignIn}
                        onClick={() => setOpen(false)}
                      >
                        {entry.label}
                      </a>
                    ))}
                  </div>

                  <div className={s.sheetFoot}>
                    <BookDemoButton
                      className={`${s.btn} ${s.btnPrimary} ${s.btnLg}`}
                      onClick={() => setOpen(false)}
                    >
                      Book a demo
                    </BookDemoButton>
                  </div>
                </m.div>
              </m.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}
