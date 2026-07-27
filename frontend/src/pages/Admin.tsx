import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Scale, AlertCircle } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Dialog } from "../components/ui/Dialog";
import { Textarea, Input, Select } from "../components/ui/Input";
import { EmptyState } from "../components/EmptyState";
import { apiClient } from "../lib/client";
import { fmtRelative } from "../lib/utils";

const STATUS_VARIANT: Record<string, "default" | "info" | "warning" | "success" | "danger"> = {
  open: "danger", under_review: "warning", resolved_buyer: "success", resolved_seller: "info", resolved_split: "success",
};

export function Admin() {
  const queryClient = useQueryClient();
  const [active, setActive] = useState<any>(null);
  const [resolution, setResolution] = useState("resolved_buyer");
  const [refundAmount, setRefundAmount] = useState("");
  const [notes, setNotes] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-disputes"],
    queryFn: () => apiClient.adminListDisputes(),
  });

  const resolve = useMutation({
    mutationFn: () => apiClient.adminResolveDispute(active.id, {
      resolution,
      refund_amount: refundAmount || undefined,
    }),
    onSuccess: () => {
      toast.success("Dispute resolved");
      setActive(null);
      queryClient.invalidateQueries({ queryKey: ["admin-disputes"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const disputes = data?.data || [];
  const open = disputes.filter((d) => d.status === "open" || d.status === "under_review");
  const resolved = disputes.filter((d) => (d.status || "").startsWith("resolved"));

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-amber-500 to-rose-500 flex items-center justify-center shadow-md shadow-orange-500/30">
          <Scale className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-stone-900">Admin console</h1>
          <p className="text-stone-500">Dispute queue — review both sides and decide.</p>
        </div>
      </motion.div>

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
                    <div className="h-10 w-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
                      <AlertCircle className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-stone-900">Dispute on {d.order_id ? "order" : "rental"} #{d.id.slice(0, 6)}</h3>
                        <Badge variant={STATUS_VARIANT[d.status]} className="capitalize">{d.status.replace("_", " ")}</Badge>
                      </div>
                      <div className="mt-1 text-sm text-stone-500">
                        <span className="font-medium text-stone-700">{d.reason}</span> · opened {fmtRelative(d.created_at)}
                      </div>
                      <p className="mt-2 text-sm text-stone-700">{d.description}</p>
                    </div>
                    <Button onClick={() => setActive(d)}>Review</Button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {resolved.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500 mb-3">
            Resolved
          </h2>
          <div className="grid gap-3">
            {resolved.map((d) => (
              <Card key={d.id} className="opacity-70">
                <div className="flex items-center gap-3">
                  <Badge variant={STATUS_VARIANT[d.status]} className="capitalize">{d.status.replace("_", " ")}</Badge>
                  <div className="text-sm text-stone-500 truncate">{d.reason} — {d.resolution}</div>
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
              <div><span className="text-stone-500">Description:</span> <span className="text-stone-700">{active.description}</span></div>
            </div>
            <Select label="Resolution" value={resolution} onChange={(e) => setResolution(e.target.value)}>
              <option value="resolved_buyer">Refund buyer in full</option>
              <option value="resolved_seller">Release to seller in full</option>
              <option value="resolved_split">Split the difference</option>
            </Select>
            {resolution === "resolved_split" && (
              <Input label="Refund amount to buyer (BDT)" type="number" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} />
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