import { useState } from "react";
import useSWR, { mutate } from "swr";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Brain, MagnifyingGlass, TrendUp, Warning, Trash, Sparkle, Plus } from "@phosphor-icons/react";

const fetcher = (url) => api.get(url).then((r) => r.data);

const decisionColor = (d) => {
  const s = (d || "").toUpperCase();
  if (s === "BUY") return "text-emerald-400 border-emerald-500/30 bg-emerald-500/10";
  if (s === "SELL") return "text-red-400 border-red-500/30 bg-red-500/10";
  if (s === "WATCH") return "text-indigo-400 border-indigo-500/30 bg-indigo-500/10";
  return "text-amber-400 border-amber-500/30 bg-amber-500/10";
};

function AnalysisResult({ result }) {
  if (!result) return null;
  const items = [
    { label: "Business Moat", val: result.business_moat, icon: TrendUp },
    { label: "Management", val: result.management },
    { label: "Bilanci", val: result.bilanci },
    { label: "Crescita", val: result.crescita },
    { label: "Valutazione", val: result.valutazione },
    { label: "Trend", val: result.trend },
    { label: "Rischi", val: result.rischi, icon: Warning },
  ];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className={`px-3 py-1.5 rounded-sm border text-xs font-bold uppercase tracking-widest ${decisionColor(result.decisione_finale)}`}>
          {result.decisione_finale}
        </div>
        <div className="text-neutral-400 text-sm">
          <span className="label-eyebrow">Score</span>{" "}
          <span className="font-mono-num text-white text-lg font-bold ml-1">{result.score}/100</span>
        </div>
        <div className="text-neutral-400 text-sm">
          <span className="label-eyebrow">Target</span>{" "}
          <span className="font-mono-num text-white ml-1">{result.prezzo_obiettivo}</span>
        </div>
        <div className="text-neutral-400 text-sm">
          <span className="label-eyebrow">Attuale</span>{" "}
          <span className="font-mono-num text-white ml-1">{result.prezzo_attuale}</span>
        </div>
      </div>

      <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-md p-4">
        <div className="label-eyebrow text-indigo-400 mb-2">Motivazione</div>
        <p className="text-sm text-neutral-200 leading-relaxed">{result.motivazione}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.map((it) => (
          <div key={it.label} className="border border-neutral-800 rounded-sm p-4 bg-black/40">
            <div className="flex items-center gap-2 mb-2">
              {it.icon && <it.icon size={14} className="text-neutral-500" />}
              <div className="label-eyebrow">{it.label}</div>
            </div>
            <p className="text-sm text-neutral-300 leading-relaxed">{it.val}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AIAnalisi() {
  const [ticker, setTicker] = useState("");
  const [azienda, setAzienda] = useState("");
  const [contesto, setContesto] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState({
    ticker: "", azienda: "", settore: "", decisione_finale: "WATCH", score: 50,
    prezzo_obiettivo: "", prezzo_attuale: "", motivazione: "",
    business_moat: "", management: "", bilanci: "", crescita: "", valutazione: "", trend: "", rischi: "",
  });
  const { data: watchlist } = useSWR("/watchlist", fetcher);

  const runAnalysis = async (e) => {
    e.preventDefault();
    if (!ticker || !azienda) {
      toast.error("Inserisci ticker e nome azienda");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await api.post("/ai/analyze", { ticker, azienda, contesto });
      setResult(res.data);
      toast.success("Analisi completata", { description: `Decisione: ${res.data.decisione_finale}` });
    } catch (err) {
      toast.error("Errore analisi AI", { description: err?.response?.data?.detail || err.message });
    } finally {
      setLoading(false);
    }
  };

  const saveToWatchlist = async () => {
    if (!result) return;
    try {
      await api.post("/watchlist", {
        id: crypto.randomUUID(),
        ticker,
        azienda,
        settore: result.settore || "",
        business_moat: result.business_moat,
        management: result.management,
        bilanci: result.bilanci,
        crescita: result.crescita,
        valutazione: result.valutazione,
        trend: result.trend,
        rischi: result.rischi,
        prezzo_obiettivo: result.prezzo_obiettivo,
        prezzo_attuale: result.prezzo_attuale,
        decisione_finale: result.decisione_finale,
        motivazione: result.motivazione,
        score: result.score,
        data_analisi: new Date().toISOString(),
      });
      mutate("/watchlist");
      toast.success("Aggiunto alla watchlist");
    } catch (err) {
      toast.error("Errore salvataggio");
    }
  };

  const removeItem = async (id) => {
    await api.delete(`/watchlist/${id}`);
    mutate("/watchlist");
    toast.success("Rimosso dalla watchlist");
  };

  const saveManual = async () => {
    if (!manual.ticker || !manual.azienda) {
      toast.error("Ticker e azienda obbligatori");
      return;
    }
    try {
      await api.post("/watchlist", {
        ...manual,
        id: crypto.randomUUID(),
        score: parseInt(manual.score) || 0,
        data_analisi: new Date().toISOString(),
      });
      mutate("/watchlist");
      setManualOpen(false);
      setManual({ ticker: "", azienda: "", settore: "", decisione_finale: "WATCH", score: 50,
        prezzo_obiettivo: "", prezzo_attuale: "", motivazione: "",
        business_moat: "", management: "", bilanci: "", crescita: "", valutazione: "", trend: "", rischi: "" });
      toast.success("Azienda aggiunta manualmente");
    } catch (e) {
      toast.error("Errore salvataggio");
    }
  };

  return (
    <div className="p-6 md:p-8 pb-24 md:pb-8 space-y-6 grid-bg min-h-screen" data-testid="ai-page">
      <div className="flex items-center gap-3">
        <Brain size={28} weight="bold" className="text-indigo-400" />
        <div>
          <div className="label-eyebrow text-indigo-400">Powered by Claude Sonnet 4.5</div>
          <h1 className="font-heading text-4xl font-bold mt-1">AI Analisi Aziende</h1>
        </div>
      </div>
      <p className="text-neutral-400 text-sm max-w-2xl">
        L'AI resta opzionale: usa "Aggiungi manualmente" per incollare analisi fatte con AI gratuite esterne (ChatGPT, Gemini, Claude web) — nessun costo API.
      </p>

      <form onSubmit={runAnalysis} className="bg-[#121212] border border-neutral-800 rounded-md p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="label-eyebrow">Ticker</Label>
            <Input
              placeholder="Es. NVDA"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              className="mt-2 bg-black border-neutral-800 text-white font-mono-num uppercase"
              data-testid="input-ticker"
            />
          </div>
          <div>
            <Label className="label-eyebrow">Azienda</Label>
            <Input
              placeholder="Es. NVIDIA Corporation"
              value={azienda}
              onChange={(e) => setAzienda(e.target.value)}
              className="mt-2 bg-black border-neutral-800 text-white"
              data-testid="input-azienda"
            />
          </div>
        </div>
        <div>
          <Label className="label-eyebrow">Contesto extra (opzionale)</Label>
          <Textarea
            placeholder="Focus specifico (es. AI/Robotica), scenari, tesi di investimento..."
            value={contesto}
            onChange={(e) => setContesto(e.target.value)}
            className="mt-2 bg-black border-neutral-800 text-white"
            rows={2}
            data-testid="input-contesto"
          />
        </div>
        <Button
          type="submit"
          disabled={loading}
          className="bg-indigo-500 hover:bg-indigo-400 text-white font-semibold border-0"
          data-testid="btn-analyze"
        >
          {loading ? (
            <><Sparkle size={18} weight="bold" className="animate-pulse" /> Analisi in corso...</>
          ) : (
            <><MagnifyingGlass size={18} weight="bold" /> Esegui analisi AI</>
          )}
        </Button>
        <Dialog open={manualOpen} onOpenChange={setManualOpen}>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" className="ml-2 bg-transparent border-neutral-700 text-white hover:bg-neutral-900" data-testid="btn-manual">
              <Plus size={16} weight="bold" /> Aggiungi manualmente
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#0A0A0A] border-neutral-800 text-white max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-heading">Aggiungi analisi manuale</DialogTitle>
            </DialogHeader>
            <p className="text-xs text-neutral-500">Usa un'AI gratuita esterna (ChatGPT, Gemini, Claude web) e incolla qui i risultati. Nessun costo AI.</p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Ticker" value={manual.ticker} onChange={(e) => setManual({ ...manual, ticker: e.target.value.toUpperCase() })} className="bg-black border-neutral-800 font-mono-num uppercase" data-testid="m-ticker" />
                <Input placeholder="Azienda" value={manual.azienda} onChange={(e) => setManual({ ...manual, azienda: e.target.value })} className="bg-black border-neutral-800" data-testid="m-azienda" />
              </div>
              <Input placeholder="Settore" value={manual.settore} onChange={(e) => setManual({ ...manual, settore: e.target.value })} className="bg-black border-neutral-800" />
              <div className="grid grid-cols-3 gap-3">
                <select value={manual.decisione_finale} onChange={(e) => setManual({ ...manual, decisione_finale: e.target.value })} className="bg-black border border-neutral-800 rounded-md px-3 py-2 text-sm" data-testid="m-decisione">
                  <option>BUY</option><option>HOLD</option><option>SELL</option><option>WATCH</option>
                </select>
                <Input type="number" placeholder="Score 0-100" value={manual.score} onChange={(e) => setManual({ ...manual, score: e.target.value })} className="bg-black border-neutral-800 font-mono-num" data-testid="m-score" />
                <Input placeholder="Prezzo target" value={manual.prezzo_obiettivo} onChange={(e) => setManual({ ...manual, prezzo_obiettivo: e.target.value })} className="bg-black border-neutral-800 font-mono-num" />
              </div>
              <Textarea placeholder="Motivazione decisione" value={manual.motivazione} onChange={(e) => setManual({ ...manual, motivazione: e.target.value })} className="bg-black border-neutral-800" rows={2} data-testid="m-motivazione" />
              <Textarea placeholder="Business Moat" value={manual.business_moat} onChange={(e) => setManual({ ...manual, business_moat: e.target.value })} className="bg-black border-neutral-800" rows={2} />
              <Textarea placeholder="Bilanci" value={manual.bilanci} onChange={(e) => setManual({ ...manual, bilanci: e.target.value })} className="bg-black border-neutral-800" rows={2} />
              <Textarea placeholder="Rischi" value={manual.rischi} onChange={(e) => setManual({ ...manual, rischi: e.target.value })} className="bg-black border-neutral-800" rows={2} />
            </div>
            <DialogFooter>
              <Button onClick={saveManual} className="bg-emerald-500 hover:bg-emerald-400 text-black" data-testid="btn-save-manual">Salva in watchlist</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </form>

      {loading && (
        <div className="bg-[#121212] border border-neutral-800 rounded-md p-6 animate-pulse space-y-3" data-testid="loading-skeleton">
          <div className="h-4 bg-neutral-800 rounded w-1/3" />
          <div className="h-3 bg-neutral-800 rounded w-full" />
          <div className="h-3 bg-neutral-800 rounded w-5/6" />
          <div className="h-3 bg-neutral-800 rounded w-4/6" />
        </div>
      )}

      {result && (
        <div className="bg-[#121212] border border-neutral-800 rounded-md p-6 space-y-4" data-testid="analysis-result">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="label-eyebrow text-indigo-400">Report equity research</div>
              <h3 className="font-heading text-2xl font-bold mt-1">{result.azienda} <span className="text-neutral-500 text-lg font-mono-num">· {result.ticker}</span></h3>
              <div className="text-xs text-neutral-500 mt-1">{result.settore}</div>
            </div>
            <Button onClick={saveToWatchlist} className="bg-emerald-500 hover:bg-emerald-400 text-black" data-testid="btn-save-watchlist">
              Salva in Watchlist
            </Button>
          </div>
          <AnalysisResult result={result} />
        </div>
      )}

      <div className="bg-[#121212] border border-neutral-800 rounded-md overflow-hidden">
        <div className="p-5 border-b border-neutral-800">
          <div className="label-eyebrow">Watchlist</div>
          <h3 className="font-heading text-lg font-bold mt-1">Aziende Analizzate</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-black text-neutral-500 uppercase text-xs tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left">Ticker</th>
                <th className="px-4 py-3 text-left">Azienda</th>
                <th className="px-4 py-3 text-left">Decisione</th>
                <th className="px-4 py-3 text-right">Score</th>
                <th className="px-4 py-3 text-left">Target</th>
                <th className="px-4 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {watchlist?.map((w) => (
                <tr key={w.id} className="border-t border-neutral-900 hover:bg-neutral-900/50" data-testid={`wl-row-${w.ticker}`}>
                  <td className="px-4 py-3 font-mono-num font-bold">{w.ticker}</td>
                  <td className="px-4 py-3 text-neutral-300">{w.azienda}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-sm border text-xs font-bold ${decisionColor(w.decisione_finale)}`}>{w.decisione_finale}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono-num">{w.score}</td>
                  <td className="px-4 py-3 font-mono-num text-neutral-300">{w.prezzo_obiettivo}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => removeItem(w.id)} className="text-neutral-500 hover:text-red-400" data-testid={`btn-del-${w.ticker}`}>
                      <Trash size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {(!watchlist || watchlist.length === 0) && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-neutral-500">Nessuna analisi salvata</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
