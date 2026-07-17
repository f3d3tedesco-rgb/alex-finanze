import useSWR from "swr";
import { api, fmtEUR, fmtMese } from "@/lib/api";
import { ChartPieSlice } from "@phosphor-icons/react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";

const fetcher = (url) => api.get(url).then((r) => r.data);

const ASSETS = [
  { key: "etf", label: "ETF Core", color: "#10B981" },
  { key: "satellite", label: "Satellite", color: "#F59E0B" },
  { key: "priamo", label: "Priamo (Pensione)", color: "#6366F1" },
  { key: "fondo_figlia", label: "Fondo Figlia", color: "#EC4899" },
  { key: "fondo_famiglia", label: "Fondo Famiglia", color: "#22D3EE" },
];

export default function Investimenti() {
  const { data } = useSWR("/dashboard", fetcher);
  if (!data) return <div className="p-8 text-neutral-500">Caricamento...</div>;
  const { history, last } = data;

  return (
    <div className="p-6 md:p-8 pb-24 md:pb-8 space-y-6" data-testid="investimenti-page">
      <div className="flex items-center gap-3">
        <ChartPieSlice size={28} weight="bold" className="text-emerald-400" />
        <div>
          <div className="label-eyebrow">Portafoglio</div>
          <h1 className="font-heading text-4xl font-bold mt-1">Investimenti</h1>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {ASSETS.map((a) => (
          <div key={a.key} className="bg-[#121212] border border-neutral-800 rounded-md p-5" data-testid={`asset-${a.key}`}>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: a.color }} />
              <div className="label-eyebrow">{a.label}</div>
            </div>
            <div className="font-mono-num text-2xl font-bold mt-3">{fmtEUR(last[a.key])}</div>
          </div>
        ))}
      </div>

      <div className="bg-[#121212] border border-neutral-800 rounded-md p-6">
        <div className="label-eyebrow mb-1">Andamento cumulativo</div>
        <h3 className="font-heading text-xl font-bold mb-4">Crescita degli Asset nel Tempo</h3>
        <div className="h-96">
          <ResponsiveContainer>
            <LineChart data={history}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="mese" tickFormatter={fmtMese} stroke="#71717a" />
              <YAxis stroke="#71717a" tickFormatter={(v) => `€${(v/1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: "#0A0A0A", border: "1px solid #3f3f46", borderRadius: 4 }}
                labelFormatter={fmtMese}
                formatter={(v) => fmtEUR(v)}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: "#a1a1aa" }} />
              {ASSETS.map((a) => (
                <Line key={a.key} type="monotone" dataKey={a.key} name={a.label} stroke={a.color} strokeWidth={2} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-[#121212] border border-neutral-800 rounded-md overflow-hidden">
        <div className="p-5 border-b border-neutral-800">
          <div className="label-eyebrow">Storico mensile</div>
          <h3 className="font-heading text-lg font-bold mt-1">Movimenti Cumulati</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-black text-neutral-500 uppercase text-xs tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left">Mese</th>
                {ASSETS.map((a) => (<th key={a.key} className="px-4 py-3 text-right">{a.label}</th>))}
                <th className="px-4 py-3 text-right">Fondo Em.</th>
                <th className="px-4 py-3 text-right text-emerald-400">Patrimonio Netto</th>
              </tr>
            </thead>
            <tbody>
              {[...history].reverse().map((r) => (
                <tr key={r.mese} className="border-t border-neutral-900 hover:bg-neutral-900/50">
                  <td className="px-4 py-3 font-mono-num">{fmtMese(r.mese)}</td>
                  {ASSETS.map((a) => (
                    <td key={a.key} className="px-4 py-3 text-right font-mono-num text-neutral-300">{fmtEUR(r[a.key])}</td>
                  ))}
                  <td className="px-4 py-3 text-right font-mono-num text-neutral-300">{fmtEUR(r.fondo_emergenza)}</td>
                  <td className="px-4 py-3 text-right font-mono-num font-bold text-emerald-400">{fmtEUR(r.patrimonio_netto)}</td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr><td colSpan={ASSETS.length + 3} className="px-4 py-8 text-center text-neutral-500">Nessun mese ancora inserito</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
