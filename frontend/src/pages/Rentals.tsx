import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Calendar, Package } from "lucide-react";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/EmptyState";
import { apiClient } from "../lib/client";
import { fmtMoney, fmtDate } from "../lib/utils";

const STATUS_VARIANT: Record<string, "default" | "info" | "success" | "warning" | "danger" | "violet"> = {
  paid: "info", active: "violet", returned: "warning", completed: "success",
  disputed: "danger", refunded: "default",
};

// Rental statuses per the state machine (paid -> active -> returned -> refunded/completed,
// with disputed reachable from active/returned). Only refunded/completed are terminal.
const TERMINAL_STATUSES = ["refunded", "completed"];

export function Rentals() {
  const { data, isLoading } = useQuery({ queryKey: ["rentals"], queryFn: () => apiClient.listRentals() });
  const rentals = data?.data || [];

  const active = rentals.filter((r) => !TERMINAL_STATUSES.includes(r.status));
  const past = rentals.filter((r) => TERMINAL_STATUSES.includes(r.status));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-stone-900">Rentals</h1>
        <p className="mt-1 text-stone-500">Active bookings and history.</p>
      </div>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500 mb-3">Active</h2>
        {isLoading ? (
          <div className="grid gap-3">{[1, 2].map((i) => <div key={i} className="h-24 rounded-2xl skeleton" />)}</div>
        ) : active.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No active rentals"
            description="Browse listings and tap 'Reserve' on anything marked 'For rent'."
            action={<Link to="/browse" className="text-orange-600 hover:underline font-medium">Browse listings →</Link>}
          />
        ) : (
          <div className="grid gap-3">{active.map((r, i) => <Row key={r.id} rental={r} index={i} />)}</div>
        )}
      </section>

      {past.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500 mb-3">History</h2>
          <div className="grid gap-3">{past.map((r, i) => <Row key={r.id} rental={r} index={i} />)}</div>
        </section>
      )}
    </div>
  );
}

function Row({ rental, index }: { rental: any; index: number }) {
  const photo = rental.listing?.photo_urls?.[0];
  return (
    <motion.div className="min-w-0" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}>
      <Link to={`/rentals/${rental.id}`} className="block">
        <Card className="hover:border-orange-300 transition-colors">
          <div className="flex gap-4">
            <div className="h-16 w-16 rounded-xl bg-stone-100 overflow-hidden shrink-0">
              {photo && <img src={photo} className="h-full w-full object-cover" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="min-w-0 font-semibold truncate text-stone-900">{rental.listing?.title || "Rental"}</h3>
                <Badge variant={STATUS_VARIANT[rental.status] || "default"} className="capitalize shrink-0">{rental.status}</Badge>
              </div>
              <div className="mt-1 inline-flex items-center gap-1 text-sm text-stone-500">
                <Calendar className="h-3.5 w-3.5 shrink-0" /> {fmtDate(rental.start_date)} → {fmtDate(rental.end_date)}
              </div>
              <div className="mt-2 flex items-end justify-between gap-2">
                <span className="text-sm text-stone-500">Deposit {fmtMoney(rental.deposit_amount)}</span>
                <div className="text-right shrink-0">
                  <div className="font-bold text-stone-900">{fmtMoney(rental.rental_fee)}</div>
                  <div className="text-xs text-stone-500">{rental.deposit_status}</div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </Link>
    </motion.div>
  );
}