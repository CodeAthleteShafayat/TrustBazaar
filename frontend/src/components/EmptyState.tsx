import { motion } from "framer-motion";
import { Inbox } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../lib/utils";

interface Props {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon = Inbox, title, description, action, className }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-16 text-center",
        className,
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-orange-500">
        <Icon className="h-7 w-7" />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-stone-900">{title}</h3>
        {description && (
          <p className="mt-1 text-sm text-stone-500 max-w-sm mx-auto">{description}</p>
        )}
      </div>
      {action}
    </motion.div>
  );
}