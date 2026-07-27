import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fmtMoney(value: string | number) {
  const n = typeof value === "string" ? parseFloat(value) : value;
  const amount = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
  return `৳${amount}`;
}

export function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function fmtRelative(iso: string) {
  const target = new Date(iso).getTime();
  const now = Date.now();
  const diff = target - now;
  const abs = Math.abs(diff);
  const past = diff < 0;
  const minute = 60_000, hour = 3600_000, day = 86400_000;
  const fmt = (n: number, unit: string) => `${n} ${unit}${n !== 1 ? "s" : ""}`;
  if (abs < minute) return past ? "just now" : "in a moment";
  if (abs < hour) return past ? `${fmt(Math.round(abs / minute), "minute")} ago` : `in ${fmt(Math.round(abs / minute), "minute")}`;
  if (abs < day) return past ? `${fmt(Math.round(abs / hour), "hour")} ago` : `in ${fmt(Math.round(abs / hour), "hour")}`;
  return past ? `${fmt(Math.round(abs / day), "day")} ago` : `in ${fmt(Math.round(abs / day), "day")}`;
}

export function tierColor(tier: string): { from: string; to: string; text: string } {
  switch (tier) {
    case "Top Rated":
      return { from: "from-amber-500", to: "to-orange-500", text: "text-amber-400" };
    case "Trusted":
      return { from: "from-emerald-500", to: "to-teal-500", text: "text-emerald-400" };
    case "Reliable":
      return { from: "from-sky-500", to: "to-blue-500", text: "text-sky-400" };
    case "New":
      return { from: "from-slate-500", to: "to-slate-600", text: "text-slate-400" };
    default:
      return { from: "from-zinc-500", to: "to-zinc-600", text: "text-zinc-400" };
  }
}