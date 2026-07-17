import { useState } from "react";
import useSWR from "swr";
import { api, fmtEUR, fmtMese } from "@/lib/api";
import { CreditCard, Calendar } from "@phosphor-icons/react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

const fetcher = (url) => api.get(url).then((r) => r.data);

export default function Debiti() {
  const { data: dash } = useSWR("/dashboard", fetcher);
  const [selectedId, setSelectedId] = useState(null);
  const activeId = selectedId || dash?.debts?.[0]?.id;
  const { data: plan } = useSWR(activeId ? `/debt-plan/${activeId}` : null, fetcher);

  if (!dash) return <div className="p-8 text-neutral-500">Caricamento...</div>;
  const { history, debts } = dash;

  const totalIniziale = debts.reduce((s, d) => s + d.residuo_iniziale, 0);
  const totalPagato = debts.reduce((s, d) => s + d.pagato, 0);
  const totalResiduo = debts.reduce((s, d) => s + d.residuo_attuale, 0);
  const pct = totalIniziale > 0 ? (totalPagato / totalIniziale) * 100 : 0;

  return (
    <div className="p-6 md:p-8 pb-24 md:pb-8 space-y-6" data-testid="debiti-page">
      <div className="flex items-center gap-3">
        <CreditCard size={28} weight="bold" className="text-red-400" />
        <div>
          <div className="label-eyebrow">Piani di rientro</div>
          <h1 className="font-heading text-4xl font-bold mt-1">Debiti</h1>
        </div>
      </div>

      {debts.length === 0 ? (
        <div className="bg-[#121212] border border-dashed border-neutral-800 rounded-md p-12 text-center">
          <CreditCard size={40} className="text-neutral-700 mx-auto mb-3" />
          <p className="text-neutral-500 text-sm">Nessun debito attivo. Complimenti!</p>
          <p className="text-neutral-600 text-xs mt-2">Aggiungine uno in Impostazioni → Debiti se necessario.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#121212] border border-neutral-800 rounded-md p-5">
              <div className="label-eyebrow">Residuo totale</div>
              <div className="font-mono-num text-2xl font-bold mt-3 text-red-400">{fmtEUR(totalResiduo)}</div>
            </div>
            <div className="bg-[#121212] border border-neutral-800 rounded-md p-5">
              <div className="label-eyebrow">Rimborsato</div>
              <div className="font-mono-num text-2xl font-bold mt-3 text-emerald-400">{fmtEUR(totalPagato)}</div>
            </div>
            <div className="bg-[#121212] border border-neutral-800 rounded-md p-5">
              <div className="label-eyebrow">Progresso</div>
              <div className="font-mono-num text-2xl font-bold mt-3 text-white">{pct.toFixed(1)}%</div>
            </div>
            <div className="bg-[#121212] border border-neutral-800 rounded-md p-5">
              <div className="label-eyebrow">Debiti attivi</div>
              <div className="font-mono-num text-2xl font-bold mt-3 text-indigo-400">{debts.length}</div>
            </div>
          </div>

          {/* Debts list */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {debts.map((d) => {
              const dPct = d.residuo_iniziale > 0 ? (d.pagato / d.residuo_iniziale) * 100 : 0;
              return (
                <button key={d.id} onClick={() => setSelectedId(d.id)}
                  className={`text-left bg-[#121212] border rounded-md p-5 transition-colors ${activeId === d.id ? "border-red-500/60" : "border-neutral-800 hover:border-neutral-700"}`}
                  data-testid={`debt-card-${d.id}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                    <div className="label-eyebrow">Debito</div>
                  </div>
                  <h3 className="font-heading text-lg font-bold">{d.name}</h3>
                  <div className="flex items-baseline justify-between mt-3">
                    <div className="font-mono-num text-xl font-bold text-red-400">{fmtEUR(d.residuo_attuale)}</div>
                    <div className="font-mono-num text-xs text-neutral-500">/ {fmtEUR(d.residuo_iniziale)}</div>
                  </div>
                  <div className="w-full h-2 bg-neutral-800 rounded-sm mt-3 overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: `${dPct}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-neutral-500 mt-2 font-mono-num">
                    <span>Rata {fmtEUR(d.rata_mensile)}/mese</span>
                    <span>{dPct.toFixed(1)}% rimborsato</span>
                  </div>
                  {d.note && <p className="text-xs text-neutral-400 mt-3 border-t border-neutral-800 pt-3">{d.note}</p>}
                </button>
              );
            })}
          </div>

          {history.length > 0 && (
            <div className="bg-[#121212] border border-neutral-800 rounded-md p-6">
              <div className="label-eyebrow mb-1">Curva reale</div>
              <h3 className="font-heading text-xl font-bold mb-4">Debito Totale nel Tempo</h3>
              <div className="h-64">
                <ResponsiveContainer>
                  <AreaChart data={history}>
                    <defs>
                      <linearGradient id="gDeb" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#FF3B30" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="#FF3B30" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis dataKey="mese" tickFormatter={fmtMese} stroke="#71717a" />
                    <YAxis stroke="#71717a" tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={{ background: "#0A0A0A", border: "1px solid #3f3f46", borderRadius: 4 }}
                      labelFormatter={fmtMese} formatter={(v) => fmtEUR(v)} />
                    <Area type="monotone" dataKey="debito_residuo" name="Residuo"
                      stroke="#FF3B30" strokeWidth={2} fill="url(#gDeb)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {plan && (
            <div className="bg-[#121212] border border-neutral-800 rounded-md overflow-hidden">
              <div className="p-5 border-b border-neutral-800 flex items-center gap-2">
                <Calendar size={18} className="text-neutral-500" />
                <h3 className="font-heading text-lg font-bold">
                  Piano rientro previsionale — {plan.debt.name}
                </h3>
                <span className="ml-auto text-xs text-neutral-500 font-mono-num">
                  {plan.mesi_rimanenti} mesi · estinzione {fmtMese(plan.data_estinzione)}
                </span>
              </div>
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-black text-neutral-500 uppercase text-xs tracking-wider sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left">N.</th>
                      <th className="px-4 py-3 text-left">Mese</th>
                      <th className="px-4 py-3 text-right">Residuo inizio</th>
                      <th className="px-4 py-3 text-right">Pagamento</th>
                      <th className="px-4 py-3 text-right">Residuo fine</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.piano.map((r) => (
                      <tr key={r.n_mese} className="border-t border-neutral-900 hover:bg-neutral-900/50">
                        <td className="px-4 py-2.5 font-mono-num text-neutral-500">{r.n_mese}</td>
                        <td className="px-4 py-2.5 font-mono-num">{fmtMese(r.mese)}</td>
                        <td className="px-4 py-2.5 text-right font-mono-num text-neutral-300">{fmtEUR(r.residuo_inizio)}</td>
                        <td className="px-4 py-2.5 text-right font-mono-num text-red-400">-{fmtEUR(r.pagamento)}</td>
                        <td className="px-4 py-2.5 text-right font-mono-num text-emerald-400">{fmtEUR(r.residuo_fine)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
