"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Move,
  PieceType,
  Color,
} from "@/lib/game/types";
import { createInitialBoard } from "@/lib/game/board";
import { applyMove } from "@/lib/game/moves";
import Board from "@/components/board/Board";
import {
  ChevronFirst,
  ChevronLeft,
  ChevronRight,
  ChevronLast,
  Loader2,
  ArrowLeft,
  Brain,
  RefreshCw,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────
interface MoveNotation {
  moveNumber: number;
  from: { row: number; col: number };
  to: { row: number; col: number };
  captured: { type: string; color: string } | null;
  notation: string;
  evaluation?: {
    score: number;
    bestMove: { row: number; col: number } | null;
    bestMoveNotation: string | null;
    depth: number;
  };
}

interface GameData {
  id: string;
  createdAt: string;
  playerRed: { id: string; username: string; displayName: string } | null;
  playerBlack: { id: string; username: string; displayName: string } | null;
  mode: string;
  aiDifficulty: string | null;
  result: string;
  initialFen: string;
  moveHistory: MoveNotation[];
  isAnalyzed: boolean;
  analyzedAt: string | null;
}

const RESULT_LABELS: Record<string, string> = {
  red_wins: "Red Wins 🏆",
  black_wins: "Black Wins 🏆",
  stalemate: "Draw 🤝",
};

export default function ReviewPage() {
  const params = useParams();
  const gameId = params.id as string;

  const [game, setGame] = useState<GameData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1); // -1 = initial position

  // Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState(0);

  const handleAnalyze = useCallback(async () => {
    if (!game || isAnalyzing) return;
    setIsAnalyzing(true);
    setAnalyzeProgress(0);

    try {
      const res = await fetch(`/api/games/${gameId}/analyze`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Analysis failed");
      const data = await res.json();
      // Reload game data with analysis results
      const refreshed = await fetch(`/api/games/${gameId}`);
      const updated = await refreshed.json();
      setGame(updated);
    } catch (e) {
      console.error("Analysis error:", e);
    } finally {
      setIsAnalyzing(false);
      setAnalyzeProgress(0);
    }
  }, [gameId, game, isAnalyzing]);

  // Load game data
  useEffect(() => {
    async function fetchGame() {
      try {
        const res = await fetch(`/api/games/${gameId}`);
        if (!res.ok) throw new Error("Game not found");
        const data = await res.json();
        setGame(data);
        // Start at the end (show final position)
        setCurrentMoveIndex(data.moveHistory.length - 1);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load game");
      } finally {
        setLoading(false);
      }
    }
    fetchGame();
  }, [gameId]);

  // Replay board up to currentMoveIndex
  const { board, lastMove } = useMemo(() => {
    if (!game) {
      return { board: createInitialBoard(), lastMove: null };
    }

    const replayBoard = createInitialBoard();
    let last: { from: { row: number; col: number }; to: { row: number; col: number } } | null = null;

    for (let i = 0; i <= currentMoveIndex && i < game.moveHistory.length; i++) {
      const m = game.moveHistory[i];
      const move: Move = {
        from: { row: m.from.row, col: m.from.col },
        to: { row: m.to.row, col: m.to.col },
        captured: m.captured
          ? { type: m.captured.type as PieceType, color: m.captured.color as Color }
          : null,
      };
      applyMove(replayBoard, move);
      last = { from: m.from, to: m.to };
    }

    return { board: replayBoard, lastMove: last };
  }, [game, currentMoveIndex]);

  const totalMoves = game?.moveHistory.length ?? 0;

  // Navigation
  const goToFirst = useCallback(() => setCurrentMoveIndex(-1), []);
  const goToPrev = useCallback(() => setCurrentMoveIndex((i) => Math.max(-1, i - 1)), []);
  const goToNext = useCallback(() => setCurrentMoveIndex((i) => Math.min(totalMoves - 1, i + 1)), [totalMoves]);
  const goToLast = useCallback(() => setCurrentMoveIndex(totalMoves - 1), [totalMoves]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goToPrev();
      else if (e.key === "ArrowRight") goToNext();
      else if (e.key === "Home") goToFirst();
      else if (e.key === "End") goToLast();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [goToPrev, goToNext, goToFirst, goToLast]);

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-stone-950 gap-4">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
        <p className="text-stone-400">Loading game...</p>
      </main>
    );
  }

  if (error || !game) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-stone-950 gap-4">
        <p className="text-red-400">{error || "Game not found"}</p>
        <Link href="/history" className="text-amber-400 hover:underline">
          Back to History
        </Link>
      </main>
    );
  }

  const isInitial = currentMoveIndex === -1;
  const isFinal = currentMoveIndex >= totalMoves - 1;

  return (
    <main className="min-h-screen bg-stone-950 p-4 flex flex-col items-center gap-4">
      {/* Top bar */}
      <div className="w-full max-w-4xl flex items-center justify-between">
        <Link href="/history" className="text-stone-500 hover:text-amber-400 transition-colors flex items-center gap-1 text-sm">
          <ArrowLeft className="w-4 h-4" />
          History
        </Link>

        <div className="text-center">
          <h1 className="text-lg font-semibold text-amber-400">Game Review</h1>
          <p className="text-xs text-stone-500">
            {game.playerRed?.displayName || "Red"} vs{" "}
            {game.playerBlack?.displayName ||
              (game.mode === "human_vs_ai" ? "AI" : "Black")}
            {" · "}
            {RESULT_LABELS[game.result] || game.result}
          </p>
        </div>

        <div className="w-20" /> {/* spacer */}
      </div>

      {/* Main content: board + move list */}
      <div className="flex flex-col md:flex-row gap-4 items-start justify-center w-full max-w-4xl">
        {/* Board */}
        <div className="flex-shrink-0">
          <Board
            board={board}
            readonly
            lastMove={lastMove}
          />
        </div>

        {/* Move list + controls */}
        <div className="flex flex-col gap-3 w-full md:w-64">
          {/* Navigation controls */}
          <div className="flex items-center justify-center gap-1 bg-stone-900 rounded-xl p-2">
            <button
              onClick={goToFirst}
              disabled={isInitial}
              className="p-1.5 rounded-lg text-stone-400 hover:text-amber-400 hover:bg-stone-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="First move (Home)"
            >
              <ChevronFirst className="w-5 h-5" />
            </button>
            <button
              onClick={goToPrev}
              disabled={isInitial}
              className="p-1.5 rounded-lg text-stone-400 hover:text-amber-400 hover:bg-stone-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Previous move (←)"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <span className="text-stone-300 text-sm font-mono min-w-[80px] text-center">
              {isInitial ? "Start" : `${currentMoveIndex + 1} / ${totalMoves}`}
            </span>

            <button
              onClick={goToNext}
              disabled={isFinal}
              className="p-1.5 rounded-lg text-stone-400 hover:text-amber-400 hover:bg-stone-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Next move (→)"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <button
              onClick={goToLast}
              disabled={isFinal}
              className="p-1.5 rounded-lg text-stone-400 hover:text-amber-400 hover:bg-stone-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Last move (End)"
            >
              <ChevronLast className="w-5 h-5" />
            </button>
          </div>

          {/* Move slider */}
          {totalMoves > 0 && (
            <input
              type="range"
              min={-1}
              max={totalMoves - 1}
              value={currentMoveIndex}
              onChange={(e) => setCurrentMoveIndex(Number(e.target.value))}
              className="w-full accent-amber-500"
            />
          )}

          {/* Move list */}
          <div className="bg-stone-900 rounded-xl p-2 max-h-[400px] overflow-y-auto">
            {/* Analyze button */}
            {!game.isAnalyzed && (
              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-amber-600/20 border border-amber-600/40 hover:bg-amber-600/30 px-3 py-2 text-sm text-amber-400 transition-colors mb-2 disabled:opacity-50"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Brain className="w-4 h-4" />
                    Analyze with Pikafish
                  </>
                )}
              </button>
            )}
            {game.isAnalyzed && (
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="text-xs text-green-500">✓ Analyzed</span>
                <button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing}
                  className="p-1 rounded-md text-stone-500 hover:text-amber-400 hover:bg-stone-800 transition-colors disabled:opacity-50"
                  title="Re-analyze with Pikafish"
                >
                  {isAnalyzing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            )}

            {totalMoves === 0 ? (
              <p className="text-stone-600 text-sm text-center py-4">No moves</p>
            ) : (
              <div className="flex flex-col gap-0.5">
                {game.moveHistory.map((move, idx) => {
                  const isCurrent = idx === currentMoveIndex;
                  const moveColor =
                    idx % 2 === 0 ? "text-red-400" : "text-stone-300";

                  // Compute evaluation change if analyzed
                  let evalBadge: { text: string; color: string } | null = null;
                  if (move.evaluation && move.evaluation.depth > 0) {
                    const prevEval = idx > 0
                      ? game.moveHistory[idx - 1]?.evaluation?.score ?? 0
                      : 0;
                    const scoreChange = move.evaluation.score - prevEval;
                    // Score is from the perspective of whoever just moved
                    // For the player who moved, a positive change is good
                    const absChange = Math.abs(scoreChange);
                    const cp = (move.evaluation.score / 100).toFixed(1);

                    if (absChange >= 200) {
                      evalBadge = {
                        text: scoreChange > 0 ? `+${cp}` : cp,
                        color: scoreChange > 0
                          ? "bg-green-500/20 text-green-400"
                          : "bg-red-500/20 text-red-400",
                      };
                    } else if (absChange >= 50) {
                      evalBadge = {
                        text: scoreChange > 0 ? `+${cp}` : cp,
                        color: scoreChange > 0
                          ? "bg-green-500/10 text-green-300"
                          : "bg-red-500/10 text-red-300",
                      };
                    } else {
                      evalBadge = {
                        text: cp,
                        color: "bg-stone-800 text-stone-500",
                      };
                    }
                  }

                  return (
                    <button
                      key={idx}
                      onClick={() => setCurrentMoveIndex(idx)}
                      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-left transition-colors ${
                        isCurrent
                          ? "bg-amber-600/20 border border-amber-500/40"
                          : "hover:bg-stone-800 border border-transparent"
                      }`}
                    >
                      <span className="text-stone-600 text-xs w-6 flex-shrink-0">
                        {move.moveNumber}.
                      </span>
                      <span className={moveColor}>{move.notation}</span>
                      {move.captured && (
                        <span className="text-red-500 text-xs">×</span>
                      )}
                      {move.evaluation?.bestMoveNotation && (
                        <span className="text-stone-600 text-xs font-mono whitespace-nowrap" title="Pikafish best move">
                          →{move.evaluation.bestMoveNotation}
                        </span>
                      )}
                      <span className="flex-1" />
                      {evalBadge && (
                        <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${evalBadge.color}`}>
                          {evalBadge.text}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
