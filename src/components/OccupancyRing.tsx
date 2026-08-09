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

  return (
    <div className="flex flex-wrap items-center justify-center gap-10">
      <div className="relative h-[180px] w-[180px] shrink-0">
        <svg width="180" height="180" viewBox="0 0 180 180">
          <circle
            cx="90"
            cy="90"
            r={radius}
            fill="none"
            stroke="#DBEAFE"
            strokeWidth={stroke}
          />
          <circle
            cx="90"
            cy="90"
            r={radius}
            fill="none"
            stroke="#2563eb"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${occupiedLength} ${circumference - occupiedLength}`}
            strokeDashoffset={circumference / 4}
            transform="scale(1,-1) translate(0,-180)"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-3xl font-semibold text-slate-900">{pct}%</p>
          <p className="text-xs text-slate-500">Occupied</p>
        </div>
      </div>

      <div className="flex gap-6 text-center">
        <div>
          <p className="text-2xl font-semibold text-slate-900">{occupied}</p>
          <p className="text-xs text-slate-500">Occupied Beds</p>
        </div>
        <div>
          <p className="text-2xl font-semibold text-slate-900">{vacant}</p>
          <p className="text-xs text-slate-500">Available Beds</p>
        </div>
        <div>
          <p className="text-2xl font-semibold text-slate-900">{total}</p>
          <p className="text-xs text-slate-500">Total Beds</p>
        </div>
      </div>
    </div>
  );
}
