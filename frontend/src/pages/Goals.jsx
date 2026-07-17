import { useState } from "react";
import useSWR, { mutate } from "swr";
import { toast } from "sonner";
import { api, fmtEUR } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Target, Plus, Trash, Flag } from "@phosphor-icons/react";

const fetcher = (url) => api.get(url).then((r) => r.data);

const CATEGORIES = [
  { v: "casa", l: "Fondo Casa", c: "#F59E0B" },
  { v: "pensione", l: "Pensione", c: "#6366F1" },
  { v: "figlia", l: "Fondo Figlia", c: "#EC4899" },
  { v: "vacanza", l: "Vacanze", c: "#22D3EE" },
  { v: "auto", l: "Auto", c: "#84CC16" },
  { v: "generico", l: "Generico", c: "#10B981" },
];

const catColor = (v) => CATEGORIES.find((c) => c.v === v)?.c || "#10B981";
const catLabel = (v) => CATEGORIES.find((c) => c.v === v)?.l || v;

export default function Goals() {
  const { data: goals } = useSWR("/goals", fetcher);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    nome: "", categoria: "casa", target: 0, attuale: 0, scadenza: "", priorita: 3, note: "",
  });

  const openNew = () => {
    setEditing(null);
    setForm({ nome: "", categoria: "casa", target: 0, attuale: 0, scadenza: "", priorita: 3, note: "" });
    setOpen(true);
  };
  const openEdit = (g) => {
    setEditing(g);
    setForm({ ...g });
    setOpen(true);
  };

  const save = async () => {
    try {
      const payload = {
        ...form,
        id: editing?.id || crypto.randomUUID(),
        target: Number(form.target) || 0,
        attuale: Number(form.attuale) || 0,
        priorita: parseInt(form.priorita) || 3,
      };
      await api.post("/goals", payload);
      mutate("/goals");
      setOpen(false);
      toast.success(editing ? "Obiettivo aggiornato" : "Obiettivo creato");
    } catch (e) {
      toast.error("Errore salvataggio");
    }
  };

  const remove = async (id) => {
    await api.delete(`/goals/${id}`);
    mutate("/goals");
    toast.success("Obiettivo rimosso");
  };

  return (
    <div className="p-6 md:p-8 pb-24 md:pb-8 space-y-6" data-testid="goals-page">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Target size={28} weight="bold" className="text-emerald-400" />
          <div>
            <div className="label-eyebrow">Obiettivi personali</div>
            <h1 className="font-heading text-4xl font-bold mt-1">Goals</h1>
          </div>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew} className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold" data-testid="btn-new-goal">
              <Plus size={16} weight="bold" /> Nuovo obiettivo
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#0A0A0A] border-neutral-800 text-white max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-heading">{editing ? "Modifica obiettivo" : "Nuovo obiettivo"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="label-eyebrow">Nome</Label>
                <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  className="mt-2 bg-black border-neutral-800" data-testid="goal-nome" placeholder="Es. Anticipo casa" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="label-eyebrow">Categoria</Label>
                  <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v })}>
                    <SelectTrigger className="mt-2 bg-black border-neutral-800" data-testid="goal-categoria"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-[#0A0A0A] border-neutral-800 text-white">
                      {CATEGORIES.map((c) => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="label-eyebrow">Priorità (1-5)</Label>
                  <Input type="number" min={1} max={5} value={form.priorita}
                    onChange={(e) => setForm({ ...form, priorita: e.target.value })}
                    className="mt-2 bg-black border-neutral-800 font-mono-num" data-testid="goal-priorita" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="label-eyebrow">Target €</Label>
                  <Input type="number" step="0.01" value={form.target}
                    onChange={(e) => setForm({ ...form, target: e.target.value })}
                    className="mt-2 bg-black border-neutral-800 font-mono-num" data-testid="goal-target" />
                </div>
                <div>
                  <Label className="label-eyebrow">Attuale €</Label>
                  <Input type="number" step="0.01" value={form.attuale}
                    onChange={(e) => setForm({ ...form, attuale: e.target.value })}
                    className="mt-2 bg-black border-neutral-800 font-mono-num" data-testid="goal-attuale" />
                </div>
              </div>
              <div>
                <Label className="label-eyebrow">Scadenza (YYYY-MM)</Label>
                <Input type="month" value={form.scadenza} onChange={(e) => setForm({ ...form, scadenza: e.target.value })}
                  className="mt-2 bg-black border-neutral-800 font-mono-num" data-testid="goal-scadenza" />
              </div>
              <div>
                <Label className="label-eyebrow">Note</Label>
                <Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })}
                  className="mt-2 bg-black border-neutral-800" rows={2} data-testid="goal-note" />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={save} className="bg-emerald-500 hover:bg-emerald-400 text-black" data-testid="btn-save-goal">Salva</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <p className="text-neutral-400 text-sm max-w-2xl">
        Definisci i tuoi obiettivi finanziari (casa, pensione, vacanza, ...) e traccia il progresso mese dopo mese.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {goals?.map((g) => {
          const pct = g.target > 0 ? Math.min(100, (g.attuale / g.target) * 100) : 0;
          const remaining = Math.max(0, g.target - g.attuale);
          const color = catColor(g.categoria);
          return (
            <div key={g.id} className="bg-[#121212] border border-neutral-800 rounded-md p-6 hover:border-neutral-700" data-testid={`goal-${g.id}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                  <div className="label-eyebrow">{catLabel(g.categoria)}</div>
                  <div className="flex items-center gap-0.5 ml-2">
                    {Array.from({ length: 6 - g.priorita }).map((_, i) => (
                      <Flag key={i} size={10} weight="fill" className="text-amber-400" />
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openEdit(g)} className="text-xs text-neutral-500 hover:text-white" data-testid={`edit-${g.id}`}>Modifica</button>
                  <button onClick={() => remove(g.id)} className="text-neutral-500 hover:text-red-400" data-testid={`del-${g.id}`}><Trash size={14} /></button>
                </div>
              </div>
              <h3 className="font-heading text-xl font-bold">{g.nome}</h3>
              <div className="flex items-baseline justify-between mt-3">
                <div className="font-mono-num text-2xl font-bold">{fmtEUR(g.attuale)}</div>
                <div className="font-mono-num text-sm text-neutral-500">/ {fmtEUR(g.target)}</div>
              </div>
              <div className="w-full h-2 bg-neutral-800 rounded-sm mt-3 overflow-hidden">
                <div className="h-full transition-[width] duration-500" style={{ width: `${pct}%`, background: color }} />
              </div>
              <div className="flex justify-between text-xs text-neutral-500 mt-2 font-mono-num">
                <span>{pct.toFixed(1)}%</span>
                <span>{g.scadenza || "senza scadenza"}</span>
              </div>
              {g.note && <p className="text-xs text-neutral-400 mt-3 border-t border-neutral-800 pt-3">{g.note}</p>}
              <div className="text-xs text-neutral-500 mt-2 font-mono-num">Mancano {fmtEUR(remaining)}</div>
            </div>
          );
        })}
        {(!goals || goals.length === 0) && (
          <div className="col-span-full bg-[#121212] border border-dashed border-neutral-800 rounded-md p-12 text-center">
            <Target size={40} className="text-neutral-700 mx-auto mb-3" />
            <p className="text-neutral-500 text-sm">Nessun obiettivo. Crea il tuo primo goal.</p>
          </div>
        )}
      </div>
    </div>
  );
}
