import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { LayoutGrid, Plus, ShoppingBag, Package, Wallet as WalletIcon, Shield, Pencil, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/EmptyState";
import { apiClient } from "../lib/client";
import { fmtMoney } from "../lib/utils";
import { useAuth } from "../lib/auth";

const LISTING_STATUS_VARIANT: Record<string, "default" | "info" | "success" | "warning" | "danger" | "violet"> = {
  active: "success", sold: "info", rented: "violet", draft: "warning", removed: "default",
};

export function Dashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: listingsData, isLoading: listingsLoading } = useQuery({
    queryKey: ["my-listings"],
    queryFn: () => apiClient.myListings(),
  });
  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: () => apiClient.listOrders(),
  });
  const { data: rentalsData, isLoading: rentalsLoading } = useQuery({
    queryKey: ["rentals"],
    queryFn: () => apiClient.listRentals(),
  });
  const { data: walletData } = useQuery({
    queryKey: ["wallet"],
    queryFn: () => apiClient.wallet(),
  });
  const { data: trustData } = useQuery({
    queryKey: ["my-trust"],
    queryFn: () => apiClient.myTrust(),
  });

  const removeListing = useMutation({
    mutationFn: (id: string) => apiClient.deleteListing(id),
    onSuccess: () => {
      toast.success("Listing removed");
      queryClient.invalidateQueries({ queryKey: ["my-listings"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const listings = listingsData?.data || [];
  const orders = ordersData?.data || [];
  const rentals = rentalsData?.data || [];
  const activeListings = listings.filter((l) => l.status === "active").length;
  const openOrders = orders.filter((o) => o.status !== "completed" && o.status !== "cancelled").length;
  const openRentals = rentals.filter((r) => ["paid", "returned"].includes(r.status)).length;

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-amber-500 to-rose-500 flex items-center justify-center shadow-md shadow-orange-500/30">
            <LayoutGrid className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-stone-900">
              Welcome back{user?.display_name ? `, ${user.display_name.split(" ")[0]}` : ""}
            </h1>
            <p className="text-stone-500">Everything you're buying, selling, and renting.</p>
          </div>
        </div>
        <Link to="/create">
          <Button><Plus className="h-4 w-4" /> List an item</Button>
        </Link>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={LayoutGrid} label="Active listings" value={activeListings} to="#listings" />
        <StatCard icon={ShoppingBag} label="Open orders" value={openOrders} to="/orders" />
        <StatCard icon={Package} label="Active rentals" value={openRentals} to="/rentals" />
        <StatCard
          icon={Shield}
          label="Trust score"
          value={trustData?.data.score ?? "—"}
          sub={trustData?.data.tier}
          to="/profile"
        />
      </div>

      {walletData && (
        <Card className="flex items-center justify-between flex-wrap gap-4 bg-gradient-to-br from-orange-50 to-amber-50 border-orange-100">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center shadow-sm">
              <WalletIcon className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <div className="text-sm text-stone-500">Wallet balance</div>
              <div className="text-xl font-bold text-stone-900">{fmtMoney(walletData.data.available)}</div>
            </div>
          </div>
          <div className="text-sm text-stone-500">
            Pending: <span className="font-medium text-stone-800">{fmtMoney(walletData.data.pending)}</span>
          </div>
          <Link to="/wallet"><Button variant="ghost">View wallet →</Button></Link>
        </Card>
      )}

      <section id="listings">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500">My listings</h2>
          <Link to="/create" className="text-sm font-medium text-orange-600 hover:underline">+ New listing</Link>
        </div>
        {listingsLoading ? (
          <div className="grid gap-3">{[1, 2].map((i) => <div key={i} className="h-20 rounded-2xl skeleton" />)}</div>
        ) : listings.length === 0 ? (
          <EmptyState
            icon={LayoutGrid}
            title="No listings yet"
            description="List something to sell or rent out — it'll show up here."
            action={<Link to="/create" className="text-orange-600 hover:underline font-medium">List an item →</Link>}
          />
        ) : (
          <div className="grid gap-3">
            {listings.map((l, i) => (
              <motion.div key={l.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <Card className="hover:border-orange-300 transition-colors">
                  <div className="flex items-center gap-4">
                    <Link to={`/listing/${l.id}`} className="h-16 w-16 rounded-xl bg-stone-100 overflow-hidden shrink-0">
                      {l.photo_urls?.[0] && <img src={l.photo_urls[0]} className="h-full w-full object-cover" />}
                    </Link>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Link to={`/listing/${l.id}`} className="font-semibold truncate text-stone-900 hover:text-orange-600">{l.title}</Link>
                        <Badge variant={LISTING_STATUS_VARIANT[l.status] || "default"} className="capitalize">{l.status}</Badge>
                      </div>
                      <div className="mt-1 text-sm text-stone-500">
                        {fmtMoney(l.price)}{l.listing_type === "rent" && l.rent_per_day ? ` · ${fmtMoney(l.rent_per_day)}/day` : ""}
                      </div>
                    </div>
                    <Link to={`/create?edit=${l.id}`} className="rounded-lg p-2 text-stone-500 hover:bg-stone-100 hover:text-stone-900 transition" title="Edit">
                      <Pencil className="h-4 w-4" />
                    </Link>
                    <button
                      onClick={() => removeListing.mutate(l.id)}
                      disabled={removeListing.isPending}
                      className="rounded-lg p-2 text-stone-500 hover:bg-rose-50 hover:text-rose-600 transition"
                      title="Remove listing"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500">Recent orders</h2>
          <Link to="/orders" className="text-sm font-medium text-orange-600 hover:underline">View all →</Link>
        </div>
        {ordersLoading ? (
          <div className="h-16 rounded-2xl skeleton" />
        ) : orders.length === 0 ? (
          <EmptyState icon={ShoppingBag} title="No orders yet" description="Buy something from Browse and it'll show up here." className="py-10" />
        ) : (
          <div className="grid gap-3">
            {orders.slice(0, 3).map((o) => (
              <Link key={o.id} to={`/orders/${o.id}`}>
                <Card className="hover:border-orange-300 transition-colors flex items-center justify-between">
                  <span className="font-medium text-stone-900 truncate">{o.listing?.title || "Order"}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-stone-500">{fmtMoney(o.amount)}</span>
                    <Badge variant="info" className="capitalize">{o.status}</Badge>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500">Recent rentals</h2>
          <Link to="/rentals" className="text-sm font-medium text-orange-600 hover:underline">View all →</Link>
        </div>
        {rentalsLoading ? (
          <div className="h-16 rounded-2xl skeleton" />
        ) : rentals.length === 0 ? (
          <EmptyState icon={Package} title="No rentals yet" description="Reserve a rental from Browse and it'll show up here." className="py-10" />
        ) : (
          <div className="grid gap-3">
            {rentals.slice(0, 3).map((r) => (
              <Link key={r.id} to={`/rentals/${r.id}`}>
                <Card className="hover:border-orange-300 transition-colors flex items-center justify-between">
                  <span className="font-medium text-stone-900 truncate">{r.listing?.title || "Rental"}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-stone-500">{fmtMoney(r.rental_fee)}</span>
                    <Badge variant="violet" className="capitalize">{r.status}</Badge>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, to }: { icon: any; label: string; value: string | number; sub?: string; to: string }) {
  return (
    <Link to={to}>
      <Card className="hover:border-orange-300 transition-colors">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-2xl font-bold text-stone-900 leading-tight">{value}</div>
            <div className="text-xs text-stone-500 truncate">{label}{sub ? ` · ${sub}` : ""}</div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
