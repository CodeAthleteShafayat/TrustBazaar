import { useNavigate, useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, ShieldCheck, Lock } from "lucide-react";
import toast from "react-hot-toast";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { apiClient } from "../lib/client";
import { fmtMoney } from "../lib/utils";

export function Checkout() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["listing", id],
    queryFn: () => apiClient.getListing(id!),
  });

  const payMutation = useMutation({
    mutationFn: () => apiClient.createOrder(id!),
    onSuccess: (res) => {
      toast.success("Payment successful. Money is in escrow.");
      queryClient.invalidateQueries({ queryKey: ["listings"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      navigate(`/orders/${res.data.id}`, { replace: true });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading || !data) {
    return <div className="max-w-2xl mx-auto aspect-video rounded-2xl skeleton" />;
  }

  const listing = data.data;
  const photo = listing.photo_urls?.[0] ||
    "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=800";
  const price = Number(listing.price);
  const commissionRate = Number(listing.commission_rate || 0);
  const commission = price * commissionRate;
  const sellerPayout = price - commission;

  if (listing.status !== "active") {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="text-center py-12">
          <h2 className="text-xl font-semibold text-stone-900">This listing isn't available anymore</h2>
          <p className="mt-2 text-stone-500">It may have already been sold.</p>
          <Link to="/browse" className="mt-4 inline-block text-orange-600 hover:underline font-medium">Back to Browse →</Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm text-stone-500 hover:text-stone-900 transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div>
        <h1 className="text-3xl font-bold tracking-tight text-stone-900">Checkout</h1>
        <p className="mt-1 text-stone-500">Review your order before paying.</p>
      </div>

      <Card>
        <div className="flex items-center gap-4">
          <div className="h-20 w-20 rounded-xl bg-stone-100 overflow-hidden shrink-0">
            <img src={photo} className="h-full w-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-stone-900 truncate">{listing.title}</h2>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant="violet" className="capitalize">{listing.category.replace("_", " ")}</Badge>
              {listing.seller?.display_name && (
                <span className="text-xs text-stone-500">Sold by {listing.seller.display_name}</span>
              )}
            </div>
          </div>
          <span className="text-xl font-bold text-stone-900 shrink-0">{fmtMoney(listing.price)}</span>
        </div>
      </Card>

      <Card>
        <h3 className="font-semibold text-stone-900 mb-3">Order summary</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-stone-600">Item price</span>
            <span className="text-stone-900">{fmtMoney(price)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-600">Platform commission ({(commissionRate * 100).toFixed(0)}%, paid by seller)</span>
            <span className="text-stone-500">{fmtMoney(commission)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-600">Seller receives</span>
            <span className="text-stone-500">{fmtMoney(sellerPayout)}</span>
          </div>
          <div className="my-2 border-t border-stone-200" />
          <div className="flex justify-between text-base">
            <span className="font-semibold text-stone-900">You pay</span>
            <span className="font-bold text-stone-900">{fmtMoney(price)}</span>
          </div>
        </div>
      </Card>

      <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-100">
        <h3 className="text-sm font-semibold text-stone-900 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-orange-500" /> Trust on this deal
        </h3>
        <ul className="mt-3 space-y-2 text-sm text-stone-600">
          <li className="flex gap-2"><span className="text-orange-500">✓</span> Money held in escrow until you confirm receipt</li>
          <li className="flex gap-2"><span className="text-orange-500">✓</span> 7-day release window</li>
          <li className="flex gap-2"><span className="text-orange-500">✓</span> Dispute resolution if anything's off</li>
        </ul>
      </Card>

      <Button onClick={() => payMutation.mutate()} loading={payMutation.isPending} size="lg" className="w-full">
        <Lock className="h-4 w-4" /> Pay {fmtMoney(price)} with escrow
      </Button>
      <p className="text-xs text-stone-500 text-center">
        This is a demo checkout — no real payment is charged. Real payment gateway integration is planned but not yet connected.
      </p>
    </div>
  );
}
