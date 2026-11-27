import { useId } from "react";

export function BrandMark({ className = "brand-mark" }: { className?: string }) {
  const uid = useId().replace(/:/g, "");
  const ringId = `op-ring-${uid}`;
  const playId = `op-play-${uid}`;

  return (
    <span className={className} aria-hidden="true">
      <svg viewBox="0 0 32 32" width="100%" height="100%" fill="none">
        <defs>
          <linearGradient id={ringId} x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#7aa7ff" />
            <stop offset="100%" stopColor="#5ed4d5" />
          </linearGradient>
          <linearGradient id={playId} x1="12" y1="10" x2="24" y2="22" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#5ed4d5" />
            <stop offset="100%" stopColor="#62d7b0" />
          </linearGradient>
        </defs>
        <rect x="1.5" y="1.5" width="29" height="29" rx="8" fill="#0d1629" stroke="#2c436e" strokeWidth="1.2" />
        <path
          d="M22.8 10.6A8.8 8.8 0 1 0 22.8 21.4"
          stroke={`url(#${ringId})`}
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M14.2 11.4a.8.8 0 0 1 1.22-.68l7.15 4.46a.8.8 0 0 1 0 1.36l-7.15 4.46a.8.8 0 0 1-1.22-.68V11.4Z"
          fill={`url(#${playId})`}
        />
      </svg>
    </span>
  );
}
