import { NavLink, Outlet } from "react-router-dom";
import {
  ChartLineUp,
  ClipboardText,
  ChartPieSlice,
  CreditCard,
  Lifebuoy,
  Brain,
  Gear,
  Target,
  CircuitryIcon,
} from "@phosphor-icons/react";

const nav = [
  { to: "/", label: "Dashboard", icon: ChartLineUp, testid: "nav-dashboard" },
  { to: "/recap", label: "Recap Mensile", icon: ClipboardText, testid: "nav-recap" },
  { to: "/investimenti", label: "Investimenti", icon: ChartPieSlice, testid: "nav-investimenti" },
  { to: "/debiti", label: "Debiti", icon: CreditCard, testid: "nav-debiti" },
  { to: "/emergenza", label: "Fondo Emergenza", icon: Lifebuoy, testid: "nav-emergenza" },
  { to: "/goals", label: "Goals", icon: Target, testid: "nav-goals" },
  { to: "/ai", label: "AI Analisi Aziende", icon: Brain, testid: "nav-ai" },
  { to: "/impostazioni", label: "Impostazioni", icon: Gear, testid: "nav-impostazioni" },
];

export default function Layout() {
  return (
    <div className="flex min-h-screen bg-[#0A0A0A]">
      {/* Sidebar */}
      <aside className="hidden md:flex md:w-64 shrink-0 flex-col border-r border-neutral-800 bg-[#0A0A0A] sticky top-0 h-screen">
        <div className="px-6 py-6 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-sm bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <CircuitryIcon size={20} weight="bold" className="text-emerald-400" />
            </div>
            <div>
              <div className="font-heading text-lg font-bold leading-none tracking-tight">A.L.E.X.</div>
              <div className="label-eyebrow mt-1">Financial Cockpit</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/"}
              data-testid={n.testid}
              className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
            >
              <n.icon size={18} weight="bold" />
              <span className="text-sm">{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="px-6 py-4 border-t border-neutral-800">
          <div className="label-eyebrow">Build</div>
          <div className="font-mono-num text-xs text-neutral-400 mt-1">v1.0 · Feb 2026</div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-30 border-b border-neutral-800 bg-black/80 backdrop-blur-xl px-4 py-3 flex items-center gap-3">
        <div className="h-8 w-8 rounded-sm bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
          <CircuitryIcon size={18} weight="bold" className="text-emerald-400" />
        </div>
        <div className="font-heading text-base font-bold">A.L.E.X.</div>
      </div>

      <main className="flex-1 min-w-0 pt-16 md:pt-0" data-testid="main-content">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 grid grid-cols-6 border-t border-neutral-800 bg-black/90 backdrop-blur-xl">
        {nav.slice(0, 6).map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === "/"}
            data-testid={`m-${n.testid}`}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-2 text-[10px] ${isActive ? "text-emerald-400" : "text-neutral-400"}`
            }
          >
            <n.icon size={18} weight="bold" />
            <span className="truncate max-w-full px-1">{n.label.split(" ")[0]}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
