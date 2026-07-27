import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Upload, X } from "lucide-react";
import { Card } from "../components/ui/Card";
import { Input, Textarea, Select } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { apiClient } from "../lib/client";
import toast from "react-hot-toast";

const PHOTO_SUGGESTIONS: Record<string, string[]> = {
  electronics: [
    "https://images.unsplash.com/photo-1593642632823-8f785ba67e45?w=800",
    "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800",
    "https://images.unsplash.com/photo-1546054454-aa26e2b734c7?w=800",
  ],
  fashion: [
    "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800",
    "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=800",
  ],
  furniture: [
    "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800",
    "https://images.unsplash.com/photo-1538688525198-9b88f6f53126?w=800",
  ],
  sports: [
    "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800",
    "https://images.unsplash.com/photo-1517649763962-0c623066013b?w=800",
  ],
  books: [
    "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=800",
    "https://images.unsplash.com/photo-1535905557558-afc4877a26fc?w=800",
  ],
  tools: [
    "https://images.unsplash.com/photo-1581244277943-fe4a9c777189?w=800",
    "https://images.unsplash.com/photo-1504148455328-c376907d081c?w=800",
  ],
};

export function CreateListing() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("edit");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("electronics");
  const [listingType, setListingType] = useState<"sale" | "rent">("sale");
  const [price, setPrice] = useState("");
  const [dailyRate, setDailyRate] = useState("");
  const [location, setLocation] = useState("Dhaka");
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);

  const { data: existing } = useQuery({
    queryKey: ["listing", editId],
    queryFn: () => apiClient.getListing(editId!),
    enabled: !!editId,
  });

  useEffect(() => {
    if (!existing) return;
    const l = existing.data;
    setTitle(l.title);
    setDescription(l.description || "");
    setCategory(l.category);
    setListingType(l.listing_type === "rent" ? "rent" : "sale");
    setPrice(l.price ? String(Math.trunc(Number(l.price))) : "");
    setDailyRate(l.rent_per_day ? String(Math.trunc(Number(l.rent_per_day))) : "");
    setLocation(l.location || "Dhaka");
    setPhotoUrls(l.photo_urls || []);
  }, [existing]);

  function pickSuggestion() {
    const list = PHOTO_SUGGESTIONS[category] || [];
    if (list.length === 0) return;
    setPhotoUrls((p) => Array.from(new Set([...p, list[p.length % list.length]])));
  }

  async function handleUpload(file: File) {
    try {
      const res = await apiClient.uploadPhoto(file);
      setPhotoUrls((p) => [...p, res.url]);
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    }
  }

  const submit = useMutation({
    mutationFn: () => {
      const payload = {
        title,
        description,
        category,
        listing_type: listingType,
        price,
        rent_per_day: listingType === "rent" ? dailyRate : null,
        photo_urls: photoUrls,
        location,
      } as any;
      return editId ? apiClient.updateListing(editId, payload) : apiClient.createListing(payload);
    },
    onSuccess: (res) => {
      toast.success(editId ? "Listing updated" : "Listing published");
      queryClient.invalidateQueries({ queryKey: ["listings"] });
      queryClient.invalidateQueries({ queryKey: ["my-listings"] });
      navigate(`/listing/${res.data.id}`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold tracking-tight text-stone-900">{editId ? "Edit listing" : "List something"}</h1>
      <p className="mt-1 text-stone-500">{editId ? "Update the details below." : "Add a few details, pick a price, and you're live."}</p>

      <Card className="mt-6 space-y-6">
        <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Sony WH-1000XM4 headphones" required />
        <Textarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's the story, condition, what's included..." rows={5} required />

        <div className="grid grid-cols-2 gap-4">
          <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
            {Object.keys(PHOTO_SUGGESTIONS).map((c) => (
              <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
            ))}
          </Select>
        </div>

        <div>
          <div className="text-sm font-medium mb-2 text-stone-700">Listing type</div>
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-stone-200 bg-stone-50 p-1">
            <button
              onClick={() => setListingType("sale")}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                listingType === "sale"
                  ? "bg-white shadow-sm text-stone-900 border border-stone-200"
                  : "text-stone-500 hover:text-stone-700"
              }`}
            >For sale</button>
            <button
              onClick={() => setListingType("rent")}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                listingType === "rent"
                  ? "bg-white shadow-sm text-stone-900 border border-stone-200"
                  : "text-stone-500 hover:text-stone-700"
              }`}
            >For rent</button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input label={listingType === "sale" ? "Price (BDT)" : "Total price (BDT)"} type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" min="100" max="15000" required />
          {listingType === "rent" && (
            <Input label="Daily rate (BDT)" type="number" value={dailyRate} onChange={(e) => setDailyRate(e.target.value)} placeholder="0" min="1" required />
          )}
          <Input label="Location" value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>

        <div>
          <div className="text-sm font-medium mb-2 text-stone-700">Photos</div>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {photoUrls.map((p, i) => (
              <div key={i} className="relative aspect-square overflow-hidden rounded-xl border border-stone-200 bg-stone-50">
                <img src={p} className="h-full w-full object-cover" />
                <button
                  onClick={() => setPhotoUrls((arr) => arr.filter((_, idx) => idx !== i))}
                  className="absolute top-1 right-1 rounded-full bg-stone-900/80 p-1 hover:bg-stone-900"
                >
                  <X className="h-3 w-3 text-white" />
                </button>
              </div>
            ))}
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-stone-300 bg-stone-50 hover:bg-stone-100 transition">
              <Upload className="h-5 w-5 text-stone-500" />
              <span className="text-xs text-stone-500">Upload</span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
            </label>
            <button
              onClick={pickSuggestion}
              className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-orange-300 bg-orange-50 hover:bg-orange-100 transition"
            >
              <Upload className="h-5 w-5 text-orange-500" />
              <span className="text-xs text-orange-600">Sample</span>
            </button>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button onClick={() => submit.mutate()} loading={submit.isPending} size="lg" className="flex-1">
            {editId ? "Save changes" : "Publish listing"}
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}