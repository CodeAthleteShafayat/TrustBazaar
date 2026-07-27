import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import {
  Shield, ShieldCheck, Sparkles, ArrowRight, HandHeart, RefreshCw,
  Calendar, BadgeCheck, Wallet, Search,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { apiClient } from "../lib/client";
import { ListingCard } from "../components/ListingCard";

const CATEGORIES = [
  { key: "electronics", label: "Electronics", emoji: "💻" },
  { key: "fashion", label: "Fashion", emoji: "👜" },
  { key: "furniture", label: "Furniture", emoji: "🛋️" },
  { key: "sports", label: "Sports", emoji: "🚲" },
  { key: "books", label: "Books", emoji: "📚" },
  { key: "tools", label: "Tools", emoji: "🧰" },
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as any } },
};

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

export function Landing() {
  const { token } = useAuth();
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 80]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0.2]);

  const { data } = useQuery({
    queryKey: ["listings", "landing"],
    queryFn: () => apiClient.listListings(),
  });
  const featured = data?.data?.slice(0, 8) || [];

  return (
    <div className="relative">
      <header className="sticky top-0 z-40 border-b border-stone-200/60 bg-[#fbf7f2]/80 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <motion.div
              whileHover={{ rotate: 10, scale: 1.05 }}
              transition={{ type: "spring", stiffness: 300 }}
              className="h-9 w-9 rounded-xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 flex items-center justify-center shadow-md shadow-orange-300/40"
            >
              <Shield className="h-5 w-5 text-white" />
            </motion.div>
            <span className="text-lg font-bold tracking-tight text-stone-900">TrustBazaar</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1 text-sm text-stone-700">
            <Link to="/browse" className="rounded-lg px-3 py-2 hover:bg-stone-200/60">Browse</Link>
            <a href="#how" className="rounded-lg px-3 py-2 hover:bg-stone-200/60">How it works</a>
            <a href="#trust" className="rounded-lg px-3 py-2 hover:bg-stone-200/60">Trust</a>
            <a href="#categories" className="rounded-lg px-3 py-2 hover:bg-stone-200/60">Categories</a>
          </nav>
          <div className="flex items-center gap-2">
            {token ? (
              <Link
                to="/browse"
                className="rounded-xl bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
              >
                Open marketplace
              </Link>
            ) : (
              <>
                <Link to="/login" className="text-sm font-medium text-stone-700 px-3 py-2 hover:text-stone-900">Sign in</Link>
                <Link
                  to="/signup"
                  className="rounded-xl bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
                >
                  Join free
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <section ref={heroRef} className="relative overflow-hidden bg-[#fbf7f2]">
        <div className="absolute inset-0 -z-0">
          <div className="absolute -top-32 -left-24 h-96 w-96 rounded-full bg-amber-200/40 blur-3xl" />
          <div className="absolute top-20 right-0 h-[28rem] w-[28rem] rounded-full bg-rose-200/40 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-emerald-200/30 blur-3xl" />
        </div>

        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="container mx-auto relative z-10 px-4 pt-16 pb-20 md:pt-24 md:pb-28">
          <motion.div
            initial="hidden"
            animate="show"
            variants={stagger}
            className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center"
          >
            <div className="lg:col-span-6">
              <motion.div variants={fadeUp} className="inline-flex items-center gap-2 rounded-full border border-stone-300/60 bg-white/70 px-3 py-1.5 text-xs text-stone-700 backdrop-blur">
                <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                A neighbourhood marketplace with a built-in safety net
              </motion.div>

              <motion.h1
                variants={fadeUp}
                className="mt-5 text-4xl md:text-6xl font-bold leading-[1.05] tracking-tight text-stone-900"
              >
                Buy, sell and rent <br className="hidden md:block" />
                from people <span className="bg-gradient-to-r from-amber-600 via-orange-600 to-rose-600 bg-clip-text text-transparent">you can trust.</span>
              </motion.h1>

              <motion.p variants={fadeUp} className="mt-5 text-lg text-stone-600 max-w-xl">
                Every payment is held in escrow until both sides are happy. Every member carries a Trust Score that grows with every honest deal.
              </motion.p>

              <motion.div variants={fadeUp} className="mt-7 flex flex-wrap items-center gap-3">
                <Link
                  to="/browse"
                  className="group inline-flex items-center gap-2 rounded-2xl bg-stone-900 px-5 py-3 text-sm font-medium text-white hover:bg-stone-800 shadow-lg shadow-stone-900/10"
                >
                  <Search className="h-4 w-4" />
                  Browse the marketplace
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <a
                  href="#how"
                  className="inline-flex items-center gap-2 rounded-2xl border border-stone-300 bg-white/70 px-5 py-3 text-sm font-medium text-stone-800 hover:bg-white"
                >
                  How escrow works
                </a>
              </motion.div>

              <motion.div variants={fadeUp} className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-stone-600">
                <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-600" /> No card to browse</div>
                <div className="flex items-center gap-2"><BadgeCheck className="h-4 w-4 text-amber-600" /> Demo logins available</div>
                <div className="flex items-center gap-2"><Wallet className="h-4 w-4 text-rose-600" /> Sign in only when you act</div>
              </motion.div>
            </div>

            <motion.div variants={fadeUp} className="lg:col-span-6">
              <HeroMockup />
            </motion.div>
          </motion.div>
        </motion.div>
      </section>

      <section id="categories" className="border-y border-stone-200/60 bg-white/60 py-10">
        <div className="container mx-auto px-4">
          <div className="flex items-end justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-stone-900">Pick a corner of the bazaar</h2>
              <p className="text-stone-600">Categories people in your area trade most.</p>
            </div>
            <Link to="/browse" className="hidden md:inline-flex items-center gap-1 text-sm text-stone-700 hover:text-stone-900">
              See all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            variants={stagger}
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3"
          >
            {CATEGORIES.map((c) => (
              <motion.div key={c.key} variants={fadeUp}>
                <Link
                  to={`/browse?category=${c.key}`}
                  className="group flex flex-col items-center justify-center gap-2 rounded-2xl border border-stone-200 bg-white px-4 py-6 hover:border-stone-300 hover:shadow-md transition-all"
                >
                  <div className="text-3xl">{c.emoji}</div>
                  <div className="text-sm font-medium text-stone-800">{c.label}</div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16">
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-stone-900">Just listed</h2>
            <p className="text-stone-600">Fresh items from your community — tap a card for the full story.</p>
          </div>
          <Link to="/browse" className="text-sm text-stone-700 hover:text-stone-900 inline-flex items-center gap-1">
            See all listings <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        {featured.length === 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-2xl bg-stone-200/60 animate-pulse" />
            ))}
          </div>
        ) : (
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            variants={stagger}
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
          >
            {featured.map((l, i) => (
              <motion.div key={l.id} variants={fadeUp}>
                <ListingCard listing={l} index={i} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </section>

      <section id="how" className="bg-stone-900 text-stone-100 py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-stone-700 bg-stone-800/60 px-3 py-1 text-xs">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              How TrustBazaar works
            </div>
            <h2 className="mt-4 text-3xl md:text-4xl font-bold tracking-tight">
              Three steps. Money in the middle. Trust Score on top.
            </h2>
            <p className="mt-3 text-stone-400">No chasing, no chargebacks, no strangers. The platform holds the payment until both sides are happy.</p>
          </div>
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            variants={stagger}
            className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            {[
              { icon: Search, title: "1. Discover", body: "Browse listings, filter by category, sort by Trust Score. No sign-in needed to look around." },
              { icon: HandHeart, title: "2. Pay into escrow", body: "When you buy or rent, your money is held by TrustBazaar — not sent to the seller." },
              { icon: BadgeCheck, title: "3. Confirm or dispute", body: "Inspect the item. Happy? Tap to release. Something's off? Open a dispute — we mediate." },
            ].map((s, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                className="rounded-2xl border border-stone-800 bg-stone-900/60 p-6 hover:border-stone-700 transition-colors"
              >
                <div className="h-10 w-10 rounded-xl bg-stone-800 flex items-center justify-center">
                  <s.icon className="h-5 w-5 text-amber-400" />
                </div>
                <div className="mt-4 text-lg font-semibold">{s.title}</div>
                <p className="mt-2 text-sm text-stone-400 leading-relaxed">{s.body}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section id="trust" className="container mx-auto px-4 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-stone-300/60 bg-stone-100 px-3 py-1 text-xs text-stone-700">
              <Sparkles className="h-3.5 w-3.5 text-amber-600" />
              Trust Score
            </div>
            <h2 className="mt-4 text-3xl md:text-4xl font-bold tracking-tight text-stone-900">
              A reputation you carry with you.
            </h2>
            <p className="mt-3 text-stone-600 max-w-lg">
              Every member starts at 0. Completed sales, on-time rentals, and resolved disputes all move the number. Visible on every profile, every listing.
            </p>
            <div className="mt-6 space-y-3">
              {[
                { score: 95, name: "Anika H.", role: "Seller · 142 deals" },
                { score: 78, name: "Riyad M.", role: "Buyer & renter · 38 deals" },
                { score: 52, name: "Sabbir K.", role: "New seller · 6 deals" },
              ].map((row) => (
                <div key={row.name} className="flex items-center justify-between rounded-2xl border border-stone-200 bg-white px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-amber-400 to-rose-500 flex items-center justify-center text-white font-semibold text-sm">
                      {row.name[0]}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-stone-900">{row.name}</div>
                      <div className="text-xs text-stone-500">{row.role}</div>
                    </div>
                  </div>
                  <div className="rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 px-3 py-2 text-white shadow-lg text-center">
                    <div className="text-xs font-bold leading-tight">Never get cheated</div>
                    <div className="text-[10px] opacity-90 leading-tight mt-0.5">3-day money-back guarantee</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: Shield, title: "Escrow on every deal", body: "Funds released only when the buyer confirms." },
              { icon: RefreshCw, title: "Rent with confidence", body: "Security deposit held, refunded on safe return." },
              { icon: Calendar, title: "Built-in satisfaction window", body: "3 days to inspect before money moves." },
              { icon: BadgeCheck, title: "Dispute resolution", body: "Real humans review, not algorithms alone." },
            ].map((b, i) => (
              <motion.div
                key={b.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="rounded-2xl border border-stone-200 bg-white p-5"
              >
                <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center">
                  <b.icon className="h-5 w-5 text-amber-700" />
                </div>
                <div className="mt-3 font-semibold text-stone-900">{b.title}</div>
                <p className="mt-1 text-sm text-stone-600 leading-relaxed">{b.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 pb-20">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 p-10 md:p-14 text-white">
          <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-stone-900/10 blur-3xl" />
          <div className="relative grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Ready to start trading?</h2>
              <p className="mt-3 text-white/90 max-w-md">Browse the marketplace, then sign in when you find something you love — or list your own in under a minute.</p>
            </div>
            <div className="flex flex-wrap gap-3 md:justify-end">
              <Link to="/browse" className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-stone-900 hover:bg-stone-100">Browse listings</Link>
              {!token && (
                <Link to="/signup" className="rounded-2xl border border-white/30 bg-white/10 px-5 py-3 text-sm font-semibold text-white hover:bg-white/20">
                  Create free account
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-stone-200/60 bg-[#fbf7f2] py-8">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-3 text-sm text-stone-600">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-amber-500 to-rose-500 flex items-center justify-center">
              <Shield className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-stone-900">TrustBazaar</span>
            <span>· Buy. Sell. Exchange. Rent. Trust.</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/browse" className="hover:text-stone-900">Browse</Link>
            <a href="#how" className="hover:text-stone-900">How it works</a>
            <Link to="/login" className="hover:text-stone-900">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function HeroMockup() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, rotate: 1 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] as any }}
      className="relative mx-auto max-w-lg"
    >
      <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-br from-amber-200 via-rose-200 to-emerald-200 blur-2xl opacity-70" />

      <div className="relative rounded-3xl border border-stone-800 bg-gradient-to-br from-stone-900 via-stone-900 to-stone-950 p-10 md:p-12 text-white shadow-2xl shadow-stone-900/30 overflow-hidden">
        <div className="absolute -top-16 -right-16 h-64 w-64 rounded-full bg-violet-500/25 blur-3xl" />
        <div className="absolute -bottom-16 -left-16 h-64 w-64 rounded-full bg-amber-500/20 blur-3xl" />

        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-wider text-white/70">
            The TrustBazaar promise
          </div>

          <div className="mt-6 text-4xl md:text-5xl font-bold leading-[1.05] tracking-tight">
            Never get<br />cheated.
          </div>

          <div className="mt-5 h-px w-16 bg-gradient-to-r from-violet-400 to-transparent" />

          <p className="mt-5 text-xl md:text-2xl font-semibold text-white/95 leading-snug max-w-sm">
            3-day money-back guarantee on every product defect.
          </p>

          <p className="mt-4 text-sm text-white/50 max-w-sm leading-relaxed">
            Your payment stays in escrow until you confirm the item is exactly as promised — no defect, no dispute, no doubt.
          </p>
        </div>
      </div>
    </motion.div>
  );
}