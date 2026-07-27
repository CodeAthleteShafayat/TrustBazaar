import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Search, ShieldCheck, Sparkles, PackageSearch } from "lucide-react";
import { Input, Select } from "../components/ui/Input";
import { ListingCard } from "../components/ListingCard";
import { apiClient } from "../lib/client";
import { EmptyState } from "../components/EmptyState";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";

const CATEGORIES = ["", "electronics", "fashion", "furniture", "sports", "books", "tools", "vehicles"];

export function Browse() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [type, setType] = useState("");
  const [minScore, setMinScore] = useState("");
  const { token } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["listings", { q, category, type, minScore }],
    queryFn: () => apiClient.listListings({
      q: q || undefined,
      category: category || undefined,
      listing_type: type || undefined,
    }),
  });

  const listings = data?.data || [];

  return (
    <div className="space-y-8">
      {!token && (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-3xl border border-stone-200/80 bg-gradient-to-br from-amber-100 via-orange-100 to-rose-100 p-8 md:p-10"
        >
          <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-orange-300/40 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-amber-300/40 blur-3xl" />
          <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white/70 px-3 py-1 text-xs text-stone-600 backdrop-blur">
                <Sparkles className="h-3.5 w-3.5 text-orange-500" />
                P2P marketplace with built-in escrow
              </div>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-stone-900 md:text-4xl">
                Browse freely. Sign in only when you buy, sell, or rent.
              </h1>
              <p className="mt-2 text-sm text-stone-600 md:text-base">
                Money is held in escrow until both sides confirm. Trust Score protects every deal.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Link
                  to="/signup"
                  className="rounded-xl bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-stone-900/20 hover:bg-stone-800 transition"
                >
                  Create free account
                </Link>
                <Link
                  to="/login"
                  className="rounded-xl border border-stone-200 bg-white px-5 py-2.5 text-sm font-semibold text-stone-800 hover:bg-stone-50 transition"
                >
                  Sign in
                </Link>
                <div className="flex items-center gap-1.5 text-xs text-stone-500">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  No credit card needed
                </div>
              </div>
            </div>
          </div>
        </motion.section>
      )}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-1"
      >
        <h1 className="text-3xl font-bold tracking-tight text-stone-900">
          {token ? "Browse" : "Today's listings"}
        </h1>
        <p className="text-stone-500">Discover what your community is trading. Trust first, price second.</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-4 gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"
      >
        <div className="md:col-span-2 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
          <Input
            placeholder="Search listings..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c ? c.charAt(0).toUpperCase() + c.slice(1) : "All categories"}</option>
          ))}
        </Select>
        <div className="grid grid-cols-2 gap-2">
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All types</option>
            <option value="sale">For sale</option>
            <option value="rent">For rent</option>
          </Select>
          <Select value={minScore} onChange={(e) => setMinScore(e.target.value)}>
            <option value="">Any score</option>
            <option value="70">Trust 70+</option>
            <option value="85">Trust 85+</option>
          </Select>
        </div>
      </motion.div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-2xl skeleton" />
          ))}
        </div>
      ) : listings.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title="No listings match"
          description="Try clearing the filters or check back soon — new deals drop daily."
          action={<Link to="/create" className="text-orange-600 hover:underline font-medium">List the first one →</Link>}
        />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {listings.map((listing, i) => (
            <ListingCard key={listing.id} listing={listing} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}