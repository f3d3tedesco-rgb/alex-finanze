import useSWR from "swr";
import { api, fmtEUR, fmtMese } from "@/lib/api";
import { ChartPieSlice } from "@phosphor-icons/react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";

const fetcher = (url) => api.get(url).then((r) => r.data);

export default function Investimenti() {
  const { data } = useSWR("/dashboard", fetcher);
  if (!data) return <div className="p-8 text-neutral-500">Caricamento...</div>;
  const { history, last, categories } = data;
  const activeCats = categories.filter((c) => !c.archived);

  // Flatten history for line chart
  const chartData = history.map((h) => {
    const row = { mese: h.mese };
    activeCats.forEach((c) => {
      const v = c.kind === "accumulation" ? (h.accum || {})[c.id] : (h.balance || {})[c.id];
      row[c.id] = v || 0;
    });
    return row;
  });

  return (
    <div className="p-6 md:p-8 pb-24 md:pb-8 space-y-6" data-testid="investimenti-page">
      <div className="flex items-center gap-3">
        <ChartPieSlice size={28} weight="bold" className="text-emerald-400" />
        <div>
          <div className="label-eyebrow">Portafoglio</div>
          <h1 className="font-heading text-4xl font-bold mt-1">Investimenti</h1>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {activeCats.map((c) => {
          const v = c.kind === "accumulation" ? (last.accum || {})[c.id] : (last.balance || {})[c.id];
          return (
            <div key={c.id} className="bg-[#121212] border border-neutral-800 rounded-md p-5" data-testid={`asset-${c.id}`}>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                <div className="label-eyebrow">{c.name}</div>
              </div>
              <div className="font-mono-num text-2xl font-bold mt-3">{fmtEUR(v || 0)}</div>
              <div className="text-xs text-neutral-500 mt-1 font-mono-num">
                {c.kind === "accumulation" ? "PAC cumulato" : "Saldo attuale"}
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-[#121212] border border-neutral-800 rounded-md p-6">
        <div className="label-eyebrow mb-1">Andamento nel tempo</div>
        <h3 className="font-heading text-xl font-bold mb-4">Crescita degli Asset</h3>
        <div className="h-96">
          <ResponsiveContainer>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="mese" tickFormatter={fmtMese} stroke="#71717a" />
              <YAxis stroke="#71717a" tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: "#0A0A0A", border: "1px solid #3f3f46", borderRadius: 4 }}
                labelFormatter={fmtMese} formatter={(v) => fmtEUR(v)} />
              <Legend wrapperStyle={{ fontSize: 12, color: "#a1a1aa" }} />
              {activeCats.map((c) => (
                <Line key={c.id} type="monotone" dataKey={c.id} name={c.name}
                  stroke={c.color} strokeWidth={2} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-[#121212] border border-neutral-800 rounded-md overflow-hidden">
        <div className="p-5 border-b border-neutral-800">
          <div className="label-eyebrow">Storico mensile</div>
          <h3 className="font-heading text-lg font-bold mt-1">Riepilogo Cumulato</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-black text-neutral-500 uppercase text-xs tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left">Mese</th>
                {activeCats.map((c) => <th key={c.id} className="px-4 py-3 text-right">{c.name}</th>)}
                <th className="px-4 py-3 text-right">Fondo Em.</th>
                <th className="px-4 py-3 text-right text-emerald-400">Patrimonio Netto</th>
              </tr>
            </thead>
            <tbody>
              {[...history].reverse().map((r) => (
                <tr key={r.mese} className="border-t border-neutral-900 hover:bg-neutral-900/50">
                  <td className="px-4 py-3 font-mono-num">{fmtMese(r.mese)}</td>
                  {activeCats.map((c) => {
                    const v = c.kind === "accumulation" ? (r.accum || {})[c.id] : (r.balance || {})[c.id];
                    return <td key={c.id} className="px-4 py-3 text-right font-mono-num text-neutral-300">{fmtEUR(v || 0)}</td>;
                  })}
                  <td className="px-4 py-3 text-right font-mono-num text-neutral-300">{fmtEUR(r.fondo_emergenza)}</td>
                  <td className="px-4 py-3 text-right font-mono-num font-bold text-emerald-400">{fmtEUR(r.patrimonio_netto)}</td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr><td colSpan={activeCats.length + 3} className="px-4 py-8 text-center text-neutral-500">
                  Nessun mese ancora inserito
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
