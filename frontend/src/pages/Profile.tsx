import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Calendar, Shield } from "lucide-react";
import { Card } from "../components/ui/Card";
import { ListingCard } from "../components/ListingCard";
import { EmptyState } from "../components/EmptyState";
import { apiClient } from "../lib/client";
import { fmtDate } from "../lib/utils";

export function Profile() {
  const { userId } = useParams();
  const isMe = !userId;
  const target = userId || "me";

  const { data: meData } = useQuery({
    queryKey: ["me"],
    queryFn: () => apiClient.me(),
    enabled: isMe,
  });

  const { data: trustData, isLoading } = useQuery({
    queryKey: ["profile", target],
    queryFn: () => (isMe ? apiClient.myTrust() : apiClient.userTrust(userId!)),
    enabled: isMe ? true : !!userId,
  });

  const { data: listingsData } = useQuery({
    queryKey: ["user-listings", userId],
    queryFn: () => apiClient.listListings({ seller_id: userId }),
    enabled: !!userId,
  });

  if (isLoading || !trustData) {
    return (
      <div className="space-y-4">
        <div className="h-32 rounded-2xl skeleton" />
        <div className="h-64 rounded-2xl skeleton" />
      </div>
    );
  }

  const trust = trustData.data;
  const me = meData?.data;
  const profile: Record<string, any> = isMe
    ? {
        display_name: me?.display_name || "You",
        email: me?.email,
        joined_at: me?.joined_at,
        trust_score: trust.score ?? me?.trust_score ?? 0,
        trust_tier: trust.tier,
      }
    : {
        display_name: userId?.slice(0, 8),
        trust_score: trust.score ?? 0,
        trust_tier: trust.tier,
      };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 h-40 w-40 rounded-full bg-amber-300/30 blur-3xl" />
          <div className="relative flex flex-col md:flex-row items-start gap-6">
            <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 flex items-center justify-center text-3xl font-bold text-white shadow-xl shadow-orange-500/30">
              {profile.display_name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold tracking-tight text-stone-900">{profile.display_name}</h1>
              {profile.email && <div className="mt-1 text-stone-500">{profile.email}</div>}
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-stone-500">
                {profile.joined_at && (
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" /> Joined {fmtDate(profile.joined_at)}
                  </span>
                )}
                {profile.trust_tier && <span className="inline-flex items-center gap-1"><Shield className="h-3.5 w-3.5" /> {profile.trust_tier}</span>}
              </div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-3 text-white shadow-lg text-center">
                <div className="text-sm font-bold leading-tight">Never get cheated</div>
                <div className="text-xs opacity-90 leading-tight mt-1">3-day money-back guarantee</div>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {trust.breakdown && Object.keys(trust.breakdown as object).length > 0 && (
        <Card>
          <h3 className="font-semibold mb-4 text-stone-900">Score breakdown</h3>
          <pre className="text-xs text-stone-600 whitespace-pre-wrap rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
            {JSON.stringify(trust.breakdown, null, 2)}
          </pre>
        </Card>
      )}

      {!isMe && listingsData && (
        <section>
          <h2 className="text-xl font-semibold mb-3 text-stone-900">Listings by {profile.display_name}</h2>
          {listingsData.data.length === 0 ? (
            <EmptyState
              icon={Shield}
              title="No active listings"
              description="When this seller lists something, it'll show up here."
            />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {listingsData.data.map((l, i) => (
                <ListingCard key={l.id} listing={l} index={i} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}