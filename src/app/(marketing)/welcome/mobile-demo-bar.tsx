"use client";

import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { BookDemoButton } from "@/components/BookDemoButton";
import w from "./welcome.module.css";
import h from "./home.module.css";

/** A thin "Book a demo" bar for phones, shown once the visitor has scrolled past the hero. */
export function MobileDemoBar() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const on = () => setShow(window.scrollY > 600);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <div className={`${h.bar} ${show ? h.barShow : ""}`} aria-hidden={!show}>
      <span>
        <strong>See it on your own workbook</strong>A 30-minute call
      </span>
      <BookDemoButton className={`${w.btn} ${w.btnPrimary}`}>
        Book a demo <ArrowRight size={15} aria-hidden />
      </BookDemoButton>
    </div>
  );
}
