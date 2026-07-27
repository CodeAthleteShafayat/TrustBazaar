import { Outlet, NavLink, Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { motion } from "framer-motion";
import { Search, Wallet, ShoppingBag, Package, Home, Shield, LogOut, Plus, ShieldCheck, LayoutGrid, ShieldAlert } from "lucide-react";
import { cn } from "../lib/utils";
import { useState } from "react";

const publicNav = [
  { to: "/browse", label: "Browse", icon: Search },
  { to: "/how-it-works", label: "How it works", icon: ShieldCheck },
];

const privateNav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { to: "/browse", label: "Browse", icon: Search },
  { to: "/orders", label: "Orders", icon: ShoppingBag },
  { to: "/rentals", label: "Rentals", icon: Package },
  { to: "/wallet", label: "Wallet", icon: Wallet },
];

export function Layout() {
  const { user, token, clear } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  const [query, setQuery] = useState("");
  const navItems = token ? (user?.is_admin ? [...privateNav, { to: "/admin", label: "Admin", icon: ShieldAlert }] : privateNav) : publicNav;

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/browse?q=${encodeURIComponent(q)}` : "/browse");
  }

  return (
    <div className="min-h-screen bg-[#fbf7f2] text-stone-900">
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-orange-300/30 blur-3xl" />
        <div className="absolute top-1/2 -left-40 h-80 w-80 rounded-full bg-amber-200/40 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-80 w-80 rounded-full bg-rose-200/30 blur-3xl" />
      </div>

      <header className="sticky top-0 z-40 border-b border-stone-200/70 bg-[#fbf7f2]/80 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 items-center justify-between gap-6 px-4">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <motion.div
              whileHover={{ rotate: 12, scale: 1.05 }}
              transition={{ type: "spring", stiffness: 300 }}
              className="h-9 w-9 rounded-xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 flex items-center justify-center shadow-lg shadow-orange-500/30"
            >
              <Shield className="h-5 w-5 text-white" />
            </motion.div>
            <span className="text-lg font-bold tracking-tight">TrustBazaar</span>
          </Link>

          {loc.pathname !== "/" && (
            <form onSubmit={submitSearch} className="hidden md:flex flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search listings..."
                  className="w-full h-10 rounded-xl border border-stone-200 bg-white pl-10 pr-4 text-sm placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/60 transition-all shadow-sm"
                />
              </div>
            </form>
          )}

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/browse"}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-white text-stone-900 shadow-sm border border-stone-200"
                      : "text-stone-600 hover:bg-white/70 hover:text-stone-900",
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            {token ? (
              <>
                <Link to="/create" className="hidden sm:inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 shadow-md shadow-stone-900/10 transition">
                  <Plus className="h-4 w-4" />
                  List item
                </Link>
                <Link to="/profile" className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-sm hover:bg-stone-50 transition">
                  <div className="h-7 w-7 rounded-full bg-gradient-to-br from-amber-500 to-rose-500 flex items-center justify-center text-xs font-bold text-white">
                    {user?.display_name?.[0]?.toUpperCase() || "U"}
                  </div>
                  <span className="hidden md:inline">{user?.display_name?.split(" ")[0]}</span>
                </Link>
                <button
                  onClick={() => { clear(); navigate("/"); }}
                  className="rounded-xl p-2 hover:bg-white/70 transition text-stone-600"
                  title="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-sm font-medium text-stone-700 hover:text-stone-900 px-3 py-2">Sign in</Link>
                <Link to="/signup" state={{ from: loc.pathname + loc.search }} className="rounded-xl bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 shadow-md shadow-stone-900/10 transition">Get started</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Outlet />
      </main>

      <footer className="mt-16 border-t border-stone-200/70 py-8 text-center text-xs text-stone-500">
        Built for trust, not transactions. <Home className="inline h-3 w-3" />
      </footer>
    </div>
  );
}