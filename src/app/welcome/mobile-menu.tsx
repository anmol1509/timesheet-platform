"use client";

import { useRef } from "react";
import { Menu } from "lucide-react";
import { NAV, appHref, demoHref } from "./content";
import s from "./welcome.module.css";

export function MobileMenu() {
  const ref = useRef<HTMLDetailsElement>(null);
  const close = () => ref.current?.removeAttribute("open");

  return (
    <details ref={ref} className={s.mobileMenu}>
      <summary aria-label="Open menu">
        <Menu size={20} />
      </summary>
      <div className={s.mobilePanel}>
        {NAV.map((n) => (
          <a key={n.href} href={n.href} onClick={close}>
            {n.label}
          </a>
        ))}
        <a href={appHref("/login")}>Sign in</a>
        <a href={demoHref} onClick={close} className={`${s.btn} ${s.btnPrimary} ${s.btnLg}`}>
          Book a demo
        </a>
      </div>
    </details>
  );
}
