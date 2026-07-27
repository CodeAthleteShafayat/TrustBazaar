import { cn } from "../../lib/utils";

type Variant = "default" | "success" | "warning" | "danger" | "info" | "violet" | "cream";

const variants: Record<Variant, string> = {
  default: "bg-stone-100 text-stone-700 border-stone-200",
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  danger: "bg-rose-50 text-rose-700 border-rose-200",
  info: "bg-sky-50 text-sky-700 border-sky-200",
  violet: "bg-orange-50 text-orange-700 border-orange-200",
  cream: "bg-[#fbf7f2] text-stone-700 border-stone-200",
};

export function Badge({
  children,
  variant = "default",
  className,
}: {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}