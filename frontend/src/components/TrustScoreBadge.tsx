import { motion } from "framer-motion";
import { cn } from "../lib/utils";

interface Props {
  score: number;
  size?: number;
  className?: string;
  showLabel?: boolean;
}

function getTone(score: number) {
  if (score >= 85) return { from: "#34d399", mid: "#f59e0b", to: "#f97316", text: "Trusted" };
  if (score >= 65) return { from: "#f59e0b", mid: "#f97316", to: "#f43f5e", text: "Reliable" };
  return { from: "#f97316", mid: "#f43f5e", to: "#e11d48", text: "New" };
}

export function TrustScoreBadge({ score, size = 72, className, showLabel = true }: Props) {
  const safeScore = Math.max(0, Math.min(100, Math.round(score)));
  const tone = getTone(safeScore);
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safeScore / 100) * circumference;
  const gradientId = `ts-grad-${size}-${safeScore}`;

  return (
    <div className={cn("inline-flex flex-col items-center gap-1", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={tone.from} />
              <stop offset="50%" stopColor={tone.mid} />
              <stop offset="100%" stopColor={tone.to} />
            </linearGradient>
          </defs>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#f1ece4"
            strokeWidth={5}
            fill="transparent"
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={`url(#${gradientId})`}
            strokeWidth={5}
            fill="transparent"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.1, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-bold text-stone-900" style={{ fontSize: size * 0.28 }}>
            {safeScore}
          </span>
        </div>
      </div>
      {showLabel && (
        <span className="text-xs font-medium text-stone-600">{tone.text}</span>
      )}
    </div>
  );
}