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
          <footer className="border-t border-gray-200 dark:border-gray-800 mt-12">
            <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-4">
                  <span>数据来源：SEC EDGAR 13F</span>
                  <span className="hidden sm:inline">·</span>
                  <span>每季度自动更新</span>
                </div>
                <div className="flex items-center gap-4">
                  <span>联系作者</span>
                  <a href="mailto:fo133553@gmail.com" className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-colors">📧 fo133553@gmail.com</a>
                  <span className="inline-flex items-center gap-1"><svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8.69 2C4.85 2 2 5.64 2 9.52c0 4.59 4.32 8.36 10 12.48 5.68-4.12 10-7.89 10-12.48C22 5.64 19.15 2 15.31 2c-2.14 0-3.79 1.22-4.31 2.39C10.48 3.22 8.83 2 8.69 2z"/></svg> 微信：240147696</span>
                </div>
              </div>
              <div className="mt-3 text-center text-[10px] text-gray-400 dark:text-gray-500">
                ⚠️ 本站仅展示公开 13F 持仓数据，不构成投资建议。13F 有 45 天延迟，仅反映美股多头持仓。
              </div>
            </div>
          </footer>
        </div>
      </BrowserRouter>
    </ThemeProvider>
  );
}
