import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ShoppingBag, Package, ArrowRight } from "lucide-react";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/EmptyState";
import { apiClient } from "../lib/client";
import { fmtMoney, fmtRelative } from "../lib/utils";

const STATUS_VARIANT: Record<string, "default" | "info" | "success" | "warning" | "danger" | "violet"> = {
  paid: "info", shipped: "info", completed: "success",
  disputed: "danger", cancelled: "default",
};

export function Orders() {
  const { data, isLoading } = useQuery({ queryKey: ["orders"], queryFn: () => apiClient.listOrders() });
  const orders = data?.data || [];

  const buying = orders.filter((o) => o.status !== "completed" && o.status !== "cancelled");
  const history = orders.filter((o) => o.status === "completed" || o.status === "cancelled");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-stone-900">Orders</h1>
        <p className="mt-1 text-stone-500">Track every escrow lifecycle in one place.</p>
      </div>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500 mb-3">Active</h2>
        {isLoading ? (
          <div className="grid gap-3">{[1, 2].map((i) => <div key={i} className="h-24 rounded-2xl skeleton" />)}</div>
        ) : buying.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title="No active orders"
            description="When you buy something, it'll show up here with live escrow status."
            action={<Link to="/browse" className="text-orange-600 hover:underline font-medium">Browse listings →</Link>}
          />
        ) : (
          <div className="grid gap-3">{buying.map((o, i) => <OrderRow key={o.id} order={o} index={i} />)}</div>
        )}
      </section>

      {history.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500 mb-3">History</h2>
          <div className="grid gap-3">{history.map((o, i) => <OrderRow key={o.id} order={o} index={i} />)}</div>
        </section>
      )}
    </div>
  );
}

function OrderRow({ order, index }: { order: any; index: number }) {
  const photo = order.listing?.photo_urls?.[0];
  return (
    <motion.div className="min-w-0" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}>
      <Link to={`/orders/${order.id}`} className="block">
        <Card className="hover:border-orange-300 transition-colors">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-xl bg-stone-100 overflow-hidden shrink-0">
              {photo && <img src={photo} className="h-full w-full object-cover" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="min-w-0 font-semibold truncate text-stone-900">{order.listing?.title || "Order"}</h3>
                <Badge variant={STATUS_VARIANT[order.status] || "default"} className="capitalize shrink-0">{order.status}</Badge>
              </div>
              <div className="mt-1 flex items-center gap-2 text-sm text-stone-500 flex-wrap">
                <span className="whitespace-nowrap">{fmtMoney(order.amount)}</span>
                <span className="hidden sm:inline">•</span>
                <span className="whitespace-nowrap">created {fmtRelative(order.paid_at || order.id)}</span>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-stone-400 shrink-0" />
          </div>
        </Card>
      </Link>
    </motion.div>
  );
}