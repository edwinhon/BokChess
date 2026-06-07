"use client";

import { useEffect, useRef, useState } from "react";

interface EvalBarProps {
  /** Score in centipawns from **Red's** perspective.
   *  Positive = Red advantage, Negative = Black advantage. */
  score: number;
  /** Score change from previous position (positive = better for Red) */
  scoreChange?: number;
  /** Whether to show the score change label */
  showChange?: boolean;
}

/**
 * A vertical centipawn evaluation bar.
 *
 * Ranges from roughly -1000 cp (Black crushing) to +1000 cp (Red crushing).
 * The bar is colored: Black (top) for Black advantage → neutral center → Red (bottom) for Red advantage.
 * Matches board orientation where Black is on top and Red is on bottom.
 * Clamped visually at ±10 pawn-units (±1000 cp) for display purposes.
 */
export default function EvalBar({ score, scoreChange = 0, showChange = true }: EvalBarProps) {
  const prevScoreRef = useRef(score);
  const [animatedScore, setAnimatedScore] = useState(score);

  // Smooth transition for the bar
  useEffect(() => {
    prevScoreRef.current = animatedScore;
    const start = prevScoreRef.current;
    const end = score;
    const duration = 400; // ms
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedScore(start + (end - start) * eased);
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [score]);

  // Clamp score for visual display: ±1000 cp
  const MAX_CP = 1000;
  const clamped = Math.max(-MAX_CP, Math.min(MAX_CP, animatedScore));
  // Map to 0–100: 0 = Black crushing, 50 = even, 100 = Red crushing
  const percentage = ((clamped + MAX_CP) / (2 * MAX_CP)) * 100;

  // Format score for display
  const formatScore = (cp: number): string => {
    if (cp > 0) return `+${(cp / 100).toFixed(1)}`;
    if (cp < 0) return `${(cp / 100).toFixed(1)}`;
    return "0.0";
  };

  // Determine color of the evaluation text
  const scoreColor = score > 30 ? "text-red-400" : score < -30 ? "text-stone-300" : "text-stone-400";

  // Format the score change
  const formatChange = (cp: number): string => {
    if (cp === 0) return "";
    const sign = cp > 0 ? "+" : "";
    return `${sign}${(cp / 100).toFixed(1)}`;
  };

  return (
    <div className="flex flex-col items-center gap-2 select-none">
      {/* Label */}
      <span className="text-xs text-stone-500 font-mono">Eval</span>

      {/* Bar container */}
      <div className="relative w-8 h-[464px] rounded-lg overflow-hidden border border-stone-600 bg-stone-800">
        {/* Background gradient: Black at top → neutral → Red at bottom */}
        {/* Black section (top) — full height behind the red-topped clip */}
        <div className="absolute inset-0 bg-gradient-to-b from-stone-900 via-stone-500 to-stone-300" />

        {/* Red section (bottom) — covers from (100-percentage)% downward, growing upward */}
        <div
          className="absolute inset-0 bg-gradient-to-b from-red-700 via-red-700 to-amber-600 transition-[top] duration-300 ease-out"
          style={{ top: `${100 - percentage}%` }}
        />

        {/* Center line indicator */}
        <div
          className="absolute left-0 right-0 h-[2px] bg-white/30"
          style={{ top: "50%" }}
        />

        {/* Score marker triangle */}
        <div
          className="absolute left-0 right-0 flex justify-center transition-[top] duration-300 ease-out z-10"
          style={{ top: `${percentage}%`, transform: "translateY(-50%)" }}
        >
          <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-white" />
        </div>

        {/* Score text — offset from marker to avoid overlap */}
        <div
          className={`absolute left-0 right-0 text-center text-xs font-bold font-mono transition-[top] duration-300 ease-out z-10 ${scoreColor}`}
          style={{
            top: `${Math.max(10, Math.min(90, percentage > 50 ? percentage - 10 : percentage + 10))}%`,
            transform: "translateY(-50%)",
          }}
        >
          {formatScore(score)}
        </div>
      </div>

      {/* Score change */}
      {showChange && scoreChange !== 0 && (
        <div
          className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${
            scoreChange > 0
              ? "text-red-400 bg-red-500/10"
              : "text-stone-300 bg-stone-500/10"
          }`}
        >
          {formatChange(scoreChange)}
        </div>
      )}
    </div>
  );
}
