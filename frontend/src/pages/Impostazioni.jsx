import { useEffect, useState } from "react";
import useSWR, { mutate } from "swr";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Gear, FloppyDisk } from "@phosphor-icons/react";

const fetcher = (url) => api.get(url).then((r) => r.data);

const GROUPS = [
  {
    title: "Reddito & Spese",
    fields: [
      ["entrate_nette_mensili", "Entrate nette mensili familiari"],
      ["spese_mensili_essenziali", "Spese mensili essenziali"],
      ["mesi_target_fondo_emergenza", "Mesi target Fondo Emergenza"],
      ["paracadute_genitori", "Paracadute genitori (importo medio)"],
    ],
  },
  {
    title: "Saldi Iniziali (prima del primo mese)",
    fields: [
      ["saldo_iniziale_etf", "Saldo iniziale ETF PAC"],
      ["saldo_iniziale_satellite", "Saldo iniziale Satellite"],
      ["saldo_iniziale_priamo", "Saldo iniziale Priamo (pensione)"],
      ["saldo_iniziale_fondo_figlia", "Saldo Fondo Figlia"],
      ["saldo_iniziale_fondo_famiglia", "Saldo Fondo Famiglia"],
      ["saldo_iniziale_liquidita", "Liquidità iniziale"],
      ["saldo_iniziale_fondo_emergenza", "Fondo Emergenza iniziale"],
    ],
  },
  {
    title: "Debito Zio",
    fields: [
      ["debito_zio_iniziale", "Residuo debito"],
      ["debito_zio_rata_mensile", "Rata mensile standard"],
      ["data_primo_mese", "Primo mese del piano (YYYY-MM)"],
    ],
  },
];

export default function Impostazioni() {
  const { data } = useSWR("/settings", fetcher);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  if (!form) return <div className="p-8 text-neutral-500">Caricamento...</div>;

  const setF = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const payload = { ...form };
      Object.keys(payload).forEach((k) => {
        if (k === "id" || k === "updated_at") return;
        if (k === "data_primo_mese") return;
        if (k === "mesi_target_fondo_emergenza") payload[k] = parseInt(payload[k]) || 6;
        else payload[k] = Number(payload[k]) || 0;
      });
      await api.put("/settings", payload);
      mutate("/settings");
      mutate("/dashboard");
      mutate("/debt-plan");
      toast.success("Impostazioni salvate");
    } catch (err) {
      toast.error("Errore salvataggio");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 md:p-8 pb-24 md:pb-8 max-w-4xl space-y-6" data-testid="settings-page">
      <div className="flex items-center gap-3">
        <Gear size={28} weight="bold" className="text-neutral-300" />
        <div>
          <div className="label-eyebrow">Configurazione</div>
          <h1 className="font-heading text-4xl font-bold mt-1">Impostazioni & Assunzioni</h1>
        </div>
      </div>
      <p className="text-neutral-400 text-sm max-w-2xl">
        Configura una sola volta: reddito, spese, saldi iniziali e piano debito. Questi valori alimentano tutti i calcoli del cockpit.
      </p>

      {GROUPS.map((g) => (
        <div key={g.title} className="bg-[#121212] border border-neutral-800 rounded-md p-6">
          <h3 className="font-heading text-xl font-bold mb-5">{g.title}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {g.fields.map(([k, label]) => (
              <div key={k}>
                <Label className="text-xs text-neutral-400 mb-1.5 block">{label}</Label>
                <Input
                  type={k === "data_primo_mese" ? "month" : "number"}
                  step="0.01"
                  value={form[k] ?? ""}
                  onChange={(e) => setF(k, e.target.value)}
                  className="bg-black border-neutral-800 text-white font-mono-num focus:border-emerald-500 focus:ring-emerald-500/20"
                  data-testid={`set-${k}`}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      <Button
        onClick={save}
        disabled={saving}
        className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold border-0"
        data-testid="btn-save-settings"
      >
        <FloppyDisk size={18} weight="bold" /> {saving ? "Salvataggio..." : "Salva impostazioni"}
      </Button>
    </div>
  );
}
