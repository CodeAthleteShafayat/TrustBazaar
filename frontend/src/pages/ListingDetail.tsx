import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, ShoppingBag, Calendar, MapPin } from "lucide-react";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Input } from "../components/ui/Input";
import { Dialog } from "../components/ui/Dialog";
import { ListingCard } from "../components/ListingCard";
import { apiClient } from "../lib/client";
import { fmtMoney } from "../lib/utils";
import { useAuth } from "../lib/auth";
import toast from "react-hot-toast";

export function ListingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { token } = useAuth();
  const [photoIndex, setPhotoIndex] = useState(0);
  const [rentOpen, setRentOpen] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["listing", id],
    queryFn: () => apiClient.getListing(id!),
  });

  const listing = data?.data;
  const { data: relatedData } = useQuery({
    queryKey: ["related-listings", listing?.category, id],
    queryFn: () => apiClient.listListings({ category: listing!.category }),
    enabled: !!listing,
  });
  const related = (relatedData?.data || []).filter((l) => l.id !== id).slice(0, 4);

  const rentMutation = useMutation({
    mutationFn: () => apiClient.createRental({ listing_id: id!, start_date: startDate, end_date: endDate }),
    onSuccess: (res) => {
      toast.success("Rental reserved. Deposit held in escrow.");
      setRentOpen(false);
      queryClient.invalidateQueries({ queryKey: ["rentals"] });
      navigate(`/rentals/${res.data.id}`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading || !data || !listing) {
    return <div className="aspect-video rounded-2xl skeleton" />;
  }

  const photos = (listing.photo_urls && listing.photo_urls.length)
    ? listing.photo_urls
    : ["https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=800"];

  const hasDeposit = listing.listing_type === "rent" && listing.deposit_required === "True";
  const depositAmount = hasDeposit ? Number(listing.price) * Number(listing.deposit_rate || 0) : 0;
  const MIN_RENTAL_DAYS = 1;
  const MAX_RENTAL_DAYS = 15;
  const rentalDays = startDate && endDate
    ? Math.floor((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1
    : 0;
  const rentalDaysValid = rentalDays >= MIN_RENTAL_DAYS && rentalDays <= MAX_RENTAL_DAYS;
  const maxEndDate = startDate
    ? new Date(new Date(startDate).getTime() + (MAX_RENTAL_DAYS - 1) * 86400000).toISOString().slice(0, 10)
    : undefined;

  return (
    <div className="space-y-6">
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm text-stone-500 hover:text-stone-900 transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm"
          >
            <motion.img
              key={photoIndex}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              src={photos[photoIndex]}
              alt={listing.title}
              className="aspect-video w-full object-cover"
            />
          </motion.div>
          {photos.length > 1 && (
            <div className="grid grid-cols-5 gap-2">
              {photos.map((p, i) => (
                <button
                  key={i}
                  onClick={() => setPhotoIndex(i)}
                  className={`overflow-hidden rounded-lg border-2 transition ${
                    photoIndex === i
                      ? "border-orange-500 shadow-md shadow-orange-500/20"
                      : "border-transparent opacity-60 hover:opacity-100"
                  }`}
                >
                  <img src={p} className="aspect-square w-full object-cover" />
                </button>
              ))}
            </div>
          )}

          <Card>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-stone-900">{listing.title}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-stone-500">
                  <Badge variant="violet" className="capitalize">{listing.category.replace("_", " ")}</Badge>
                  {listing.listing_type === "rent" ? <Badge variant="info">For rent</Badge> : <Badge variant="success">For sale</Badge>}
                  {listing.location && (
                    <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {listing.location}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-6 prose max-w-none">
              <p className="text-stone-700 leading-relaxed whitespace-pre-wrap">{listing.description}</p>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <div className="flex items-baseline justify-between">
              {listing.listing_type === "rent" && listing.rent_per_day ? (
                <>
                  <span className="text-4xl font-bold text-stone-900">{fmtMoney(listing.rent_per_day)}</span>
                  <span className="text-sm text-stone-500">/day</span>
                </>
              ) : (
                <span className="text-4xl font-bold text-stone-900">{fmtMoney(listing.price)}</span>
              )}
            </div>
            {hasDeposit && (
              <div className="mt-1 text-sm text-stone-500">
                Deposit (refundable): <span className="font-medium text-stone-800">{fmtMoney(depositAmount)}</span>
              </div>
            )}
            <div className="mt-6 space-y-3">
              {!token ? (
                <Button onClick={() => navigate(`/login?next=${encodeURIComponent(`/listing/${id}`)}`)} className="w-full">
                  Sign in to {listing.listing_type === "rent" ? "rent" : "buy"}
                </Button>
              ) : listing.listing_type === "rent" ? (
                <Button onClick={() => setRentOpen(true)} className="w-full">
                  <Calendar className="h-4 w-4" /> Reserve rental
                </Button>
              ) : (
                <Button onClick={() => navigate(`/checkout/${id}`)} className="w-full">
                  <ShoppingBag className="h-4 w-4" /> Buy with escrow
                </Button>
              )}
              <p className="text-xs text-stone-500 text-center">
                Your money is held in escrow until you confirm receipt.
              </p>
            </div>
          </Card>

          {listing.seller && (
            <Card>
              <Link to={`/profile/${listing.seller.id}`} className="flex items-center gap-3 group">
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-amber-500 to-rose-500 flex items-center justify-center text-sm font-bold text-white">
                  {listing.seller.display_name?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-stone-900 group-hover:text-orange-600 transition-colors">{listing.seller.display_name}</div>
                  <div className="text-xs text-stone-500">{listing.seller.trust_tier || "Verified user"}</div>
                </div>
                <div className="rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 px-3 py-2 text-white shadow-lg text-center">
                  <div className="text-xs font-bold leading-tight">Never get cheated</div>
                  <div className="text-[10px] opacity-90 leading-tight mt-0.5">3-day money-back guarantee</div>
                </div>
              </Link>
            </Card>
          )}

          <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-100">
            <h3 className="text-sm font-semibold text-stone-900">Trust on this deal</h3>
            <ul className="mt-3 space-y-2 text-sm text-stone-600">
              <li className="flex gap-2"><span className="text-orange-500">✓</span> Money in escrow until you confirm</li>
              <li className="flex gap-2"><span className="text-orange-500">✓</span> 7-day release window</li>
              <li className="flex gap-2"><span className="text-orange-500">✓</span> Dispute resolution if anything's off</li>
            </ul>
          </Card>
        </div>
      </div>

      {related.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-3 text-stone-900">Related products</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {related.map((l, i) => (
              <ListingCard key={l.id} listing={l} index={i} />
            ))}
          </div>
        </section>
      )}

      <Dialog open={rentOpen} onClose={() => setRentOpen(false)} title="Reserve rental dates">
        <form onSubmit={(e) => { e.preventDefault(); if (rentalDaysValid) rentMutation.mutate(); }} className="space-y-4">
          <p className="text-xs text-stone-500">Rentals run 1–15 days.</p>
          <Input
            label="Start date"
            type="date"
            value={startDate}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => { setStartDate(e.target.value); setEndDate(""); }}
            required
          />
          <Input
            label="End date"
            type="date"
            value={endDate}
            min={startDate || undefined}
            max={maxEndDate}
            disabled={!startDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
          />
          {startDate && endDate && listing.rent_per_day && (
            <div className="rounded-xl bg-orange-50 border border-orange-200 p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-stone-600">Days</span>
                <span className="font-medium text-stone-900">{rentalDays}</span>
              </div>
              <div className="mt-2 flex justify-between">
                <span className="text-stone-600">Rental fee</span>
                <span className="font-medium text-stone-900">{fmtMoney(Number(listing.rent_per_day) * rentalDays)}</span>
              </div>
              <div className="mt-2 flex justify-between">
                <span className="text-stone-600">Deposit (held)</span>
                <span className="font-medium text-stone-900">{fmtMoney(depositAmount)}</span>
              </div>
              {!rentalDaysValid && (
                <p className="mt-2 text-rose-600">Rentals must be between 1 and 15 days.</p>
              )}
            </div>
          )}
          <Button type="submit" loading={rentMutation.isPending} disabled={!rentalDaysValid} className="w-full">Confirm reservation</Button>
        </form>
      </Dialog>
    </div>
  );
}