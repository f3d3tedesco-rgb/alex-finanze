import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import RecapMensile from "@/pages/RecapMensile";
import Investimenti from "@/pages/Investimenti";
import Debiti from "@/pages/Debiti";
import FondoEmergenza from "@/pages/FondoEmergenza";
import AIAnalisi from "@/pages/AIAnalisi";
import Impostazioni from "@/pages/Impostazioni";

function App() {
  return (
    <div className="App min-h-screen bg-[#0A0A0A] text-white">
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/recap" element={<RecapMensile />} />
            <Route path="/investimenti" element={<Investimenti />} />
            <Route path="/debiti" element={<Debiti />} />
            <Route path="/emergenza" element={<FondoEmergenza />} />
            <Route path="/ai" element={<AIAnalisi />} />
            <Route path="/impostazioni" element={<Impostazioni />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster theme="dark" position="top-right" richColors />
    </div>
  );
}

export default App;
