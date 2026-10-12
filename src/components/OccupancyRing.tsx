"use client";

import { useEffect, useState } from "react";
import { CountUp } from "./CountUp";

export function OccupancyRing({
  occupied,
  vacant,
  pct,
}: {
  occupied: number;
  vacant: number;
  pct: number;
}) {
  const total = occupied + vacant;
  const radius = 70;
  const stroke = 20;
  const circumference = 2 * Math.PI * radius;
  const occupiedLength = total > 0 ? (occupied / total) * circumference : 0;
  const [swept, setSwept] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setSwept(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="flex flex-wrap items-center justify-center gap-10">
      <div className="relative h-[180px] w-[180px] shrink-0">
        <svg width="180" height="180" viewBox="0 0 180 180">
          <circle
            cx="90"
            cy="90"
            r={radius}
            fill="none"
            stroke="var(--surface-sunken)"
            strokeWidth={stroke}
          />
          <circle
            cx="90"
            cy="90"
            r={radius}
            fill="none"
            stroke="var(--brand-primary)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={swept ? `${occupiedLength} ${circumference - occupiedLength}` : `0 ${circumference}`}
            strokeDashoffset={circumference / 4}
            transform="scale(1,-1) translate(0,-180)"
            className="transition-[stroke-dasharray] duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <CountUp value={pct} suffix="%" className="text-3xl font-semibold text-primary" />
          <p className="text-xs text-muted">Occupied</p>
        </div>
      </div>

      <div className="flex gap-6 text-center">
        <div>
          <p className="text-xl tracking-tight text-primary font-semibold"><CountUp value={occupied} /></p>
          <p className="text-xs text-muted">Occupied Beds</p>
        </div>
        <div>
          <p className="text-xl tracking-tight text-primary font-semibold"><CountUp value={vacant} /></p>
          <p className="text-xs text-muted">Available Beds</p>
        </div>
        <div>
          <p className="text-xl tracking-tight text-primary font-semibold"><CountUp value={total} /></p>
          <p className="text-xs text-muted">Total Beds</p>
        </div>
      </div>
    </div>
  );
}
