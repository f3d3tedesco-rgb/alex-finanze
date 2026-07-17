import { useState, useEffect } from "react";
import { toast } from "sonner";
import useSWR, { mutate } from "swr";
import { api, fmtEUR, fmtMese } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FloppyDisk, ClipboardText, CheckCircle } from "@phosphor-icons/react";

const fetcher = (url) => api.get(url).then((r) => r.data);

const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export default function RecapMensile() {
  const [mese, setMese] = useState(currentMonth());
  const { data: categories } = useSWR("/categories", fetcher);
  const { data: debts } = useSWR("/debts", fetcher);
  const { data: entries } = useSWR("/monthly-entries", fetcher);
  const [contributions, setContributions] = useState({});
  const [balances, setBalances] = useState({});
  const [debtPayments, setDebtPayments] = useState({});
  const [fondoEm, setFondoEm] = useState(0);
  const [entrate, setEntrate] = useState(0);
  const [spese, setSpese] = useState(0);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const existing = entries?.find((e) => e.mese === mese);
    if (existing) {
      setContributions(existing.contributions || {});
      setBalances(existing.balances || {});
      setDebtPayments(existing.debt_payments || {});
      setFondoEm(existing.contributo_fondo_emergenza || 0);
      setEntrate(existing.entrate_mese || 0);
      setSpese(existing.spese_mese || 0);
      setNote(existing.note || "");
    } else {
      setContributions({});
      setBalances({});
      setDebtPayments({});
      setFondoEm(0);
      setEntrate(0);
      setSpese(0);
      setNote("");
    }
  }, [mese, entries]);

  if (!categories || !debts) return <div className="p-8 text-neutral-500">Caricamento...</div>;

  const accumCats = categories.filter((c) => c.kind === "accumulation");
  const balanceCats = categories.filter((c) => c.kind === "balance");
  const totalePac =
    Object.values(contributions).reduce((s, v) => s + (Number(v) || 0), 0) + (Number(fondoEm) || 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const norm = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Number(v) || 0]));
      await api.post("/monthly-entries", {
        mese,
        contributions: norm(contributions),
        balances: norm(balances),
        debt_payments: norm(debtPayments),
        contributo_fondo_emergenza: Number(fondoEm) || 0,
        entrate_mese: Number(entrate) || 0,
        spese_mese: Number(spese) || 0,
        note,
      });
      toast.success("Recap mensile salvato", { description: `${fmtMese(mese)} smistato ovunque` });
      mutate("/monthly-entries");
      mutate("/dashboard");
    } catch (err) {
      toast.error("Errore nel salvataggio");
    } finally {
      setSaving(false);
    }
  };

  const NumberInput = ({ value, onChange, testid }) => (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 text-sm">€</span>
      <Input
        type="number"
        step="0.01"
        value={value ?? 0}
        onChange={onChange}
        className="pl-7 bg-black border-neutral-800 text-white font-mono-num focus:border-emerald-500 focus:ring-emerald-500/20"
        data-testid={testid}
      />
    </div>
  );

  return (
    <div className="p-6 md:p-8 pb-24 md:pb-8 max-w-5xl" data-testid="recap-page">
      <div className="flex items-center gap-3">
        <ClipboardText size={28} weight="bold" className="text-emerald-400" />
        <div>
          <div className="label-eyebrow">Modulo mensile · 5 minuti</div>
          <h1 className="font-heading text-4xl font-bold mt-1">Recap del mese</h1>
        </div>
      </div>
      <p className="text-neutral-400 text-sm mt-3 max-w-2xl">
        I campi qui sotto rispecchiano le tue categorie e i tuoi debiti. Gestiscili in Impostazioni per aggiungere, modificare o rimuovere.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        <div className="bg-[#121212] border border-neutral-800 rounded-md p-5 flex flex-col md:flex-row md:items-end gap-4 justify-between">
          <div className="flex-1">
            <Label className="label-eyebrow">Mese di riferimento</Label>
            <Input type="month" value={mese} onChange={(e) => setMese(e.target.value)}
              className="mt-2 bg-black border-neutral-800 text-white font-mono-num" data-testid="input-mese" />
          </div>
          <div className="flex-1 md:text-right">
            <div className="label-eyebrow">PAC totale del mese</div>
            <div className="font-mono-num text-3xl font-bold text-emerald-400 mt-1" data-testid="pac-totale">
              {fmtEUR(totalePac)}
            </div>
          </div>
        </div>

        {/* Investimenti accumulation */}
        <div className="bg-[#121212] border border-neutral-800 rounded-md p-6">
          <div className="mb-5">
            <div className="label-eyebrow text-emerald-400">PAC del mese</div>
            <h3 className="font-heading text-xl font-bold mt-1">Contributi Investimenti</h3>
          </div>
          {accumCats.length === 0 ? (
            <p className="text-sm text-neutral-500">Nessuna categoria configurata. Vai in Impostazioni → Categorie.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {accumCats.map((c) => (
                <div key={c.id}>
                  <Label className="text-xs text-neutral-400 mb-1.5 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                    {c.name}
                  </Label>
                  <NumberInput
                    value={contributions[c.id] ?? 0}
                    onChange={(e) => setContributions({ ...contributions, [c.id]: e.target.value })}
                    testid={`contrib-${c.id}`}
                  />
                </div>
              ))}
              <div>
                <Label className="text-xs text-emerald-400 mb-1.5 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Fondo Emergenza
                </Label>
                <NumberInput
                  value={fondoEm}
                  onChange={(e) => setFondoEm(e.target.value)}
                  testid="contrib-fondo-emergenza"
                />
              </div>
            </div>
          )}
        </div>

        {/* Debiti */}
        <div className="bg-[#121212] border border-neutral-800 rounded-md p-6">
          <div className="mb-5">
            <div className="label-eyebrow text-red-400">Pagamenti</div>
            <h3 className="font-heading text-xl font-bold mt-1">Rate Debiti</h3>
          </div>
          {debts.length === 0 ? (
            <p className="text-sm text-neutral-500">Nessun debito. Ottimo! (Aggiungi in Impostazioni → Debiti se necessario)</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {debts.map((d) => (
                <div key={d.id}>
                  <Label className="text-xs text-neutral-400 mb-1.5 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                    {d.name} <span className="text-neutral-600 font-mono-num">(rata std. {fmtEUR(d.monthly_installment)})</span>
                  </Label>
                  <NumberInput
                    value={debtPayments[d.id] ?? 0}
                    onChange={(e) => setDebtPayments({ ...debtPayments, [d.id]: e.target.value })}
                    testid={`debt-pay-${d.id}`}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Liquidità (balance) */}
        <div className="bg-[#121212] border border-neutral-800 rounded-md p-6">
          <div className="mb-5">
            <div className="label-eyebrow text-indigo-400">Saldi conti</div>
            <h3 className="font-heading text-xl font-bold mt-1">Liquidità a fine mese</h3>
          </div>
          {balanceCats.length === 0 ? (
            <p className="text-sm text-neutral-500">Nessun conto liquidità configurato.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {balanceCats.map((c) => (
                <div key={c.id}>
                  <Label className="text-xs text-neutral-400 mb-1.5 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                    Saldo {c.name}
                  </Label>
                  <NumberInput
                    value={balances[c.id] ?? 0}
                    onChange={(e) => setBalances({ ...balances, [c.id]: e.target.value })}
                    testid={`balance-${c.id}`}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cash flow */}
        <div className="bg-[#121212] border border-neutral-800 rounded-md p-6">
          <div className="mb-5">
            <div className="label-eyebrow">Cash flow del mese</div>
            <h3 className="font-heading text-xl font-bold mt-1">Entrate & Spese</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-neutral-400 mb-1.5 block">Entrate nette del mese</Label>
              <NumberInput value={entrate} onChange={(e) => setEntrate(e.target.value)} testid="input-entrate" />
            </div>
            <div>
              <Label className="text-xs text-neutral-400 mb-1.5 block">Spese totali del mese</Label>
              <NumberInput value={spese} onChange={(e) => setSpese(e.target.value)} testid="input-spese" />
            </div>
          </div>
        </div>

        {/* Note */}
        <div className="bg-[#121212] border border-neutral-800 rounded-md p-6">
          <Label className="label-eyebrow">Note del mese</Label>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)}
            className="mt-3 bg-black border-neutral-800 text-white" rows={3}
            placeholder="Spese straordinarie, considerazioni, priorità..." data-testid="input-note" />
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving} className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold border-0" data-testid="btn-save-recap">
            {saving ? "Salvataggio..." : <><FloppyDisk size={18} weight="bold" /> Salva recap mensile</>}
          </Button>
          {entries?.find((e) => e.mese === mese) && (
            <span className="text-xs text-emerald-400 flex items-center gap-1.5">
              <CheckCircle size={14} weight="fill" /> Mese già presente · aggiornamento
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
