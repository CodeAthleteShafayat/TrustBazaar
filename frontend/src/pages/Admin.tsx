import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Scale, AlertCircle, Percent, Users as UsersIcon, LayoutGrid, Trash2, ShieldCheck, Search, Pencil, UserCog, ShoppingBag, Wallet } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Dialog } from "../components/ui/Dialog";
import { Textarea, Input, Select } from "../components/ui/Input";
import { EmptyState } from "../components/EmptyState";
import { apiClient } from "../lib/client";
import type { AdminUser, AdminListing } from "../lib/client";
import { fmtMoney, fmtRelative, fmtDate } from "../lib/utils";
import { useAuth } from "../lib/auth";

const LISTING_CATEGORIES = [
  "electronics", "fashion", "furniture", "books", "other",
  "premium_electronics", "smart_gadgets", "high_value_flagged",
];

const DISPUTE_STATUS_VARIANT: Record<string, "default" | "info" | "warning" | "success" | "danger"> = {
  open: "danger", under_review: "warning", resolved: "success",
};

const TABS = [
  { id: "disputes", label: "Disputes", icon: Scale },
  { id: "commission", label: "Commission", icon: Percent },
  { id: "users", label: "Users", icon: UsersIcon },
  { id: "listings", label: "Listings", icon: LayoutGrid },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function Admin() {
  const [tab, setTab] = useState<TabId>("disputes");
  const { data: stats } = useQuery({ queryKey: ["admin-stats"], queryFn: () => apiClient.adminStats() });

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-amber-500 to-rose-500 flex items-center justify-center shadow-md shadow-orange-500/30">
          <Scale className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-stone-900">Admin console</h1>
          <p className="text-stone-500">Disputes, commission rates, users, and listings — all live against the database.</p>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={UsersIcon} label="Users" value={stats?.data.users ?? "—"} />
        <StatCard icon={LayoutGrid} label="Active listings" value={stats?.data.active_listings ?? "—"} />
        <StatCard icon={AlertCircle} label="Open disputes" value={stats?.data.open_disputes ?? "—"} />
        <StatCard icon={Wallet} label="Completed GMV" value={stats ? fmtMoney(stats.data.gmv) : "—"} />
      </div>

      <div className="flex gap-1 rounded-xl border border-stone-200 bg-stone-50 p-1 w-fit overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition ${
              tab === t.id ? "bg-white shadow-sm text-stone-900 border border-stone-200" : "text-stone-500 hover:text-stone-700"
            }`}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "disputes" && <DisputesTab />}
      {tab === "commission" && <CommissionTab />}
      {tab === "users" && <UsersTab />}
      {tab === "listings" && <ListingsTab />}
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) {
  return (
    <Card className="p-3.5 sm:p-6">
      <div className="flex items-center gap-2.5 sm:gap-3">
        <div className="h-9 w-9 sm:h-10 sm:w-10 shrink-0 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-xl sm:text-2xl font-bold text-stone-900 leading-tight truncate">{value}</div>
          <div className="text-xs text-stone-500 leading-snug">{label}</div>
        </div>
      </div>
    </Card>
  );
}

function DisputesTab() {
  const queryClient = useQueryClient();
  const [active, setActive] = useState<any>(null);
  const [decision, setDecision] = useState<"refund" | "release" | "split">("refund");
  const [splitBuyer, setSplitBuyer] = useState("");
  const [splitSeller, setSplitSeller] = useState("");
  const [notes, setNotes] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-disputes"],
    queryFn: () => apiClient.adminListDisputes(),
  });

  const resolve = useMutation({
    mutationFn: () => apiClient.adminResolveDispute(active.id, {
      decision,
      admin_notes: notes || undefined,
      split_buyer: decision === "split" ? splitBuyer : undefined,
      split_seller: decision === "split" ? splitSeller : undefined,
    }),
    onSuccess: () => {
      toast.success("Dispute resolved");
      setActive(null);
      setDecision("refund");
      setSplitBuyer("");
      setSplitSeller("");
      setNotes("");
      queryClient.invalidateQueries({ queryKey: ["admin-disputes"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const disputes = data?.data || [];
  const open = disputes.filter((d) => d.status === "open" || d.status === "under_review");
  const resolved = disputes.filter((d) => d.status === "resolved");

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500 mb-3">
          Open queue ({open.length})
        </h2>
        {isLoading ? (
          <div className="grid gap-3">{[1, 2].map((i) => <div key={i} className="h-24 rounded-2xl skeleton" />)}</div>
        ) : open.length === 0 ? (
          <EmptyState
            icon={AlertCircle}
            title="Clean queue"
            description="No open disputes. When buyers and sellers can't agree, they'll land here."
          />
        ) : (
          <div className="grid gap-3">
            {open.map((d, i) => (
              <motion.div key={d.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <Card className="hover:border-orange-300 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="h-10 w-10 shrink-0 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
                      <AlertCircle className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-stone-900">Dispute on {d.order_id ? "order" : "rental"} #{d.id.slice(0, 6)}</h3>
                        <Badge variant={DISPUTE_STATUS_VARIANT[d.status]} className="capitalize shrink-0">{d.status.replace("_", " ")}</Badge>
                      </div>
                      <div className="mt-1 text-sm text-stone-500">
                        opened {fmtRelative(d.created_at)}
                      </div>
                      <p className="mt-2 text-sm text-stone-700">{d.reason}</p>
                    </div>
                    <Button onClick={() => setActive(d)} className="shrink-0">Review</Button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {resolved.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500 mb-3">Resolved</h2>
          <div className="grid gap-3">
            {resolved.map((d) => (
              <Card key={d.id} className="opacity-70">
                <div className="flex items-center gap-3 flex-wrap">
                  <Badge variant={DISPUTE_STATUS_VARIANT[d.status]} className="capitalize shrink-0">{d.resolution}</Badge>
                  <div className="text-sm text-stone-500 min-w-0 truncate">{d.reason}</div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      <Dialog open={!!active} onClose={() => setActive(null)} title="Resolve dispute" className="max-w-xl">
        {active && (
          <div className="space-y-4">
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm space-y-2">
              <div><span className="text-stone-500">Reason:</span> <span className="font-medium text-stone-900">{active.reason}</span></div>
            </div>
            <Select label="Decision" value={decision} onChange={(e) => setDecision(e.target.value as any)}>
              <option value="refund">Refund buyer in full</option>
              <option value="release">Release to seller in full</option>
              <option value="split">Split between both</option>
            </Select>
            {decision === "split" && (
              <div className="grid grid-cols-2 gap-3">
                <Input label="Amount to buyer (BDT)" type="number" value={splitBuyer} onChange={(e) => setSplitBuyer(e.target.value)} />
                <Input label="Amount to seller (BDT)" type="number" value={splitSeller} onChange={(e) => setSplitSeller(e.target.value)} />
              </div>
            )}
            <Textarea label="Admin notes (internal)" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setActive(null)} className="flex-1">Cancel</Button>
              <Button onClick={() => resolve.mutate()} loading={resolve.isPending} className="flex-1">
                Confirm resolution
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}

function CommissionTab() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Record<string, { sale_rate: string; deposit_rate: string }>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["admin-commission"],
    queryFn: () => apiClient.commissionConfig(),
  });

  const save = useMutation({
    mutationFn: (category: string) => {
      const row = editing[category];
      return apiClient.upsertCommission({
        category,
        sale_rate: Number(row.sale_rate) / 100,
        deposit_rate: Number(row.deposit_rate) / 100,
      });
    },
    onSuccess: (_res, category) => {
      toast.success(`${category.replace("_", " ")} rates updated`);
      queryClient.invalidateQueries({ queryKey: ["admin-commission"] });
      setEditing((prev) => { const next = { ...prev }; delete next[category]; return next; });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const rows = data?.data || [];

  return (
    <div className="space-y-3">
      <p className="text-sm text-stone-500">Sale commission and rental deposit rates, applied per listing category. Changes take effect on the next order/rental — existing ones are unaffected.</p>
      {isLoading ? (
        <div className="grid gap-2">{[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-xl skeleton" />)}</div>
      ) : (
        <div className="grid gap-2">
          {rows.map((r) => {
            const edit = editing[r.category];
            const saleRate = edit ? edit.sale_rate : String(Number(r.sale_rate) * 100);
            const depositRate = edit ? edit.deposit_rate : String(Number(r.deposit_rate) * 100);
            return (
              <Card key={r.category} className="p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="font-medium text-stone-900 capitalize min-w-0">{r.category.replace("_", " ")}</div>
                  <div className="flex items-center gap-3 shrink-0">
                    <label className="flex items-center gap-1.5 text-sm text-stone-500">
                      Sale
                      <input
                        type="number"
                        className="w-16 h-8 rounded-lg border border-stone-200 px-2 text-sm text-right"
                        value={saleRate}
                        onChange={(e) => setEditing((prev) => ({ ...prev, [r.category]: { sale_rate: e.target.value, deposit_rate: depositRate } }))}
                      />%
                    </label>
                    <label className="flex items-center gap-1.5 text-sm text-stone-500">
                      Deposit
                      <input
                        type="number"
                        className="w-16 h-8 rounded-lg border border-stone-200 px-2 text-sm text-right"
                        value={depositRate}
                        onChange={(e) => setEditing((prev) => ({ ...prev, [r.category]: { sale_rate: saleRate, deposit_rate: e.target.value } }))}
                      />%
                    </label>
                    {edit && (
                      <Button
                        size="sm"
                        onClick={() => save.mutate(r.category)}
                        loading={save.isPending && save.variables === r.category}
                      >
                        Save
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function UsersTab() {
  const queryClient = useQueryClient();
  const { user: me } = useAuth();
  const [query, setQuery] = useState("");
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => apiClient.adminListUsers(),
  });

  const save = useMutation({
    mutationFn: () => apiClient.adminUpdateUser(editUser!.id, {
      display_name: displayName,
      phone: phone || null,
      is_admin: isAdmin,
    }),
    onSuccess: () => {
      toast.success("User updated");
      setEditUser(null);
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  function openEdit(u: AdminUser) {
    setEditUser(u);
    setDisplayName(u.display_name || "");
    setPhone(u.phone || "");
    setIsAdmin(u.is_admin);
  }

  const users = (data?.data || []).filter((u) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return u.display_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or email..."
          className="w-full h-10 rounded-xl border border-stone-200 bg-white pl-10 pr-4 text-sm placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
        />
      </div>

      {isLoading ? (
        <div className="grid gap-2">{[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-xl skeleton" />)}</div>
      ) : users.length === 0 ? (
        <EmptyState icon={UsersIcon} title="No users found" description="Try a different search." />
      ) : (
        <div className="grid gap-2">
          {users.map((u) => (
            <Card key={u.id} className="p-4 hover:border-orange-300 transition-colors cursor-pointer" onClick={() => openEdit(u)}>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 shrink-0 rounded-full bg-gradient-to-br from-amber-500 to-rose-500 flex items-center justify-center text-sm font-bold text-white">
                  {u.display_name?.[0]?.toUpperCase() || "U"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 font-medium text-stone-900 truncate">{u.display_name}</span>
                    {u.is_admin && <Badge variant="violet" className="shrink-0"><ShieldCheck className="h-3 w-3" /> Admin</Badge>}
                  </div>
                  <div className="text-sm text-stone-500 truncate">{u.email}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-bold text-stone-900">{u.trust_score ?? "—"}</div>
                  <div className="text-xs text-stone-500">{u.trust_tier || "Unrated"}</div>
                </div>
                <Pencil className="h-4 w-4 text-stone-400 shrink-0" />
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!editUser} onClose={() => setEditUser(null)} title="Edit user" className="max-w-md">
        {editUser && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-stone-500">
              <UserCog className="h-4 w-4" /> {editUser.email}
            </div>
            <Input label="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+8801..." />
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 text-sm text-stone-500">
              Trust score ({editUser.trust_score ?? "—"}, {editUser.trust_tier || "Unrated"}) is computed automatically from completed transactions and isn't editable here — any manual value would be overwritten the next time this profile is viewed.
            </div>
            <label className="flex items-center justify-between rounded-xl border border-stone-200 p-3">
              <span className="text-sm font-medium text-stone-700">Admin access</span>
              <input
                type="checkbox"
                checked={isAdmin}
                disabled={editUser.id === me?.id}
                onChange={(e) => setIsAdmin(e.target.checked)}
                className="h-5 w-5 accent-orange-600"
              />
            </label>
            {editUser.id === me?.id && (
              <p className="text-xs text-stone-500">You can't remove your own admin access from here.</p>
            )}
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setEditUser(null)} className="flex-1">Cancel</Button>
              <Button onClick={() => save.mutate()} loading={save.isPending} className="flex-1">Save changes</Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}

const LISTING_STATUS_VARIANT: Record<string, "default" | "info" | "success" | "warning" | "danger" | "violet"> = {
  active: "success", sold: "info", rented: "violet", archived: "default",
};

function ListingsTab() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editListing, setEditListing] = useState<AdminListing | null>(null);
  const [form, setForm] = useState<any>({});

  const { data, isLoading } = useQuery({
    queryKey: ["admin-listings"],
    queryFn: () => apiClient.adminListListings(),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiClient.adminRemoveListing(id),
    onSuccess: () => {
      toast.success("Listing archived");
      queryClient.invalidateQueries({ queryKey: ["admin-listings"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const save = useMutation({
    mutationFn: () => apiClient.adminUpdateListing(editListing!.id, {
      title: form.title,
      description: form.description,
      category: form.category,
      price: form.price,
      rent_per_day: editListing!.listing_type === "rent" ? form.rent_per_day : undefined,
      status: form.status,
      location: form.location,
    }),
    onSuccess: () => {
      toast.success("Listing updated");
      setEditListing(null);
      queryClient.invalidateQueries({ queryKey: ["admin-listings"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  function openEdit(l: AdminListing) {
    setEditListing(l);
    setForm({
      title: l.title,
      description: l.description || "",
      category: l.category,
      price: l.price,
      rent_per_day: l.rent_per_day || "",
      status: l.status,
      location: l.location || "",
    });
  }

  const listings = (data?.data || []).filter((l) => {
    if (statusFilter !== "all" && l.status !== statusFilter) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return l.title?.toLowerCase().includes(q) || l.seller?.display_name?.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title or seller..."
            className="w-full h-10 rounded-xl border border-stone-200 bg-white pl-10 pr-4 text-sm placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 rounded-xl border border-stone-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="sold">Sold</option>
          <option value="rented">Rented</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {isLoading ? (
        <div className="grid gap-2">{[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-xl skeleton" />)}</div>
      ) : listings.length === 0 ? (
        <EmptyState icon={LayoutGrid} title="No listings found" description="Try a different search or filter." />
      ) : (
        <div className="grid gap-2">
          {listings.map((l) => (
            <Card key={l.id} className="p-4 hover:border-orange-300 transition-colors">
              <div className="flex items-center gap-3">
                <button className="flex-1 min-w-0 text-left" onClick={() => openEdit(l)}>
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 font-medium text-stone-900 truncate">{l.title}</span>
                    <Badge variant={LISTING_STATUS_VARIANT[l.status] || "default"} className="capitalize shrink-0">{l.status}</Badge>
                  </div>
                  <div className="text-sm text-stone-500 truncate">
                    {l.seller?.display_name || "Unknown seller"} · {fmtDate(l.created_at)} · {fmtMoney(l.price)}
                    {l.listing_type === "rent" && l.rent_per_day ? ` · ${fmtMoney(l.rent_per_day)}/day` : ""}
                  </div>
                </button>
                <button onClick={() => openEdit(l)} className="shrink-0 rounded-lg p-2 text-stone-500 hover:bg-stone-100 hover:text-stone-900 transition" title="Edit">
                  <Pencil className="h-4 w-4" />
                </button>
                {l.status !== "archived" && (
                  <button
                    onClick={() => remove.mutate(l.id)}
                    disabled={remove.isPending}
                    className="shrink-0 rounded-lg p-2 text-stone-500 hover:bg-rose-50 hover:text-rose-600 transition"
                    title="Archive listing"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!editListing} onClose={() => setEditListing(null)} title="Edit listing" className="max-w-xl">
        {editListing && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-stone-500">
              <ShoppingBag className="h-4 w-4" /> Seller: {editListing.seller?.display_name || "Unknown"} ({editListing.seller?.email})
            </div>
            <Input label="Title" value={form.title} onChange={(e) => setForm((f: any) => ({ ...f, title: e.target.value }))} />
            <Textarea label="Description" value={form.description} onChange={(e) => setForm((f: any) => ({ ...f, description: e.target.value }))} rows={3} />
            <div className="grid grid-cols-2 gap-3">
              <Select label="Category" value={form.category} onChange={(e) => setForm((f: any) => ({ ...f, category: e.target.value }))}>
                {LISTING_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c.replace("_", " ")}</option>
                ))}
              </Select>
              <Select label="Status" value={form.status} onChange={(e) => setForm((f: any) => ({ ...f, status: e.target.value }))}>
                <option value="active">Active</option>
                <option value="sold">Sold</option>
                <option value="rented">Rented</option>
                <option value="archived">Archived</option>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Price (BDT)" type="number" value={form.price} onChange={(e) => setForm((f: any) => ({ ...f, price: e.target.value }))} />
              {editListing.listing_type === "rent" && (
                <Input label="Daily rate (BDT)" type="number" value={form.rent_per_day} onChange={(e) => setForm((f: any) => ({ ...f, rent_per_day: e.target.value }))} />
              )}
            </div>
            <Input label="Location" value={form.location} onChange={(e) => setForm((f: any) => ({ ...f, location: e.target.value }))} />
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setEditListing(null)} className="flex-1">Cancel</Button>
              <Button onClick={() => save.mutate()} loading={save.isPending} className="flex-1">Save changes</Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
