import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { fmtMoney } from "../lib/utils";
import { Badge } from "./ui/Badge";
import type { Listing } from "../lib/client";

export function ListingCard({ listing, index = 0 }: { listing: Listing; index?: number }) {
  const photo = listing.photo_urls?.[0] ||
    "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=800";
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
    >
      <Link to={`/listing/${listing.id}`} className="group block">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card">
          <div className="aspect-square overflow-hidden bg-secondary">
            <motion.img
              src={photo}
              alt={listing.title}
              className="h-full w-full object-cover"
              whileHover={{ scale: 1.08 }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <div className="absolute top-3 left-3 flex gap-2">
            {listing.listing_type === "rent" && <Badge variant="violet">For rent</Badge>}
          </div>
          <div className="absolute top-3 right-3">
            <div className="rounded-lg bg-gradient-to-r from-violet-600/90 to-purple-600/90 backdrop-blur px-3 py-2 text-white shadow-lg">
              <div className="text-xs font-bold leading-tight">Never get cheated</div>
              <div className="text-[10px] opacity-90 leading-tight mt-0.5">3-day money-back guarantee</div>
            </div>
          </div>
          <div className="p-4">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-foreground line-clamp-2 group-hover:text-violet-400 transition-colors">
                {listing.title}
              </h3>
            </div>
            <p className="mt-1 text-xs text-muted-foreground line-clamp-1">{listing.description}</p>
            <div className="mt-3 flex items-center justify-between">
              <div>
                <span className="text-lg font-bold">{fmtMoney(listing.price)}</span>
                {listing.listing_type === "rent" && listing.rent_per_day && (
                  <span className="text-xs text-muted-foreground"> /day</span>
                )}
              </div>
              <span className="text-xs text-muted-foreground capitalize">{listing.category.replace("_", " ")}</span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}