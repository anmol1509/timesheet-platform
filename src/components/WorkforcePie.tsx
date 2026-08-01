"use client";

import { useRouter } from "next/navigation";

export function WorkforcePie({ onWork, bench }: { onWork: number; bench: number }) {
  const router = useRouter();
  const total = onWork + bench;

  if (total === 0) {
    return <p className="text-sm text-slate-500">No employees on record yet.</p>;
  }

  const RADIUS = 40;
  const STROKE = 16;
  const circumference = 2 * Math.PI * RADIUS;
  const onWorkLen = (onWork / total) * circumference;
  const benchLen = circumference - onWorkLen;

  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg viewBox="0 0 100 100" className="h-32 w-32 shrink-0 -rotate-90">
        <circle cx="50" cy="50" r={RADIUS} fill="none" stroke="#e2e8f0" strokeWidth={STROKE} />
        {onWork > 0 && (
          <circle
            cx="50"
            cy="50"
            r={RADIUS}
            fill="none"
            stroke="#0B1642"
            strokeWidth={STROKE}
            strokeDasharray={`${onWorkLen} ${circumference}`}
            strokeLinecap={bench === 0 ? "butt" : "butt"}
            className="cursor-pointer transition hover:opacity-80"
            onClick={() => router.push("/employees?filter=on-work")}
          />
        )}
        {bench > 0 && (
          <circle
            cx="50"
            cy="50"
            r={RADIUS}
            fill="none"
            stroke="#f59e0b"
            strokeWidth={STROKE}
            strokeDasharray={`${benchLen} ${circumference}`}
            strokeDashoffset={-onWorkLen}
            className="cursor-pointer transition hover:opacity-80"
            onClick={() => router.push("/employees?filter=bench")}
          />
        )}
      </svg>
      <div className="space-y-3 text-sm">
        <button
          type="button"
          onClick={() => router.push("/employees?filter=on-work")}
          className="flex items-center gap-2 hover:underline"
        >
          <span className="h-3 w-3 shrink-0 rounded-full bg-[#0B1642]" />
          <span className="font-medium text-slate-900">{onWork}</span>
          <span className="text-slate-500">on work</span>
        </button>
        <button
          type="button"
          onClick={() => router.push("/employees?filter=bench")}
          className="flex items-center gap-2 hover:underline"
        >
          <span className="h-3 w-3 shrink-0 rounded-full bg-amber-500" />
          <span className="font-medium text-slate-900">{bench}</span>
          <span className="text-slate-500">on bench</span>
        </button>
      </div>
    </div>
  );
}
