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

const FIELD_GROUPS = [
  {
    title: "Contributi Investimenti",
    eyebrow: "PAC del mese",
    color: "text-emerald-400",
    fields: [
      ["contributo_etf", "ETF"],
      ["contributo_satellite", "Satellite (azioni)"],
      ["contributo_priamo_personale", "Priamo · contributo personale"],
      ["contributo_priamo_azienda", "Priamo · contributo azienda"],
      ["contributo_fondo_figlia", "Fondo Figlia"],
      ["contributo_fondo_famiglia", "Fondo Famiglia"],
      ["contributo_fondo_emergenza", "Fondo Emergenza"],
    ],
  },
  {
    title: "Debiti",
    eyebrow: "Pagamenti",
    color: "text-red-400",
    fields: [
      ["pagamento_debito_zio", "Rata Debito Zio"],
    ],
  },
  {
    title: "Liquidità & Cash Flow",
    eyebrow: "Saldi & flussi",
    color: "text-indigo-400",
    fields: [
      ["saldo_liquidita_revolut", "Saldo Revolut a fine mese"],
      ["saldo_conto_deposito", "Saldo Conto Deposito"],
      ["entrate_mese", "Entrate nette del mese"],
      ["spese_mese", "Spese totali del mese"],
    ],
  },
];

export default function RecapMensile() {
  const [mese, setMese] = useState(currentMonth());
  const [form, setForm] = useState({});
  const { data: entries } = useSWR("/monthly-entries", fetcher);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const existing = entries?.find((e) => e.mese === mese);
    if (existing) {
      setForm(existing);
    } else {
      setForm({
        mese,
        contributo_etf: 0, contributo_satellite: 0,
        contributo_priamo_personale: 0, contributo_priamo_azienda: 0,
        contributo_fondo_figlia: 0, contributo_fondo_famiglia: 0,
        pagamento_debito_zio: 0, saldo_liquidita_revolut: 0,
        saldo_conto_deposito: 0, contributo_fondo_emergenza: 0,
        entrate_mese: 0, spese_mese: 0, note: "",
      });
    }
  }, [mese, entries]);

  const setF = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, mese };
      Object.keys(payload).forEach((k) => {
        if (k !== "mese" && k !== "note" && k !== "id" && k !== "created_at") {
          payload[k] = Number(payload[k]) || 0;
        }
      });
      await api.post("/monthly-entries", payload);
      toast.success("Recap mensile salvato", { description: `${fmtMese(mese)} smistato nelle pagine` });
      mutate("/monthly-entries");
      mutate("/dashboard");
      mutate("/debt-plan");
    } catch (err) {
      toast.error("Errore nel salvataggio", { description: err?.message });
    } finally {
      setSaving(false);
    }
  };

  const totale_pac =
    (Number(form.contributo_etf) || 0) +
    (Number(form.contributo_satellite) || 0) +
    (Number(form.contributo_priamo_personale) || 0) +
    (Number(form.contributo_fondo_figlia) || 0) +
    (Number(form.contributo_fondo_famiglia) || 0) +
    (Number(form.contributo_fondo_emergenza) || 0);

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
        Inserisci i dati una sola volta. Verranno smistati automaticamente in Dashboard, Investimenti, Debiti e Fondo Emergenza.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        {/* Mese selector + totale */}
        <div className="bg-[#121212] border border-neutral-800 rounded-md p-5 flex flex-col md:flex-row md:items-end gap-4 justify-between">
          <div className="flex-1">
            <Label className="label-eyebrow">Mese di riferimento</Label>
            <Input
              type="month"
              value={mese}
              onChange={(e) => setMese(e.target.value)}
              className="mt-2 bg-black border-neutral-800 text-white font-mono-num"
              data-testid="input-mese"
            />
          </div>
          <div className="flex-1 md:text-right">
            <div className="label-eyebrow">PAC totale del mese</div>
            <div className="font-mono-num text-3xl font-bold text-emerald-400 mt-1" data-testid="pac-totale">
              {fmtEUR(totale_pac)}
            </div>
          </div>
        </div>

        {/* Groups */}
        {FIELD_GROUPS.map((g) => (
          <div key={g.title} className="bg-[#121212] border border-neutral-800 rounded-md p-6">
            <div className="mb-5">
              <div className={`label-eyebrow ${g.color}`}>{g.eyebrow}</div>
              <h3 className="font-heading text-xl font-bold mt-1">{g.title}</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {g.fields.map(([k, label]) => (
                <div key={k}>
                  <Label className="text-xs text-neutral-400 mb-1.5 block">{label}</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 text-sm">€</span>
                    <Input
                      type="number"
                      step="0.01"
                      value={form[k] ?? 0}
                      onChange={(e) => setF(k, e.target.value)}
                      className="pl-7 bg-black border-neutral-800 text-white font-mono-num focus:border-emerald-500 focus:ring-emerald-500/20"
                      data-testid={`input-${k}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Note */}
        <div className="bg-[#121212] border border-neutral-800 rounded-md p-6">
          <Label className="label-eyebrow">Note del mese</Label>
          <Textarea
            value={form.note || ""}
            onChange={(e) => setF("note", e.target.value)}
            className="mt-3 bg-black border-neutral-800 text-white"
            placeholder="Spese straordinarie, considerazioni, priorità..."
            rows={3}
            data-testid="input-note"
          />
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="submit"
            disabled={saving}
            className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold border-0"
            data-testid="btn-save-recap"
          >
            {saving ? <>Salvataggio...</> : <><FloppyDisk size={18} weight="bold" /> Salva recap mensile</>}
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
