import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, Truck, CheckCircle2, AlertCircle, FastForward } from "lucide-react";
import toast from "react-hot-toast";
import confetti from "canvas-confetti";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Input, Select, Textarea } from "../components/ui/Input";
import { Dialog } from "../components/ui/Dialog";
import { EscrowTimer } from "../components/EscrowTimer";
import { apiClient } from "../lib/client";
import { fmtMoney, fmtRelative } from "../lib/utils";
import { useAuth } from "../lib/auth";

const STEPS = ["paid", "shipped", "completed"];

export function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [shipOpen, setShipOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [carrier, setCarrier] = useState("Pathao");
  const [tracking, setTracking] = useState("");
  const [reason, setReason] = useState("not_received");
  const [description, setDescription] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: () => apiClient.getOrder(id!),
    refetchInterval: 10_000,
  });

  const ship = useMutation({
    mutationFn: () => apiClient.shipOrder(id!, { shipping_carrier: carrier, tracking_number: tracking }),
    onSuccess: () => {
      toast.success("Shipping info saved");
      setShipOpen(false);
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const confirm = useMutation({
    mutationFn: () => apiClient.confirmOrder(id!),
    onSuccess: () => {
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
      toast.success("Receipt confirmed — funds released from escrow");
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const dispute = useMutation({
    mutationFn: () => apiClient.disputeOrder(id!, { reason }),
    onSuccess: () => {
      toast.success("Dispute opened — admin will review");
      setDisputeOpen(false);
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const fast = useMutation({
    mutationFn: () => apiClient.fastForward(id!),
    onSuccess: () => {
      toast.success("⏩ Fast-forwarded. Demo mode active.");
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  if (isLoading || !data) return <div className="aspect-video rounded-2xl skeleton" />;
  const order = data.data;
  const isBuyer = user?.id === order.buyer_id;
  const isSeller = user?.id === order.seller_id;
  const stepIndex = STEPS.indexOf(order.status);

  return (
    <div className="space-y-6">
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm text-stone-500 hover:text-stone-900 transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <div className="flex items-start gap-4">
                {order.listing?.photo_urls?.[0] && (
                  <img src={order.listing.photo_urls[0]} className="h-24 w-24 rounded-xl object-cover" />
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold text-stone-900">{order.listing?.title || "Order"}</h1>
                    <Badge variant={order.status === "completed" ? "success" : "info"} className="capitalize">{order.status}</Badge>
                  </div>
                  <div className="mt-2 text-sm text-stone-500">
                    Order #{order.id.slice(0, 8)} · paid {order.paid_at ? fmtRelative(order.paid_at) : "recently"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-stone-900">{fmtMoney(order.amount)}</div>
                  <div className="text-xs text-stone-500 mt-1">
                    seller gets <span className="text-emerald-600 font-medium">{fmtMoney(order.net_to_seller ?? "0")}</span>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>

          <Card>
            <h3 className="font-semibold mb-4 text-stone-900">Escrow timeline</h3>
            <div className="space-y-4">
              {STEPS.map((s, i) => {
                const reached = i <= stepIndex;
                const current = i === stepIndex;
                return (
                  <div key={s} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <motion.div
                        initial={false}
                        animate={{ scale: current ? 1.15 : 1 }}
                        className={`h-9 w-9 rounded-full flex items-center justify-center border-2 ${
                          reached
                            ? "bg-gradient-to-br from-amber-500 to-orange-500 border-orange-500 text-white"
                            : "border-stone-200 bg-white text-stone-400"
                        }`}
                      >
                        {s === "paid" && <CheckCircle2 className="h-4 w-4" />}
                        {s === "shipped" && <Truck className="h-4 w-4" />}
                        {s === "completed" && <CheckCircle2 className="h-4 w-4" />}
                      </motion.div>
                      {i < STEPS.length - 1 && (
                        <div className={`w-0.5 flex-1 ${i < stepIndex ? "bg-orange-500" : "bg-stone-200"}`} />
                      )}
                    </div>
                    <div className="flex-1 pb-4">
                      <div className={`font-medium capitalize ${reached ? "text-stone-900" : "text-stone-400"}`}>
                        {s === "paid" && "Money in escrow"}
                        {s === "shipped" && "Item shipped"}
                        {s === "completed" && "Funds released to seller"}
                      </div>
                      <div className="text-xs text-stone-500">
                        {s === "paid" && (order.paid_at ? fmtRelative(order.paid_at) : "—")}
                        {s === "shipped" && (order.shipped_at ? fmtRelative(order.shipped_at) : "—")}
                        {s === "completed" && (order.completed_at ? fmtRelative(order.completed_at) : "—")}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {order.status === "shipped" && (
            <Card>
              <h3 className="font-semibold flex items-center gap-2 text-stone-900">
                <Truck className="h-4 w-4" /> Shipment
              </h3>
              <p className="mt-2 text-sm text-stone-600">
                Seller has marked this order as shipped. Confirm receipt below to release escrow.
              </p>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          {order.release_at && order.status !== "completed" && (
            <EscrowTimer releaseAt={order.release_at} />
          )}

          <Card>
            <h3 className="font-semibold text-stone-900">Actions</h3>
            <div className="mt-3 space-y-2">
              {isSeller && order.status === "paid" && (
                <Button onClick={() => setShipOpen(true)} className="w-full">
                  <Truck className="h-4 w-4" /> Mark as shipped
                </Button>
              )}
              {isBuyer && order.status === "shipped" && (
                <Button onClick={() => confirm.mutate()} loading={confirm.isPending} className="w-full">
                  <CheckCircle2 className="h-4 w-4" /> Confirm receipt & release
                </Button>
              )}
              {(isBuyer || isSeller) && order.status === "shipped" && (
                <Button variant="outline" onClick={() => setDisputeOpen(true)} className="w-full">
                  <AlertCircle className="h-4 w-4" /> Open dispute
                </Button>
              )}
              <Button
                variant="ghost"
                onClick={() => fast.mutate()}
                loading={fast.isPending}
                className="w-full text-xs"
                title="Demo helper — collapses the escrow release window"
              >
                <FastForward className="h-3.5 w-3.5" /> Fast-forward (demo)
              </Button>
            </div>
          </Card>

          <Card>
            <h3 className="font-semibold text-stone-900">Summary</h3>
            <div className="mt-3 space-y-2 text-sm">
              <Row k="Amount" v={fmtMoney(order.amount)} />
              <Row k="Commission" v={fmtMoney(order.commission)} muted />
              <Row k="Seller payout" v={fmtMoney(order.net_to_seller || order.amount)} highlight />
              <div className="my-2 border-t border-stone-200" />
              <Row k="Escrow" v={<Badge>{order.escrow}</Badge>} />
            </div>
          </Card>
        </div>
      </div>

      <Dialog open={shipOpen} onClose={() => setShipOpen(false)} title="Shipping details">
        <form onSubmit={(e) => { e.preventDefault(); ship.mutate(); }} className="space-y-4">
          <Select label="Carrier" value={carrier} onChange={(e) => setCarrier(e.target.value)}>
            <option>Pathao</option>
            <option>Steadfast</option>
            <option>RedX</option>
            <option>SA Express</option>
          </Select>
          <Input label="Tracking number" value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="TBZ123456" required />
          <Button type="submit" loading={ship.isPending} className="w-full">Submit shipment</Button>
        </form>
      </Dialog>

      <Dialog open={disputeOpen} onClose={() => setDisputeOpen(false)} title="Open a dispute">
        <form onSubmit={(e) => { e.preventDefault(); dispute.mutate(); }} className="space-y-4">
          <Select label="Reason" value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="not_received">Item not received</option>
            <option value="not_as_described">Item not as described</option>
            <option value="damaged">Damaged on arrival</option>
            <option value="counterfeit">Counterfeit</option>
            <option value="other">Other</option>
          </Select>
          <Textarea label="What happened?" value={description} onChange={(e) => setDescription(e.target.value)} required rows={4} />
          <Button type="submit" variant="destructive" loading={dispute.isPending} className="w-full">Submit dispute</Button>
        </form>
      </Dialog>
    </div>
  );
}

function Row({ k, v, muted, highlight }: { k: string; v: React.ReactNode; muted?: boolean; highlight?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className={muted ? "text-stone-500" : "text-stone-700"}>{k}</span>
      <span className={highlight ? "font-bold text-emerald-600" : "text-stone-900"}>{v}</span>
    </div>
  );
}