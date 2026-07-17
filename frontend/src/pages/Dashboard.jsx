import useSWR from "swr";
import { api, fmtEUR, fmtMese } from "@/lib/api";
import KpiCard from "@/components/KpiCard";
import ProgressGoal from "@/components/ProgressGoal";
import {
  Wallet, TrendDown, ChartLine, Lightning, Shield, Coins, ChartBar,
} from "@phosphor-icons/react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";

const fetcher = (url) => api.get(url).then((r) => r.data);

function TooltipBox({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0A0A0A] border border-neutral-700 rounded-sm px-3 py-2 shadow-xl">
      <div className="text-xs text-neutral-400 mb-1 uppercase tracking-wider">{fmtMese(label)}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-neutral-300">{p.name}:</span>
          <span className="font-mono-num text-white">€{Number(p.value).toLocaleString("it-IT")}</span>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { data, isLoading } = useSWR("/dashboard", fetcher);

  if (isLoading || !data) {
    return (
      <div className="p-8 space-y-4 animate-pulse">
        <div className="h-8 w-64 bg-neutral-900 rounded" />
        <div className="grid md:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-28 bg-neutral-900 rounded-md" />)}
        </div>
        <div className="h-80 bg-neutral-900 rounded-md" />
      </div>
    );
  }

  const { last, history, fsi, pac_sustainability, fondo_emergenza, debts, allocation, categories } = data;
  const prev = history.length > 1 ? history[history.length - 2] : null;
  const pnDelta = prev ? last.patrimonio_netto - prev.patrimonio_netto : 0;
  const pnDeltaPct = prev && prev.patrimonio_netto ? (pnDelta / prev.patrimonio_netto) * 100 : 0;
  const fsiTone = fsi.fsi >= 75 ? "positive" : fsi.fsi >= 55 ? "default" : fsi.fsi >= 35 ? "warn" : "negative";
  const totalDebtInitial = debts.reduce((s, d) => s + d.residuo_iniziale, 0);
  const totalDebtPaid = debts.reduce((s, d) => s + d.pagato, 0);

  return (
    <div className="p-6 md:p-8 pb-24 md:pb-8 space-y-8" data-testid="dashboard-page">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="label-eyebrow">Ultimo mese compilato · {fmtMese(last.mese)}</div>
          <h1 className="font-heading text-4xl md:text-5xl font-bold tracking-tight mt-2">Cockpit Finanziario</h1>
          <p className="text-neutral-400 mt-2 text-sm max-w-2xl">
            Visione integrata di patrimonio, debiti e salute finanziaria.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-testid="kpi-grid">
        <KpiCard testid="kpi-patrimonio" label="Patrimonio Netto"
          value={fmtEUR(last.patrimonio_netto)}
          sub={prev ? `${pnDelta >= 0 ? "▲" : "▼"} ${fmtEUR(Math.abs(pnDelta))} (${pnDeltaPct.toFixed(1)}%)` : "Primo mese"}
          tone={pnDelta >= 0 ? "positive" : "negative"} icon={Wallet} />
        <KpiCard testid="kpi-debito" label="Debito Totale"
          value={fmtEUR(last.debito_residuo)}
          sub={`${debts.length} ${debts.length === 1 ? "debito" : "debiti"} attivi`}
          tone={last.debito_residuo > 0 ? "negative" : "positive"} icon={TrendDown} />
        <KpiCard testid="kpi-fondo-em" label="Fondo Emergenza"
          value={fmtEUR(fondo_emergenza.attuale)}
          sub={`${fondo_emergenza.copertura_mesi.toFixed(1)} mesi di spese`}
          tone={fondo_emergenza.copertura_mesi >= fondo_emergenza.mesi_target ? "positive" : "warn"} icon={Shield} />
        <KpiCard testid="kpi-fsi" label="Financial Stress Index"
          value={`${fsi.fsi}`} sub={`Giudizio: ${fsi.giudizio}`}
          tone={fsiTone} icon={Lightning} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-[#121212] border border-neutral-800 rounded-md p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="label-eyebrow">Andamento</div>
              <h3 className="font-heading text-xl font-bold mt-1">Patrimonio Netto nel Tempo</h3>
            </div>
            <ChartLine size={20} className="text-neutral-500" />
          </div>
          <div className="h-72">
            <ResponsiveContainer>
              <AreaChart data={history} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gPn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10B981" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="mese" tickFormatter={fmtMese} stroke="#71717a" />
                <YAxis stroke="#71717a" tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<TooltipBox />} />
                <Area type="monotone" dataKey="patrimonio_netto" name="Patrimonio Netto"
                  stroke="#10B981" strokeWidth={2} fill="url(#gPn)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#121212] border border-neutral-800 rounded-md p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="label-eyebrow">Allocazione</div>
              <h3 className="font-heading text-xl font-bold mt-1">Composizione</h3>
            </div>
            <ChartBar size={20} className="text-neutral-500" />
          </div>
          <div className="h-72">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={allocation.filter((a) => a.value > 0)} dataKey="value" nameKey="name"
                  innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {allocation.map((a, i) => (
                    <Cell key={i} fill={a.color} stroke="#0A0A0A" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip content={<TooltipBox />} />
                <Legend iconType="square" wrapperStyle={{ fontSize: 11, color: "#a1a1aa" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ProgressGoal testid="progress-fondo-em" label="Fondo Emergenza"
          current={fondo_emergenza.attuale} target={fondo_emergenza.target}
          colorClass="bg-emerald-500"
          subLeft={`${fondo_emergenza.copertura_mesi.toFixed(1)}/${fondo_emergenza.mesi_target} mesi`}
          subRight={`Gap ${fmtEUR(fondo_emergenza.gap)}`} />
        <ProgressGoal testid="progress-debito" label="Estinzione Debiti"
          current={totalDebtPaid} target={totalDebtInitial}
          colorClass="bg-red-500" subLeft="Rimborsato"
          subRight={`Residuo ${fmtEUR(last.debito_residuo)}`} />
        <div className="bg-[#121212] border border-neutral-800 rounded-md p-5" data-testid="pac-card">
          <div className="flex items-center justify-between mb-3">
            <div className="label-eyebrow">Sostenibilità PAC</div>
            <Coins size={16} className="text-neutral-500" />
          </div>
          <div className="font-mono-num text-2xl font-bold">{pac_sustainability.pct_pac_su_entrate}%</div>
          <div className="text-xs text-neutral-500 font-mono-num mt-1">
            {fmtEUR(pac_sustainability.pac_totale)} / entrate · {pac_sustainability.giudizio}
          </div>
          <div className="w-full h-2 bg-neutral-800 rounded-sm mt-4 overflow-hidden">
            <div className="h-full bg-indigo-500" style={{ width: `${Math.min(100, pac_sustainability.pct_pac_su_entrate)}%` }} />
          </div>
          <div className="text-xs text-neutral-500 font-mono-num mt-3">
            Liquidità residua: {fmtEUR(pac_sustainability.liquidita_residua)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#121212] border border-neutral-800 rounded-md p-6">
          <div className="label-eyebrow mb-1">PAC Mensile</div>
          <h3 className="font-heading text-xl font-bold mb-4">Contributi Investiti per Mese</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="mese" tickFormatter={fmtMese} stroke="#71717a" />
                <YAxis stroke="#71717a" tickFormatter={(v) => `€${v}`} />
                <Tooltip content={<TooltipBox />} />
                <Bar dataKey="pac_totale" name="PAC totale" fill="#6366F1" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-[#121212] border border-neutral-800 rounded-md p-6">
          <div className="label-eyebrow mb-1">Debito</div>
          <h3 className="font-heading text-xl font-bold mb-4">Riduzione Totale nel Tempo</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="mese" tickFormatter={fmtMese} stroke="#71717a" />
                <YAxis stroke="#71717a" tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<TooltipBox />} />
                <Line type="monotone" dataKey="debito_residuo" name="Debito Residuo"
                  stroke="#FF3B30" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-[#121212] border border-neutral-800 rounded-md p-6">
        <div className="label-eyebrow mb-1">Financial Stress · Sub-indici</div>
        <h3 className="font-heading text-xl font-bold mb-6">Diagnosi Salute Finanziaria</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { label: "Copertura Liquidità", v: fsi.sub.liquidita, c: "bg-emerald-500" },
            { label: "Sostenibilità Debito", v: fsi.sub.debito, c: "bg-red-500" },
            { label: "Capacità Risparmio", v: fsi.sub.risparmio, c: "bg-indigo-500" },
            { label: "Buffer Paracadute", v: fsi.sub.buffer, c: "bg-amber-500" },
          ].map((s) => (
            <div key={s.label}>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-neutral-400 uppercase tracking-wider">{s.label}</span>
                <span className="font-mono-num text-white">{s.v}</span>
              </div>
              <div className="w-full h-1.5 bg-neutral-800 rounded-sm overflow-hidden">
                <div className={`h-full ${s.c}`} style={{ width: `${s.v}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
