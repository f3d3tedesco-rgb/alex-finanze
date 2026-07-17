import { useEffect, useRef, useState } from "react";
import useSWR, { mutate } from "swr";
import { toast } from "sonner";
import { api, fmtEUR } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Gear, FloppyDisk, DownloadSimple, UploadSimple, Database, Plus, Trash, Pencil, Archive,
} from "@phosphor-icons/react";

const fetcher = (url) => api.get(url).then((r) => r.data);

const SETTINGS_GROUPS = [
  { title: "Reddito & Spese", fields: [
    ["entrate_nette_mensili", "Entrate nette mensili familiari"],
    ["spese_mensili_essenziali", "Spese mensili essenziali"],
    ["mesi_target_fondo_emergenza", "Mesi target Fondo Emergenza"],
    ["paracadute_genitori", "Paracadute genitori (importo medio)"],
    ["saldo_iniziale_fondo_emergenza", "Fondo Emergenza iniziale"],
    ["data_primo_mese", "Primo mese del piano"],
  ]},
];

const PALETTE = ["#10B981", "#F59E0B", "#6366F1", "#EC4899", "#22D3EE", "#84CC16", "#A78BFA", "#FF3B30", "#FB7185", "#38BDF8"];

function ColorPicker({ value, onChange }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {PALETTE.map((c) => (
        <button key={c} type="button" onClick={() => onChange(c)}
          className={`h-7 w-7 rounded-sm border-2 ${value === c ? "border-white" : "border-transparent"}`}
          style={{ background: c }} />
      ))}
    </div>
  );
}

export default function Impostazioni() {
  const { data: settings } = useSWR("/settings", fetcher);
  const { data: categories } = useSWR("/categories?include_archived=true", fetcher);
  const { data: debts } = useSWR("/debts?include_archived=true", fetcher);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  const [catOpen, setCatOpen] = useState(false);
  const [catEdit, setCatEdit] = useState(null);
  const [catForm, setCatForm] = useState({ name: "", color: "#10B981", kind: "accumulation", initial_balance: 0, target_allocation: 0, order: 100, note: "" });

  const [debtOpen, setDebtOpen] = useState(false);
  const [debtEdit, setDebtEdit] = useState(null);
  const [debtForm, setDebtForm] = useState({ name: "", initial_amount: 0, monthly_installment: 0, start_month: "", color: "#FF3B30", order: 100, note: "" });

  useEffect(() => { if (settings) setForm(settings); }, [settings]);

  if (!form || !categories || !debts) return <div className="p-8 text-neutral-500">Caricamento...</div>;

  const setF = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const saveSettings = async () => {
    setSaving(true);
    try {
      const payload = { ...form };
      Object.keys(payload).forEach((k) => {
        if (k === "id" || k === "updated_at" || k === "data_primo_mese") return;
        if (k === "mesi_target_fondo_emergenza") payload[k] = parseInt(payload[k]) || 6;
        else payload[k] = Number(payload[k]) || 0;
      });
      await api.put("/settings", payload);
      mutate("/settings"); mutate("/dashboard");
      toast.success("Impostazioni salvate");
    } catch { toast.error("Errore salvataggio"); }
    finally { setSaving(false); }
  };

  // Categories
  const openNewCat = () => {
    setCatEdit(null);
    setCatForm({ name: "", color: PALETTE[Math.floor(Math.random() * PALETTE.length)], kind: "accumulation", initial_balance: 0, target_allocation: 0, order: (categories.length + 1) * 10, note: "" });
    setCatOpen(true);
  };
  const openEditCat = (c) => { setCatEdit(c); setCatForm(c); setCatOpen(true); };
  const saveCat = async () => {
    if (!catForm.name) { toast.error("Nome obbligatorio"); return; }
    try {
      const payload = {
        ...catForm,
        id: catEdit?.id || "",
        initial_balance: Number(catForm.initial_balance) || 0,
        target_allocation: Number(catForm.target_allocation) || 0,
        order: parseInt(catForm.order) || 0,
        archived: catForm.archived || false,
      };
      await api.post("/categories", payload);
      mutate("/categories"); mutate("/categories?include_archived=true"); mutate("/dashboard");
      setCatOpen(false);
      toast.success(catEdit ? "Categoria aggiornata" : "Categoria creata");
    } catch { toast.error("Errore"); }
  };
  const archiveCat = async (id) => {
    if (!confirm("Archiviare la categoria? (I dati storici restano; verrà nascosta dai form)")) return;
    await api.delete(`/categories/${id}`);
    mutate("/categories?include_archived=true"); mutate("/dashboard");
    toast.success("Categoria archiviata");
  };
  const deleteCat = async (id) => {
    if (!confirm("ATTENZIONE: cancellazione definitiva. Se questa categoria è usata in mesi passati, i valori resteranno orfani nel DB. Procedere?")) return;
    await api.delete(`/categories/${id}?hard=true`);
    mutate("/categories?include_archived=true"); mutate("/dashboard");
    toast.success("Categoria eliminata");
  };
  const unarchiveCat = async (c) => {
    await api.post("/categories", { ...c, archived: false });
    mutate("/categories?include_archived=true"); mutate("/dashboard");
    toast.success("Ripristinata");
  };

  // Debts
  const openNewDebt = () => {
    setDebtEdit(null);
    setDebtForm({ name: "", initial_amount: 0, monthly_installment: 0, start_month: "", color: "#FF3B30", order: (debts.length + 1) * 10, note: "" });
    setDebtOpen(true);
  };
  const openEditDebt = (d) => { setDebtEdit(d); setDebtForm(d); setDebtOpen(true); };
  const saveDebt = async () => {
    if (!debtForm.name) { toast.error("Nome obbligatorio"); return; }
    try {
      const payload = {
        ...debtForm,
        id: debtEdit?.id || "",
        initial_amount: Number(debtForm.initial_amount) || 0,
        monthly_installment: Number(debtForm.monthly_installment) || 0,
        order: parseInt(debtForm.order) || 0,
        archived: debtForm.archived || false,
      };
      await api.post("/debts", payload);
      mutate("/debts"); mutate("/debts?include_archived=true"); mutate("/dashboard");
      setDebtOpen(false);
      toast.success(debtEdit ? "Debito aggiornato" : "Debito creato");
    } catch { toast.error("Errore"); }
  };
  const archiveDebt = async (id) => {
    if (!confirm("Archiviare il debito? (I dati storici restano)")) return;
    await api.delete(`/debts/${id}`);
    mutate("/debts?include_archived=true"); mutate("/dashboard");
    toast.success("Debito archiviato");
  };
  const deleteDebt = async (id) => {
    if (!confirm("Cancellazione definitiva. Procedere?")) return;
    await api.delete(`/debts/${id}?hard=true`);
    mutate("/debts?include_archived=true"); mutate("/dashboard");
    toast.success("Debito eliminato");
  };
  const unarchiveDebt = async (d) => {
    await api.post("/debts", { ...d, archived: false });
    mutate("/debts?include_archived=true"); mutate("/dashboard");
  };

  // Backup
  const downloadBackup = async () => {
    try {
      const res = await api.get("/backup/export");
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `alex-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Backup scaricato");
    } catch { toast.error("Errore backup"); }
  };
  const uploadBackup = async (file) => {
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      if (!confirm("Ripristinare il backup? I dati attuali verranno sostituiti.")) return;
      await api.post("/backup/import", { ...payload, replace: true });
      mutate("/settings"); mutate("/categories?include_archived=true"); mutate("/debts?include_archived=true");
      mutate("/monthly-entries"); mutate("/dashboard"); mutate("/watchlist"); mutate("/goals");
      toast.success("Backup ripristinato");
    } catch { toast.error("File non valido"); }
  };

  const activeCats = categories.filter((c) => !c.archived);
  const archivedCats = categories.filter((c) => c.archived);
  const targetSum = activeCats.reduce((s, c) => s + (Number(c.target_allocation) || 0), 0);
  const activeDebts = debts.filter((d) => !d.archived);
  const archivedDebts = debts.filter((d) => d.archived);

  return (
    <div className="p-6 md:p-8 pb-24 md:pb-8 max-w-5xl space-y-6" data-testid="settings-page">
      <div className="flex items-center gap-3">
        <Gear size={28} weight="bold" className="text-neutral-300" />
        <div>
          <div className="label-eyebrow">Configurazione</div>
          <h1 className="font-heading text-4xl font-bold mt-1">Impostazioni</h1>
        </div>
      </div>

      {/* Basic settings */}
      {SETTINGS_GROUPS.map((g) => (
        <div key={g.title} className="bg-[#121212] border border-neutral-800 rounded-md p-6">
          <h3 className="font-heading text-xl font-bold mb-5">{g.title}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {g.fields.map(([k, label]) => (
              <div key={k}>
                <Label className="text-xs text-neutral-400 mb-1.5 block">{label}</Label>
                <Input type={k === "data_primo_mese" ? "month" : "number"} step="0.01"
                  value={form[k] ?? ""} onChange={(e) => setF(k, e.target.value)}
                  className="bg-black border-neutral-800 text-white font-mono-num focus:border-emerald-500 focus:ring-emerald-500/20"
                  data-testid={`set-${k}`} />
              </div>
            ))}
          </div>
          <Button onClick={saveSettings} disabled={saving}
            className="mt-5 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold" data-testid="btn-save-settings">
            <FloppyDisk size={16} weight="bold" /> {saving ? "Salvataggio..." : "Salva"}
          </Button>
        </div>
      ))}

      {/* CATEGORIES MANAGEMENT */}
      <div className="bg-[#121212] border border-neutral-800 rounded-md p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="label-eyebrow text-emerald-400">Personalizzazione</div>
            <h3 className="font-heading text-xl font-bold mt-1">Categorie di Investimento & Conti</h3>
            <p className="text-xs text-neutral-500 mt-2 max-w-xl">
              Aggiungi, modifica o rimuovi categorie in qualsiasi momento. Ogni Recap Mensile mostrerà automaticamente i campi giusti.
            </p>
            <div className="mt-3 text-xs font-mono-num">
              <span className="text-neutral-500">Somma target allocazione:</span>{" "}
              <span className={targetSum === 100 ? "text-emerald-400" : targetSum === 0 ? "text-neutral-500" : "text-amber-400"}>
                {targetSum.toFixed(1)}%
              </span>
              {targetSum > 0 && targetSum !== 100 && (
                <span className="text-amber-400 ml-2">
                  · {targetSum > 100 ? `${(targetSum - 100).toFixed(1)}% oltre 100` : `manca ${(100 - targetSum).toFixed(1)}%`}
                </span>
              )}
            </div>
          </div>
          <Dialog open={catOpen} onOpenChange={setCatOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNewCat} className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold" data-testid="btn-new-cat">
                <Plus size={16} weight="bold" /> Nuova
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#0A0A0A] border-neutral-800 text-white max-w-lg">
              <DialogHeader><DialogTitle className="font-heading">{catEdit ? "Modifica categoria" : "Nuova categoria"}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label className="label-eyebrow">Nome</Label>
                  <Input value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                    placeholder="Es. PAC ETF Figlia, Crypto, Immobiliare..."
                    className="mt-2 bg-black border-neutral-800" data-testid="cat-name" />
                </div>
                <div>
                  <Label className="label-eyebrow">Tipo</Label>
                  <Select value={catForm.kind} onValueChange={(v) => setCatForm({ ...catForm, kind: v })}>
                    <SelectTrigger className="mt-2 bg-black border-neutral-800" data-testid="cat-kind"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-[#0A0A0A] border-neutral-800 text-white">
                      <SelectItem value="accumulation">PAC / Accumulazione (contributi mensili che si sommano)</SelectItem>
                      <SelectItem value="balance">Saldo snapshot (registri il saldo attuale ogni mese)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-neutral-500 mt-2">
                    <strong>Accumulazione:</strong> per ETF, PAC, fondi pensione. Inserisci il contributo del mese.<br />
                    <strong>Saldo snapshot:</strong> per conti liquidità. Inserisci il saldo di fine mese.
                  </p>
                </div>
                <div>
                  <Label className="label-eyebrow">Saldo iniziale € (già accumulato prima del primo mese)</Label>
                  <Input type="number" step="0.01" value={catForm.initial_balance}
                    onChange={(e) => setCatForm({ ...catForm, initial_balance: e.target.value })}
                    className="mt-2 bg-black border-neutral-800 font-mono-num" data-testid="cat-initial" />
                </div>
                <div>
                  <Label className="label-eyebrow">% Target allocazione (0-100 — lascia 0 se non applicabile)</Label>
                  <Input type="number" step="1" min="0" max="100" value={catForm.target_allocation}
                    onChange={(e) => setCatForm({ ...catForm, target_allocation: e.target.value })}
                    className="mt-2 bg-black border-neutral-800 font-mono-num" data-testid="cat-target" />
                  <p className="text-xs text-neutral-500 mt-1">Es. ETF 60%, Satellite 20%, Priamo 20%. La Dashboard ti dirà se sei allineato.</p>
                </div>
                <div>
                  <Label className="label-eyebrow">Colore</Label>
                  <div className="mt-2"><ColorPicker value={catForm.color} onChange={(c) => setCatForm({ ...catForm, color: c })} /></div>
                </div>
                <div>
                  <Label className="label-eyebrow">Ordine (numero, più basso = prima)</Label>
                  <Input type="number" value={catForm.order} onChange={(e) => setCatForm({ ...catForm, order: e.target.value })}
                    className="mt-2 bg-black border-neutral-800 font-mono-num w-32" />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={saveCat} className="bg-emerald-500 hover:bg-emerald-400 text-black" data-testid="btn-save-cat">Salva</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {activeCats.map((c) => (
            <div key={c.id} className="border border-neutral-800 rounded-sm p-4 flex items-center justify-between gap-3" data-testid={`cat-${c.id}`}>
              <div className="flex items-center gap-3 min-w-0">
                <span className="h-3 w-3 rounded-full shrink-0" style={{ background: c.color }} />
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{c.name}</div>
                  <div className="text-xs text-neutral-500 font-mono-num">
                    {c.kind === "accumulation" ? "PAC" : "Saldo"} · iniziale {fmtEUR(c.initial_balance)}
                    {c.target_allocation > 0 && <span className="ml-2 text-indigo-400">· target {c.target_allocation}%</span>}
                  </div>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => openEditCat(c)} className="p-1.5 text-neutral-400 hover:text-white" data-testid={`cat-edit-${c.id}`}><Pencil size={14} /></button>
                <button onClick={() => archiveCat(c.id)} className="p-1.5 text-neutral-400 hover:text-amber-400" title="Archivia"><Archive size={14} /></button>
                <button onClick={() => deleteCat(c.id)} className="p-1.5 text-neutral-400 hover:text-red-400" title="Elimina definitivamente"><Trash size={14} /></button>
              </div>
            </div>
          ))}
        </div>

        {archivedCats.length > 0 && (
          <div className="mt-6 pt-4 border-t border-neutral-800">
            <div className="label-eyebrow text-neutral-500 mb-3">Archiviate</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {archivedCats.map((c) => (
                <div key={c.id} className="border border-neutral-900 rounded-sm p-3 flex items-center justify-between opacity-60">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                    <span className="text-sm text-neutral-400">{c.name}</span>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => unarchiveCat(c)} className="text-xs text-emerald-400 hover:underline">Ripristina</button>
                    <button onClick={() => deleteCat(c.id)} className="text-neutral-500 hover:text-red-400 ml-2"><Trash size={12} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* DEBTS MANAGEMENT */}
      <div className="bg-[#121212] border border-neutral-800 rounded-md p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="label-eyebrow text-red-400">Debiti attivi</div>
            <h3 className="font-heading text-xl font-bold mt-1">Gestione Debiti</h3>
            <p className="text-xs text-neutral-500 mt-2 max-w-xl">
              Aggiungi mutui, prestiti, debiti personali. Ognuno avrà un suo piano di rientro nella pagina Debiti.
            </p>
          </div>
          <Dialog open={debtOpen} onOpenChange={setDebtOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNewDebt} className="bg-red-500 hover:bg-red-400 text-white font-semibold" data-testid="btn-new-debt">
                <Plus size={16} weight="bold" /> Nuovo debito
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#0A0A0A] border-neutral-800 text-white max-w-lg">
              <DialogHeader><DialogTitle className="font-heading">{debtEdit ? "Modifica debito" : "Nuovo debito"}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label className="label-eyebrow">Nome</Label>
                  <Input value={debtForm.name} onChange={(e) => setDebtForm({ ...debtForm, name: e.target.value })}
                    placeholder="Es. Mutuo casa, Prestito auto, Debito Zio..."
                    className="mt-2 bg-black border-neutral-800" data-testid="debt-name" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="label-eyebrow">Importo iniziale €</Label>
                    <Input type="number" step="0.01" value={debtForm.initial_amount}
                      onChange={(e) => setDebtForm({ ...debtForm, initial_amount: e.target.value })}
                      className="mt-2 bg-black border-neutral-800 font-mono-num" data-testid="debt-initial" />
                  </div>
                  <div>
                    <Label className="label-eyebrow">Rata mensile €</Label>
                    <Input type="number" step="0.01" value={debtForm.monthly_installment}
                      onChange={(e) => setDebtForm({ ...debtForm, monthly_installment: e.target.value })}
                      className="mt-2 bg-black border-neutral-800 font-mono-num" data-testid="debt-rata" />
                  </div>
                </div>
                <div>
                  <Label className="label-eyebrow">Mese di partenza</Label>
                  <Input type="month" value={debtForm.start_month}
                    onChange={(e) => setDebtForm({ ...debtForm, start_month: e.target.value })}
                    className="mt-2 bg-black border-neutral-800 font-mono-num" />
                </div>
                <div>
                  <Label className="label-eyebrow">Colore</Label>
                  <div className="mt-2"><ColorPicker value={debtForm.color} onChange={(c) => setDebtForm({ ...debtForm, color: c })} /></div>
                </div>
                <div>
                  <Label className="label-eyebrow">Note</Label>
                  <Input value={debtForm.note} onChange={(e) => setDebtForm({ ...debtForm, note: e.target.value })}
                    className="mt-2 bg-black border-neutral-800" placeholder="Es. Senza interessi, dossier trasferimento..." />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={saveDebt} className="bg-red-500 hover:bg-red-400 text-white" data-testid="btn-save-debt">Salva</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {activeDebts.map((d) => (
            <div key={d.id} className="border border-neutral-800 rounded-sm p-4 flex items-center justify-between gap-3" data-testid={`debt-${d.id}`}>
              <div className="flex items-center gap-3 min-w-0">
                <span className="h-3 w-3 rounded-full shrink-0" style={{ background: d.color }} />
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{d.name}</div>
                  <div className="text-xs text-neutral-500 font-mono-num">
                    {fmtEUR(d.initial_amount)} · rata {fmtEUR(d.monthly_installment)}/mese
                  </div>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => openEditDebt(d)} className="p-1.5 text-neutral-400 hover:text-white"><Pencil size={14} /></button>
                <button onClick={() => archiveDebt(d.id)} className="p-1.5 text-neutral-400 hover:text-amber-400" title="Archivia"><Archive size={14} /></button>
                <button onClick={() => deleteDebt(d.id)} className="p-1.5 text-neutral-400 hover:text-red-400"><Trash size={14} /></button>
              </div>
            </div>
          ))}
          {activeDebts.length === 0 && (
            <div className="col-span-full text-sm text-neutral-500 border border-dashed border-neutral-800 rounded-sm p-6 text-center">
              Nessun debito attivo
            </div>
          )}
        </div>

        {archivedDebts.length > 0 && (
          <div className="mt-6 pt-4 border-t border-neutral-800">
            <div className="label-eyebrow text-neutral-500 mb-3">Archiviati</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {archivedDebts.map((d) => (
                <div key={d.id} className="border border-neutral-900 rounded-sm p-3 flex items-center justify-between opacity-60">
                  <span className="text-sm text-neutral-400">{d.name}</span>
                  <div className="flex gap-1">
                    <button onClick={() => unarchiveDebt(d)} className="text-xs text-emerald-400 hover:underline">Ripristina</button>
                    <button onClick={() => deleteDebt(d.id)} className="text-neutral-500 hover:text-red-400 ml-2"><Trash size={12} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Backup */}
      <div className="bg-[#121212] border border-neutral-800 rounded-md p-6">
        <div className="flex items-center gap-2 mb-1">
          <Database size={18} className="text-indigo-400" />
          <div className="label-eyebrow text-indigo-400">Sovranità dei dati</div>
        </div>
        <h3 className="font-heading text-xl font-bold">Backup & Ripristino</h3>
        <p className="text-sm text-neutral-400 mt-2 max-w-xl">
          Scarica un file JSON con TUTTI i tuoi dati (impostazioni, categorie, debiti, mesi, obiettivi, watchlist).
          Puoi ricaricarlo su un'altra installazione dell'app. I tuoi dati sono tuoi.
        </p>
        <div className="flex flex-wrap gap-3 mt-4">
          <Button onClick={downloadBackup} className="bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-white" data-testid="btn-download-backup">
            <DownloadSimple size={16} weight="bold" /> Scarica backup JSON
          </Button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden"
            onChange={(e) => e.target.files?.[0] && uploadBackup(e.target.files[0])} data-testid="input-restore" />
          <Button type="button" onClick={() => fileRef.current?.click()}
            className="bg-transparent hover:bg-neutral-900 border border-neutral-700 text-white" data-testid="btn-upload-backup">
            <UploadSimple size={16} weight="bold" /> Ripristina da backup
          </Button>
        </div>
      </div>

      <div className="bg-[#121212] border border-neutral-800 rounded-md p-6">
        <div className="label-eyebrow mb-1">Autonomia</div>
        <h3 className="font-heading text-xl font-bold">Sei libero di andartene da Emergent</h3>
        <p className="text-sm text-neutral-400 mt-2 max-w-2xl">
          Nella root del progetto trovi <code className="text-emerald-400 font-mono-num">SELF_HOST.md</code>: guida passo passo per far girare A.L.E.X. su GitHub + Vercel + Railway + MongoDB Atlas, con la tua chiave AI personale (o senza AI usando la modalità manuale).
        </p>
      </div>
    </div>
  );
}
