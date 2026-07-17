import { fmtEUR } from "@/lib/api";

export default function ProgressGoal({ label, current, target, colorClass = "bg-emerald-500", subLeft, subRight, testid }) {
  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  return (
    <div className="bg-[#121212] border border-neutral-800 rounded-md p-5" data-testid={testid}>
      <div className="flex items-center justify-between mb-3">
        <div className="label-eyebrow">{label}</div>
        <div className="font-mono-num text-xs text-neutral-400">{pct.toFixed(1)}%</div>
      </div>
      <div className="flex items-baseline justify-between">
        <div className="font-mono-num text-2xl font-bold">{fmtEUR(current)}</div>
        <div className="font-mono-num text-sm text-neutral-500">/ {fmtEUR(target)}</div>
      </div>
      <div className="w-full h-2 bg-neutral-800 rounded-sm mt-4 overflow-hidden">
        <div className={`h-full ${colorClass} transition-[width] duration-500`} style={{ width: `${pct}%` }} />
      </div>
      {(subLeft || subRight) && (
        <div className="flex items-center justify-between mt-3 text-xs text-neutral-500 font-mono-num">
          <span>{subLeft}</span>
          <span>{subRight}</span>
        </div>
      )}
    </div>
  );
}
