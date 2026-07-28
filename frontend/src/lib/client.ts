import { useAuth } from "./auth";
import { api } from "./api";

export type Listing = {
  id: string;
  seller_id: string;
  seller?: User;
  title: string;
  description?: string | null;
  category: string;
  listing_type: "sale" | "rent";
  price: string;
  rent_per_day?: string | null;
  deposit_required?: string | null;
  deposit_rate?: string | null;
  commission_rate?: string;
  photo_urls: string[];
  status: "active" | "sold" | "rented" | "archived";
  location?: string | null;
  created_at: string;
  updated_at?: string;
};

export type User = {
  id: string;
  email: string;
  display_name: string;
  avatar_url?: string | null;
  city?: string | null;
  trust_score?: number | null;
  trust_tier?: string;
  joined_at?: string;
  is_admin?: boolean;
};

export type Order = {
  id: string;
  buyer_id: string;
  seller_id: string;
  listing_id: string;
  listing?: Listing;
  amount: string;
  commission: string;
  net_to_seller?: string | null;
  status: "paid" | "shipped" | "completed" | "disputed" | "cancelled";
  escrow: "held" | "released" | "refunded" | "partial";
  paid_at?: string | null;
  shipped_at?: string | null;
  release_at?: string | null;
  completed_at?: string | null;
  demo_fast_forward_seconds?: number;
};

export type Rental = {
  id: string;
  renter_id: string;
  owner_id: string;
  listing_id: string;
  listing?: Listing;
  start_date: string;
  end_date: string;
  rental_fee: string;
  deposit_rate: string;
  deposit_amount: string;
  commission: string;
  net_to_owner?: string | null;
  status: "paid" | "active" | "returned" | "disputed" | "refunded" | "completed";
  deposit_status: "held" | "refunded" | "partial" | "forfeited";
  paid_at?: string | null;
  returned_at?: string | null;
  deposit_release_at?: string | null;
};

export type Dispute = {
  id: string;
  order_id?: string | null;
  rental_id?: string | null;
  raised_by: string;
  reason: string;
  status: "open" | "under_review" | "resolved";
  resolution?: "refund" | "release" | "split" | null;
  split_buyer?: string | null;
  split_seller?: string | null;
  admin_notes?: string | null;
  created_at: string;
  resolved_at?: string | null;
};

export type CommissionConfig = {
  category: string;
  sale_rate: string | number;
  deposit_rate: string | number;
  updated_at?: string;
};

export type AdminUser = {
  id: string;
  email: string;
  display_name: string;
  phone?: string | null;
  trust_score: number | null;
  trust_tier?: string;
  is_admin: boolean;
  joined_at: string;
};

export type AdminListing = {
  id: string;
  seller_id: string;
  title: string;
  category: string;
  listing_type: "sale" | "rent";
  price: string;
  rent_per_day?: string | null;
  status: string;
  created_at: string;
  seller?: { display_name: string; email: string } | null;
};

export type WalletEntry = {
  id: string;
  user_id: string;
  type: "release" | "refund" | "debit" | "credit" | "commission";
  amount: string;
  reference?: string;
  created_at: string;
};

export type Wallet = {
  available: string;
  pending: string;
  ledger: WalletEntry[];
};

function tok() { return useAuth.getState().token; }

export const apiClient = {
  // Auth
  signup: (body: { email: string; password: string; display_name: string }) =>
    api<{ data: { access_token?: string; user: User } }>("/auth/signup", { method: "POST", body: JSON.stringify(body) }),
  login: (body: { email: string; password: string }) =>
    api<{ data: { access_token: string; user: User } }>("/auth/login", { method: "POST", body: JSON.stringify(body) }),
  requestOtp: (email: string) =>
    api<{ sent: true; debug_code?: string }>("/auth/otp/request", { method: "POST", body: JSON.stringify({ email }) }),
  verifyOtp: (body: { email: string; code: string }) =>
    api<{ data: { access_token: string; user: User } }>("/auth/otp/verify", { method: "POST", body: JSON.stringify(body) }),
  me: () => api<{ data: User }>("/auth/me", { token: tok() }),

  // Listings
  listListings: (q?: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    Object.entries(q || {}).forEach(([k, v]) => v && params.set(k, v));
    return api<{ data: Listing[] }>(`/listings?${params.toString()}`);
  },
  getListing: (id: string) => api<{ data: Listing }>(`/listings/${id}`),
  myListings: () => api<{ data: Listing[] }>("/listings/mine", { token: tok() }),
  createListing: (body: Partial<Listing>) =>
    api<{ data: Listing }>("/listings", { method: "POST", body: JSON.stringify(body), token: tok() }),
  updateListing: (id: string, body: Partial<Listing>) =>
    api<{ data: Listing }>(`/listings/${id}`, { method: "PATCH", body: JSON.stringify(body), token: tok() }),
  deleteListing: (id: string) =>
    api<{ ok: true }>(`/listings/${id}`, { method: "DELETE", token: tok() }),

  // Orders
  createOrder: (listing_id: string) =>
    api<{ data: Order }>("/orders", { method: "POST", body: JSON.stringify({ listing_id }), token: tok() }),
  listOrders: () => api<{ data: Order[] }>("/orders", { token: tok() }),
  getOrder: (id: string) => api<{ data: Order }>(`/orders/${id}`, { token: tok() }),
  shipOrder: (id: string, body?: { shipping_carrier?: string; tracking_number?: string }) =>
    api<{ data: Order }>(`/orders/${id}/ship`, { method: "POST", body: JSON.stringify(body || {}), token: tok() }),
  confirmOrder: (id: string) =>
    api<{ data: Order }>(`/orders/${id}/confirm`, { method: "POST", token: tok() }),
  disputeOrder: (id: string, body: { reason: string }) =>
    api<{ data: Dispute }>(`/orders/${id}/dispute`, { method: "POST", body: JSON.stringify(body), token: tok() }),
  fastForward: (id: string) =>
    api<{ data: Order }>(`/orders/${id}/fast-forward`, { method: "POST", token: tok() }),

  // Rentals
  createRental: (body: { listing_id: string; start_date: string; end_date: string }) =>
    api<{ data: Rental }>("/rentals", { method: "POST", body: JSON.stringify(body), token: tok() }),
  listRentals: () => api<{ data: Rental[] }>("/rentals", { token: tok() }),
  getRental: (id: string) => api<{ data: Rental }>(`/rentals/${id}`, { token: tok() }),
  returnRental: (id: string, condition_notes: string) =>
    api<{ data: Rental }>(`/rentals/${id}/return`, { method: "POST", body: JSON.stringify({ condition_notes }), token: tok() }),
  confirmReturn: (id: string, body?: { deposit_action?: "refund" | "partial" | "claim"; partial_amount?: string; notes?: string }) =>
    api<{ data: Rental }>(`/rentals/${id}/confirm-return`, { method: "POST", body: JSON.stringify(body || {}), token: tok() }),
  claimDeposit: (id: string, body: { amount: string; reason: string }) =>
    api<{ data: Rental }>(`/rentals/${id}/claim`, { method: "POST", body: JSON.stringify(body), token: tok() }),
  fastForwardRental: (id: string) =>
    api<{ data: Rental }>(`/rentals/${id}/fast-forward`, { method: "POST", token: tok() }),

  // Disputes
  listDisputes: () => api<{ data: Dispute[] }>("/disputes", { token: tok() }),
  getDispute: (id: string) => api<{ data: Dispute }>(`/disputes/${id}`, { token: tok() }),

  // Trust Score
  myTrust: () => api<{ data: { score: number | null; tier: string; breakdown: Record<string, unknown> } }>("/trust-score/me", { token: tok() }),
  userTrust: (id: string) => api<{ data: { score: number | null; tier: string; breakdown: Record<string, unknown> } }>(`/trust-score/${id}`),

  // Wallet
  wallet: () => api<{ data: Wallet }>("/wallet", { token: tok() }),
  requestPayout: (amount: string) =>
    api<{ data: { payout_id: string; status: string } }>("/wallet/payout", { method: "POST", body: JSON.stringify({ amount }), token: tok() }),

  // Admin
  adminListDisputes: () => api<{ data: Dispute[] }>("/admin/disputes", { token: tok() }),
  adminResolveDispute: (id: string, body: { decision: "refund" | "release" | "split"; admin_notes?: string; split_buyer?: string; split_seller?: string }) =>
    api<{ data: Dispute }>(`/admin/disputes/${id}/resolve`, { method: "POST", body: JSON.stringify(body), token: tok() }),
  commissionConfig: () => api<{ data: CommissionConfig[] }>("/admin/commission", { token: tok() }),
  upsertCommission: (body: { category: string; sale_rate: number; deposit_rate: number }) =>
    api<{ data: CommissionConfig }>("/admin/commission", { method: "POST", body: JSON.stringify(body), token: tok() }),
  adminListUsers: () => api<{ data: AdminUser[] }>("/admin/users", { token: tok() }),
  adminListListings: () => api<{ data: AdminListing[] }>("/admin/listings", { token: tok() }),
  adminRemoveListing: (id: string) => api<{ ok: true }>(`/admin/listings/${id}`, { method: "DELETE", token: tok() }),

  // Upload
  uploadPhoto: async (file: File, kind: "listing" | "dispute" = "listing") => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", kind);
    const res = await fetch(`${import.meta.env.VITE_API_URL || "/api"}/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tok()}` },
      body: fd,
    });
    if (!res.ok) throw new Error("Upload failed");
    return res.json() as Promise<{ url: string }>;
  },
};