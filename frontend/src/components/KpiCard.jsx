export default function KpiCard({ label, value, sub, tone = "default", icon: Icon, testid }) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-400"
      : tone === "negative"
      ? "text-red-400"
      : tone === "warn"
      ? "text-amber-400"
      : tone === "ai"
      ? "text-indigo-400"
      : "text-white";
  return (
    <div
      data-testid={testid}
      className="bg-[#121212] border border-neutral-800 rounded-md p-5 hover:border-neutral-700 transition-colors duration-150"
    >
      <div className="flex items-start justify-between">
        <div className="label-eyebrow">{label}</div>
        {Icon ? <Icon size={16} weight="bold" className="text-neutral-500" /> : null}
      </div>
      <div className={`font-mono-num text-2xl md:text-3xl font-bold mt-3 ${toneClass}`}>{value}</div>
      {sub ? <div className="text-xs text-neutral-500 mt-2 font-mono-num">{sub}</div> : null}
    </div>
  );
}
