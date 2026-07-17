import { useEffect, useRef, useState } from "react";
import useSWR, { mutate } from "swr";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Gear, FloppyDisk, DownloadSimple, UploadSimple, Database } from "@phosphor-icons/react";

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
  const fileRef = useRef(null);

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

  const downloadBackup = async () => {
    try {
      const res = await api.get("/backup/export");
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const stamp = new Date().toISOString().slice(0, 10);
      a.download = `alex-backup-${stamp}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Backup scaricato");
    } catch (e) {
      toast.error("Errore backup");
    }
  };

  const uploadBackup = async (file) => {
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      if (!confirm("Ripristinare il backup? I dati attuali verranno sostituiti.")) return;
      await api.post("/backup/import", { ...payload, replace: true });
      mutate("/settings");
      mutate("/monthly-entries");
      mutate("/dashboard");
      mutate("/debt-plan");
      mutate("/watchlist");
      mutate("/goals");
      toast.success("Backup ripristinato");
    } catch (e) {
      toast.error("File non valido");
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

      <div className="bg-[#121212] border border-neutral-800 rounded-md p-6 mt-6">
        <div className="flex items-center gap-2 mb-1">
          <Database size={18} className="text-indigo-400" />
          <div className="label-eyebrow text-indigo-400">Sovranità dei dati</div>
        </div>
        <h3 className="font-heading text-xl font-bold">Backup & Ripristino</h3>
        <p className="text-sm text-neutral-400 mt-2 max-w-xl">
          Scarica un file JSON con TUTTI i tuoi dati (impostazioni, mesi, obiettivi, watchlist).
          Puoi ricaricarlo su un'altra installazione dell'app in qualsiasi momento. I tuoi dati sono tuoi.
        </p>
        <div className="flex flex-wrap gap-3 mt-4">
          <Button onClick={downloadBackup} className="bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-white" data-testid="btn-download-backup">
            <DownloadSimple size={16} weight="bold" /> Scarica backup JSON
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && uploadBackup(e.target.files[0])}
            data-testid="input-restore"
          />
          <Button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="bg-transparent hover:bg-neutral-900 border border-neutral-700 text-white"
            data-testid="btn-upload-backup"
          >
            <UploadSimple size={16} weight="bold" /> Ripristina da backup
          </Button>
        </div>
      </div>

      <div className="bg-[#121212] border border-neutral-800 rounded-md p-6">
        <div className="label-eyebrow mb-1">Autonomia</div>
        <h3 className="font-heading text-xl font-bold">Vuoi essere completamente indipendente?</h3>
        <p className="text-sm text-neutral-400 mt-2 max-w-2xl">
          Nella root del progetto trovi <code className="text-emerald-400 font-mono-num">SELF_HOST.md</code>: guida passo passo per fare girare A.L.E.X. gratis su GitHub + Vercel + Railway + MongoDB Atlas, con la tua chiave AI personale (o senza AI usando la modalità "Aggiungi manualmente").
        </p>
      </div>
    </div>
  );
}
