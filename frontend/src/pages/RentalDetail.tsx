import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, Calendar, Shield, CheckCircle2, AlertCircle, FastForward, Package } from "lucide-react";
import toast from "react-hot-toast";
import confetti from "canvas-confetti";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Input, Select, Textarea } from "../components/ui/Input";
import { Dialog } from "../components/ui/Dialog";
import { apiClient } from "../lib/client";
import { fmtMoney, fmtDate } from "../lib/utils";
import { useAuth } from "../lib/auth";

export function RentalDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [returnOpen, setReturnOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);
  const [conditionNotes, setConditionNotes] = useState("");
  const [depositAction, setDepositAction] = useState<"refund" | "partial" | "claim">("refund");
  const [partialAmount, setPartialAmount] = useState("");
  const [confirmNotes, setConfirmNotes] = useState("");
  const [claimAmount, setClaimAmount] = useState("");
  const [claimReason, setClaimReason] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["rental", id],
    queryFn: () => apiClient.getRental(id!),
    refetchInterval: 10_000,
  });

  const ret = useMutation({
    mutationFn: () => apiClient.returnRental(id!, conditionNotes),
    onSuccess: () => {
      toast.success("Return initiated. Owner has 48h to confirm.");
      setReturnOpen(false);
      queryClient.invalidateQueries({ queryKey: ["rental", id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const confirmReturn = useMutation({
    mutationFn: () => apiClient.confirmReturn(id!, {
      deposit_action: depositAction,
      partial_amount: partialAmount || undefined,
      notes: confirmNotes || undefined,
    }),
    onSuccess: () => {
      if (depositAction === "refund") confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
      toast.success("Return processed");
      setConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ["rental", id] });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const claim = useMutation({
    mutationFn: () => apiClient.claimDeposit(id!, { amount: claimAmount, reason: claimReason }),
    onSuccess: () => {
      toast.success("Deposit claim filed");
      setClaimOpen(false);
      queryClient.invalidateQueries({ queryKey: ["rental", id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const fast = useMutation({
    mutationFn: () => apiClient.fastForwardRental(id!),
    onSuccess: () => { toast.success("⏩ Fast-forwarded"); queryClient.invalidateQueries({ queryKey: ["rental", id] }); },
  });

  if (isLoading || !data) return <div className="aspect-video rounded-2xl skeleton" />;
  const rental = data.data;
  const isRenter = user?.id === rental.renter_id;
  const isOwner = user?.id === rental.owner_id;

  return (
    <div className="space-y-6">
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm text-stone-500 hover:text-stone-900 transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <div className="flex items-start gap-4">
            {rental.listing?.photo_urls?.[0] && (
              <img src={rental.listing.photo_urls[0]} className="h-24 w-24 rounded-xl object-cover" />
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-stone-900">{rental.listing?.title || "Rental"}</h1>
                <Badge variant={rental.status === "completed" ? "success" : "info"} className="capitalize">{rental.status}</Badge>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-stone-500">
                <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {fmtDate(rental.start_date)} → {fmtDate(rental.end_date)}</span>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <h3 className="font-semibold flex items-center gap-2 text-stone-900"><Shield className="h-4 w-4" /> Deposit (held in escrow)</h3>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-stone-500 uppercase">Held</div>
                <div className="text-2xl font-bold text-stone-900">{fmtMoney(rental.deposit_amount)}</div>
              </div>
              <div>
                <div className="text-xs text-stone-500 uppercase">Status</div>
                <Badge variant={rental.deposit_status === "refunded" ? "success" : rental.deposit_status === "claimed" ? "danger" : "warning"} className="capitalize mt-1">{rental.deposit_status}</Badge>
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="font-semibold mb-3 text-stone-900">Cost breakdown</h3>
            <div className="space-y-2 text-sm">
              <Row k="Total rent" v={fmtMoney(rental.rental_fee)} />
              <Row k="Deposit (refundable)" v={fmtMoney(rental.deposit_amount)} muted />
              <div className="my-2 border-t border-stone-200" />
              <Row k="Owner payout" v={fmtMoney(rental.net_to_owner || rental.rental_fee)} highlight />
              <Row k="Platform commission" v={fmtMoney(rental.commission)} muted />
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <h3 className="font-semibold text-stone-900">Actions</h3>
            <div className="mt-3 space-y-2">
              {isRenter && rental.status === "paid" && (
                <Button onClick={() => setReturnOpen(true)} className="w-full">
                  <Package className="h-4 w-4" /> Mark as returned
                </Button>
              )}
              {isOwner && rental.status === "returned" && (
                <>
                  <Button onClick={() => setConfirmOpen(true)} className="w-full">
                    <CheckCircle2 className="h-4 w-4" /> Confirm return
                  </Button>
                  <Button variant="outline" onClick={() => setClaimOpen(true)} className="w-full">
                    <AlertCircle className="h-4 w-4" /> Claim deposit
                  </Button>
                </>
              )}
              <Button variant="ghost" onClick={() => fast.mutate()} loading={fast.isPending} className="w-full text-xs">
                <FastForward className="h-3.5 w-3.5" /> Fast-forward (demo)
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <Dialog open={returnOpen} onClose={() => setReturnOpen(false)} title="Mark item as returned">
        <form onSubmit={(e) => { e.preventDefault(); ret.mutate(); }} className="space-y-4">
          <Textarea label="Condition notes" value={conditionNotes} onChange={(e) => setConditionNotes(e.target.value)} rows={3} placeholder="Any wear, scratches, missing parts..." />
          <Button type="submit" loading={ret.isPending} className="w-full">Submit return</Button>
        </form>
      </Dialog>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Confirm return">
        <form onSubmit={(e) => { e.preventDefault(); confirmReturn.mutate(); }} className="space-y-4">
          <Select label="Deposit action" value={depositAction} onChange={(e) => setDepositAction(e.target.value as any)}>
            <option value="refund">Full refund to renter</option>
            <option value="partial">Partial refund</option>
            <option value="claim">Claim full deposit</option>
          </Select>
          {depositAction === "partial" && (
            <Input label="Refund amount" type="number" value={partialAmount} onChange={(e) => setPartialAmount(e.target.value)} />
          )}
          <Textarea label="Notes" value={confirmNotes} onChange={(e) => setConfirmNotes(e.target.value)} rows={2} />
          <Button type="submit" loading={confirmReturn.isPending} className="w-full">Confirm</Button>
        </form>
      </Dialog>

      <Dialog open={claimOpen} onClose={() => setClaimOpen(false)} title="File deposit claim">
        <form onSubmit={(e) => { e.preventDefault(); claim.mutate(); }} className="space-y-4">
          <Input label="Claim amount" type="number" value={claimAmount} onChange={(e) => setClaimAmount(e.target.value)} required />
          <Textarea label="Reason" value={claimReason} onChange={(e) => setClaimReason(e.target.value)} rows={3} required />
          <p className="text-xs text-stone-500">This will open a dispute. An admin will review evidence from both sides.</p>
          <Button type="submit" variant="destructive" loading={claim.isPending} className="w-full">File claim</Button>
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