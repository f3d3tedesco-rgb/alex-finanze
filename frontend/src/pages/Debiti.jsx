import useSWR from "swr";
import { api, fmtEUR, fmtMese } from "@/lib/api";
import { CreditCard, Calendar } from "@phosphor-icons/react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

const fetcher = (url) => api.get(url).then((r) => r.data);

export default function Debiti() {
  const { data: dash } = useSWR("/dashboard", fetcher);
  const { data: plan } = useSWR("/debt-plan", fetcher);
  if (!dash || !plan) return <div className="p-8 text-neutral-500">Caricamento...</div>;
  const { history, debito } = dash;

  const rimborsato = Math.max(0, debito.residuo_iniziale - debito.residuo_attuale);
  const pct = debito.residuo_iniziale > 0 ? (rimborsato / debito.residuo_iniziale) * 100 : 0;

  return (
    <div className="p-6 md:p-8 pb-24 md:pb-8 space-y-6" data-testid="debiti-page">
      <div className="flex items-center gap-3">
        <CreditCard size={28} weight="bold" className="text-red-400" />
        <div>
          <div className="label-eyebrow">Piano di rientro</div>
          <h1 className="font-heading text-4xl font-bold mt-1">Debito Zio</h1>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { l: "Residuo attuale", v: fmtEUR(debito.residuo_attuale), tone: "text-red-400" },
          { l: "Rimborsato", v: fmtEUR(rimborsato), tone: "text-emerald-400" },
          { l: "Rata mensile", v: fmtEUR(debito.rata_mensile), tone: "text-white" },
          { l: "Estinzione stimata", v: fmtMese(plan.data_estinzione), tone: "text-indigo-400" },
        ].map((k) => (
          <div key={k.l} className="bg-[#121212] border border-neutral-800 rounded-md p-5">
            <div className="label-eyebrow">{k.l}</div>
            <div className={`font-mono-num text-2xl font-bold mt-3 ${k.tone}`}>{k.v}</div>
          </div>
        ))}
      </div>

      <div className="bg-[#121212] border border-neutral-800 rounded-md p-6">
        <div className="flex items-end justify-between mb-3">
          <div>
            <div className="label-eyebrow">Progresso</div>
            <h3 className="font-heading text-xl font-bold mt-1">Rimborso Cumulativo</h3>
          </div>
          <div className="font-mono-num text-3xl font-bold text-emerald-400">{pct.toFixed(1)}%</div>
        </div>
        <div className="w-full h-3 bg-neutral-800 rounded-sm overflow-hidden">
          <div className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex justify-between text-xs text-neutral-500 mt-2 font-mono-num">
          <span>Iniziale: {fmtEUR(debito.residuo_iniziale)}</span>
          <span>Mancano {plan.mesi_rimanenti} mesi</span>
        </div>
      </div>

      {history.length > 0 && (
        <div className="bg-[#121212] border border-neutral-800 rounded-md p-6">
          <div className="label-eyebrow mb-1">Curva reale</div>
          <h3 className="font-heading text-xl font-bold mb-4">Residuo nei mesi passati</h3>
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
                <YAxis stroke="#71717a" tickFormatter={(v) => `€${(v/1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: "#0A0A0A", border: "1px solid #3f3f46", borderRadius: 4 }}
                  labelFormatter={fmtMese}
                  formatter={(v) => fmtEUR(v)}
                />
                <Area type="monotone" dataKey="debito_residuo" name="Residuo" stroke="#FF3B30" strokeWidth={2} fill="url(#gDeb)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="bg-[#121212] border border-neutral-800 rounded-md overflow-hidden">
        <div className="p-5 border-b border-neutral-800 flex items-center gap-2">
          <Calendar size={18} className="text-neutral-500" />
          <h3 className="font-heading text-lg font-bold">Piano di rientro previsionale</h3>
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
              {plan.piano.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-neutral-500">Nessun debito residuo o dati mancanti</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
