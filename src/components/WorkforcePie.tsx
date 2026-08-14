"use client";

import { useRouter } from "next/navigation";

export function WorkforcePie({ onWork, bench }: { onWork: number; bench: number }) {
  const router = useRouter();
  const total = onWork + bench;

  if (total === 0) {
    return <p className="text-sm text-muted">No employees on record yet.</p>;
  }

  const RADIUS = 60;
  const STROKE = 18;
  const circumference = 2 * Math.PI * RADIUS;
  const onWorkLen = (onWork / total) * circumference;
  const benchLen = circumference - onWorkLen;
  const pct = Math.round((onWork / total) * 100);

  return (
    <div className="flex flex-wrap items-center gap-10">
      <div className="relative h-[160px] w-[160px] shrink-0">
        <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90">
          <circle cx="80" cy="80" r={RADIUS} fill="none" stroke="#e2e8f0" strokeWidth={STROKE} />
          {onWork > 0 && (
            <circle
              cx="80"
              cy="80"
              r={RADIUS}
              fill="none"
              stroke="#2563eb"
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={`${onWorkLen} ${circumference}`}
              className="cursor-pointer transition hover:opacity-80"
              onClick={() => router.push("/employees?filter=on-work")}
            />
          )}
          {bench > 0 && (
            <circle
              cx="80"
              cy="80"
              r={RADIUS}
              fill="none"
              stroke="#f59e0b"
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={`${benchLen} ${circumference}`}
              strokeDashoffset={-onWorkLen}
              className="cursor-pointer transition hover:opacity-80"
              onClick={() => router.push("/employees?filter=bench")}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-3xl font-semibold text-primary">{pct}%</p>
          <p className="text-xs text-muted">On work</p>
        </div>
      </div>
      <div className="space-y-3 text-sm">
        <button
          type="button"
          onClick={() => router.push("/employees?filter=on-work")}
          className="flex items-center gap-2 hover:underline"
        >
          <span className="h-3 w-3 shrink-0 rounded-full bg-[#2563eb]" />
          <span className="font-medium text-primary">{onWork}</span>
          <span className="text-muted">on work</span>
        </button>
        <button
          type="button"
          onClick={() => router.push("/employees?filter=bench")}
          className="flex items-center gap-2 hover:underline"
        >
          <span className="h-3 w-3 shrink-0 rounded-full bg-amber-500" />
          <span className="font-medium text-primary">{bench}</span>
          <span className="text-muted">on bench</span>
        </button>
      </div>
    </div>
  );
}
