import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Wallet as WalletIcon, ArrowUpRight, ArrowDownRight, Download } from "lucide-react";
import toast from "react-hot-toast";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Dialog } from "../components/ui/Dialog";
import { Badge } from "../components/ui/Badge";
import { apiClient } from "../lib/client";
import { fmtMoney, fmtRelative } from "../lib/utils";

const TYPE_LABEL: Record<string, { label: string; tone: "credit" | "debit" }> = {
  release: { label: "Sale release", tone: "credit" },
  refund: { label: "Refund", tone: "credit" },
  credit: { label: "Credit", tone: "credit" },
  debit: { label: "Payout", tone: "debit" },
  commission: { label: "Commission", tone: "debit" },
};

export function Wallet() {
  const queryClient = useQueryClient();
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [amount, setAmount] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["wallet"],
    queryFn: () => apiClient.wallet(),
  });

  const payout = useMutation({
    mutationFn: () => apiClient.requestPayout(amount),
    onSuccess: () => {
      toast.success("Payout queued (demo — credited instantly)");
      setPayoutOpen(false);
      setAmount("");
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <div className="h-40 rounded-2xl skeleton" />
        <div className="h-64 rounded-2xl skeleton" />
      </div>
    );
  }

  const wallet = data.data;

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="relative overflow-hidden bg-gradient-to-br from-amber-100 via-orange-100 to-rose-100 border-orange-200">
          <div className="absolute top-0 right-0 h-40 w-40 rounded-full bg-orange-300/40 blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-2 text-stone-600">
              <WalletIcon className="h-4 w-4" />
              <span className="text-sm">Available balance</span>
            </div>
            <div className="mt-2 text-5xl md:text-6xl font-bold tracking-tight text-stone-900">
              {fmtMoney(wallet.available)}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-6 text-sm">
              <div>
                <div className="text-stone-500">Pending</div>
                <div className="font-semibold text-stone-900">{fmtMoney(wallet.pending)}</div>
              </div>
              <Button onClick={() => setPayoutOpen(true)} size="sm">
                <Download className="h-4 w-4" /> Request payout
              </Button>
            </div>
          </div>
        </Card>
      </motion.div>

      <Card>
        <h3 className="font-semibold mb-4 text-stone-900">Activity</h3>
        {wallet.ledger.length === 0 ? (
          <div className="py-8 text-center text-sm text-stone-500">
            Nothing yet — your first earnings will land here.
          </div>
        ) : (
          <div className="space-y-2">
            {wallet.ledger.map((e, i) => {
              const meta = TYPE_LABEL[e.type] ?? { label: e.type, tone: "credit" as const };
              const isCredit = meta.tone === "credit";
              return (
                <motion.div
                  key={e.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-center gap-3 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3"
                >
                  <div
                    className={`h-9 w-9 rounded-full flex items-center justify-center ${
                      isCredit ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                    }`}
                  >
                    {isCredit ? (
                      <ArrowDownRight className="h-4 w-4" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-stone-900">
                      {e.reference || meta.label}
                    </div>
                    <div className="text-xs text-stone-500 inline-flex items-center gap-2">
                      <Badge>{meta.label}</Badge>
                      <span>{fmtRelative(e.created_at)}</span>
                    </div>
                  </div>
                  <div
                    className={`font-bold tabular-nums ${
                      isCredit ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    {isCredit ? "+" : "-"}
                    {fmtMoney(e.amount)}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </Card>

      <Dialog open={payoutOpen} onClose={() => setPayoutOpen(false)} title="Request payout">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            payout.mutate();
          }}
          className="space-y-4"
        >
          <Input
            label="Amount (BDT)"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            max={parseFloat(wallet.available)}
            required
          />
          <p className="text-xs text-stone-500">
            Demo mode — payout posts instantly. In production this goes through SSLCommerz or Stripe to your linked account.
          </p>
          <Button type="submit" loading={payout.isPending} className="w-full">
            Request payout
          </Button>
        </form>
      </Dialog>
    </div>
  );
}