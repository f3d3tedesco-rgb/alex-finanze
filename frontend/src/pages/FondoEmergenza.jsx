import useSWR from "swr";
import { api, fmtEUR, fmtMese } from "@/lib/api";
import { Lifebuoy, ShieldCheck } from "@phosphor-icons/react";
import ProgressGoal from "@/components/ProgressGoal";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

const fetcher = (url) => api.get(url).then((r) => r.data);

export default function FondoEmergenza() {
  const { data } = useSWR("/dashboard", fetcher);
  if (!data) return <div className="p-8 text-neutral-500">Caricamento...</div>;
  const { fondo_emergenza, history, last } = data;

  return (
    <div className="p-6 md:p-8 pb-24 md:pb-8 space-y-6" data-testid="emergenza-page">
      <div className="flex items-center gap-3">
        <Lifebuoy size={28} weight="bold" className="text-emerald-400" />
        <div>
          <div className="label-eyebrow">Cuscinetto di sicurezza</div>
          <h1 className="font-heading text-4xl font-bold mt-1">Fondo Emergenza</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ProgressGoal
          testid="fe-progress"
          label="Progresso verso il target"
          current={fondo_emergenza.attuale}
          target={fondo_emergenza.target}
          colorClass="bg-emerald-500"
          subLeft={`${fondo_emergenza.copertura_mesi.toFixed(1)} / ${fondo_emergenza.mesi_target} mesi`}
          subRight={`Gap ${fmtEUR(fondo_emergenza.gap)}`}
        />
        <div className="bg-[#121212] border border-neutral-800 rounded-md p-5">
          <div className="label-eyebrow">Copertura mesi</div>
          <div className="font-mono-num text-3xl font-bold text-emerald-400 mt-3">
            {fondo_emergenza.copertura_mesi.toFixed(1)}
          </div>
          <div className="text-xs text-neutral-500 mt-2">Mesi di spese essenziali coperti</div>
        </div>
        <div className="bg-[#121212] border border-neutral-800 rounded-md p-5">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck size={16} className="text-emerald-400" />
            <div className="label-eyebrow">Stato</div>
          </div>
          <div className={`font-mono-num text-2xl font-bold mt-1 ${fondo_emergenza.copertura_mesi >= fondo_emergenza.mesi_target ? "text-emerald-400" : "text-amber-400"}`}>
            {fondo_emergenza.copertura_mesi >= fondo_emergenza.mesi_target ? "COMPLETATO" : "IN COSTRUZIONE"}
          </div>
          <div className="text-xs text-neutral-500 mt-2">Regola: mai usare questo fondo per investire</div>
        </div>
      </div>

      <div className="bg-[#121212] border border-neutral-800 rounded-md p-6">
        <div className="label-eyebrow mb-1">Andamento</div>
        <h3 className="font-heading text-xl font-bold mb-4">Crescita del Fondo Emergenza</h3>
        <div className="h-72">
          <ResponsiveContainer>
            <AreaChart data={history}>
              <defs>
                <linearGradient id="gFe" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="mese" tickFormatter={fmtMese} stroke="#71717a" />
              <YAxis stroke="#71717a" tickFormatter={(v) => `€${v}`} />
              <Tooltip
                contentStyle={{ background: "#0A0A0A", border: "1px solid #3f3f46", borderRadius: 4 }}
                labelFormatter={fmtMese}
                formatter={(v) => fmtEUR(v)}
              />
              <Area type="monotone" dataKey="fondo_emergenza" name="Fondo Emergenza" stroke="#10B981" strokeWidth={2} fill="url(#gFe)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-[#121212] border border-neutral-800 rounded-md p-6">
        <div className="label-eyebrow mb-1">Liquidità operativa</div>
        <h3 className="font-heading text-xl font-bold mb-4">Conti Correnti (ultimo mese)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 border border-neutral-800 rounded-sm">
            <div className="label-eyebrow">Revolut</div>
            <div className="font-mono-num text-2xl font-bold mt-2">{fmtEUR(history[history.length - 1]?.liquidita || 0)}</div>
          </div>
          <div className="p-4 border border-neutral-800 rounded-sm">
            <div className="label-eyebrow">Totale liquidità</div>
            <div className="font-mono-num text-2xl font-bold mt-2 text-indigo-400">{fmtEUR(last.liquidita)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
