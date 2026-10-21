"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { BrowserFrame } from "./showcase/showcase";
import h from "./home.module.css";

type Step = { title: string; body: string; src: string; width: number; height: number; alt: string };

const INTERVAL_MS = 6000;
const QUERY = "(prefers-reduced-motion: reduce)";
const subscribe = (cb: () => void) => {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const getReduced = () => window.matchMedia(QUERY).matches;

/**
 * A silent product walkthrough: four real screens that advance on their own and can be
 * picked directly. Every screen is in the HTML, so crawlers and no-JS visitors see them
 * all; the motion is skipped for visitors who prefer reduced motion.
 */
export function Walkthrough({ steps }: { steps: Step[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  // Treated as reduced on the server so the first paint never animates.
  const reduced = useSyncExternalStore(subscribe, getReduced, () => true);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reduced || paused) return;
    const id = window.setTimeout(() => setI((n) => (n + 1) % steps.length), INTERVAL_MS);
    return () => window.clearTimeout(id);
  }, [i, paused, reduced, steps.length]);

  return (
    <div
      ref={root}
      className={`${h.walk} ${paused ? h.walkPaused : ""}`}
      style={{ ["--walk-ms" as string]: `${INTERVAL_MS}ms` }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <ul className={h.walkTabs}>
        {steps.map((s, n) => (
          <li key={s.title}>
            <button type="button" className={`${h.walkTab} ${n === i ? h.walkTabOn : ""}`} aria-pressed={n === i} onClick={() => setI(n)}>
              <strong>
                {n + 1}. {s.title}
              </strong>
              <span>{s.body}</span>
              {n === i && <i key={`${i}-${paused}`} className={`${h.walkBar} ${reduced ? h.walkBarStill : h.walkBarRun}`} />}
            </button>
          </li>
        ))}
      </ul>
      <div>
        <BrowserFrame>
          <div className={h.walkStage}>
            {steps.map((s, n) => (
              <div key={s.src} className={`${h.walkShot} ${n === i ? h.walkShotOn : ""}`} aria-hidden={n !== i}>
                {/* eslint-disable-next-line @next/next/no-img-element -- static, pre-optimised WebP from /public */}
                <img src={s.src} width={s.width} height={s.height} alt={s.alt} loading={n === 0 ? "eager" : "lazy"} decoding="async" />
              </div>
            ))}
          </div>
        </BrowserFrame>
      </div>
    </div>
  );
}
