import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';

export default function Navbar() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    const t = search.trim().toUpperCase();
    if (t) {
      navigate(`/stock/${encodeURIComponent(t)}`);
      setSearch('');
      setMenuOpen(false);
    }
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-gray-200 bg-white/80 backdrop-blur dark:border-gray-800 dark:bg-gray-950/80">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 font-bold text-lg tracking-tight text-gray-900 dark:text-white">
          <span className="text-xl">📊</span>
          <span className="hidden sm:inline">13F Tracker</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6">
          <Link to="/" className="text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors">
            Dashboard
          </Link>
          <Link to="/compare" className="text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors">
            Compare
          </Link>
          <form onSubmit={handleSearch} className="relative">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search ticker…"
              className="w-40 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-gray-700 dark:bg-gray-900 dark:focus:border-blue-500 dark:focus:ring-blue-900/40 transition-all"
            />
            <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-gray-300 bg-gray-100 px-1 text-[10px] text-gray-400 dark:border-gray-600 dark:bg-gray-800">
              ↵
            </kbd>
          </form>
          <ThemeToggle />
        </div>

        {/* Mobile hamburger */}
        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <button onClick={() => setMenuOpen(o => !o)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {menuOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="border-t border-gray-200 bg-white px-4 py-3 md:hidden dark:border-gray-800 dark:bg-gray-950">
          <div className="flex flex-col gap-3">
            <Link to="/" onClick={() => setMenuOpen(false)} className="text-sm font-medium text-gray-700 dark:text-gray-300">Dashboard</Link>
            <Link to="/compare" onClick={() => setMenuOpen(false)} className="text-sm font-medium text-gray-700 dark:text-gray-300">Compare</Link>
            <form onSubmit={handleSearch}>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search ticker…"
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none dark:border-gray-700 dark:bg-gray-900"
              />
            </form>
          </div>
        </div>
      )}
    </nav>
  );
}
