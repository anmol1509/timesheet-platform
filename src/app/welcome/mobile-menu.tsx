"use client";

import { useRef } from "react";
import { Menu } from "lucide-react";
import { appHref } from "./content";
import type { NavLink } from "./site-chrome";
import { BookDemoButton } from "@/components/BookDemoButton";
import s from "./welcome.module.css";

export function MobileMenu({ links }: { links: NavLink[] }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const close = () => ref.current?.removeAttribute("open");

  return (
    <details ref={ref} className={s.mobileMenu}>
      <summary aria-label="Open menu">
        <Menu size={20} />
      </summary>
      <div className={s.mobilePanel}>
        {links.map((n) => (
          <a key={n.href} href={n.href} onClick={close}>
            {n.label}
          </a>
        ))}
        <a href={appHref("/login")}>Sign in</a>
        <BookDemoButton className={`${s.btn} ${s.btnPrimary} ${s.btnLg}`} onClick={close}>
          Book a demo
        </BookDemoButton>
      </div>
    </details>
  );
}
