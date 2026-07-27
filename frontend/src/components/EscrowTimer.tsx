import { useEffect, useState } from "react";
import { fmtRelative } from "../lib/utils";
import { motion } from "framer-motion";

export function EscrowTimer({ releaseAt }: { releaseAt: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const diff = new Date(releaseAt).getTime() - now;
  const overdue = diff < 0;

  const d = Math.floor(Math.abs(diff) / 86400000);
  const h = Math.floor((Math.abs(diff) % 86400000) / 3600000);
  const m = Math.floor((Math.abs(diff) % 3600000) / 60000);
  const s = Math.floor((Math.abs(diff) % 60000) / 1000);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-2xl border border-violet-500/30 bg-violet-500/10 p-5"
    >
      <div className="text-xs uppercase tracking-wider text-violet-300 font-medium">Escrow release</div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className={`text-3xl font-bold tabular-nums ${overdue ? "text-emerald-400" : "text-foreground"}`}>
          {String(d).padStart(2, "0")}:
          {String(h).padStart(2, "0")}:
          {String(m).padStart(2, "0")}:
          {String(s).padStart(2, "0")}
        </span>
      </div>
      <div className="mt-1 text-sm text-muted-foreground">
        {overdue ? "Ready to release" : `${fmtRelative(releaseAt)}`}
      </div>
    </motion.div>
  );
}