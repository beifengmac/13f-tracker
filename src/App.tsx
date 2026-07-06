import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import FundDetail from './components/FundDetail';
import StockLookup from './components/StockLookup';
import CompareView from './components/CompareView';

/* ── Theme context ──────────────────────────────────────────── */

interface ThemeCtx { dark: boolean; toggle: () => void }
const ThemeContext = createContext<ThemeCtx>({ dark: false, toggle: () => {} });
export function useTheme() { return useContext(ThemeContext); }

function ThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem('13f-theme') === 'dark'; } catch { return false; }
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    try { localStorage.setItem('13f-theme', dark ? 'dark' : 'light'); } catch { /* noop */ }
  }, [dark]);

  return (
    <ThemeContext.Provider value={{ dark, toggle: () => setDark(d => !d) }}>
      {children}
    </ThemeContext.Provider>
  );
}

/* ── App ────────────────────────────────────────────────────── */

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter basename="/13f-tracker">
        <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
          <Navbar />
          <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/fund/:id" element={<FundDetail />} />
              <Route path="/stock/:ticker" element={<StockLookup />} />
              <Route path="/compare" element={<CompareView />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </ThemeProvider>
  );
}
