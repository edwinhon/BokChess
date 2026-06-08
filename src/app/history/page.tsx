"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePlayerStore } from "@/hooks/usePlayer";

interface GameSummary {
  id: string;
  createdAt: string;
  playerRed: { username: string; displayName: string } | null;
  playerBlack: { username: string; displayName: string } | null;
  mode: string;
  aiDifficulty: string | null;
  result: string;
  moveCount: number;
  isAnalyzed: boolean;
}

const MODE_LABELS: Record<string, string> = {
  human_vs_human: "👥 vs Human",
  human_vs_ai: "🤖 vs AI",
  online: "🌐 Online",
};

const RESULT_LABELS: Record<string, { text: string; color: string }> = {
  red_wins: { text: "Red Wins", color: "text-red-400" },
  black_wins: { text: "Black Wins", color: "text-stone-400" },
  stalemate: { text: "Draw", color: "text-amber-400" },
};

export default function HistoryPage() {
  const router = useRouter();
  const player = usePlayerStore((s) => s.player);
  const [games, setGames] = useState<GameSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!player) {
      router.push("/");
      return;
    }

    async function fetchGames() {
      try {
        const res = await fetch(
          `/api/games?username=${encodeURIComponent(player!.username)}`
        );
        if (!res.ok) throw new Error("Failed to load games");
        const data = await res.json();
        setGames(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load games");
      } finally {
        setLoading(false);
      }
    }
    fetchGames();
  }, [player, router]);

  if (!player) return null;

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-stone-950">
        <p className="text-stone-400">Loading games...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-stone-950 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link href="/" className="text-stone-500 hover:text-amber-400 transition-colors text-sm">
            ← Home
          </Link>
          <h1 className="text-2xl font-bold text-amber-400">Game History · 棋譜</h1>
          <Link
            href={`/profile/${player.username}`}
            className="text-stone-500 hover:text-amber-400 transition-colors text-sm"
          >
            Profile →
          </Link>
        </div>

        {error && (
          <p className="text-red-400 text-center mb-4">{error}</p>
        )}

        {games.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-stone-500 text-lg mb-4">No games yet</p>
            <Link
              href="/"
              className="text-amber-400 hover:underline"
            >
              Play your first game →
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {games.map((game) => {
              const result = RESULT_LABELS[game.result] || {
                text: game.result,
                color: "text-stone-400",
              };
              const date = new Date(game.createdAt).toLocaleDateString("zh-CN", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <button
                  key={game.id}
                  onClick={() => router.push(`/game/review/${game.id}`)}
                  className="flex items-center gap-4 rounded-xl bg-stone-900 border border-stone-800 hover:border-amber-600/40 transition-all p-4 text-left group"
                >
                  {/* Result indicator */}
                  <div
                    className={`w-2 h-10 rounded-full flex-shrink-0 ${
                      game.result === "red_wins"
                        ? "bg-red-500"
                        : game.result === "black_wins"
                          ? "bg-stone-500"
                          : "bg-amber-500"
                    }`}
                  />

                  {/* Game info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-stone-200 font-medium truncate">
                        {game.playerRed?.displayName || "Red"}
                      </span>
                      <span className="text-stone-600 text-xs">vs</span>
                      <span className="text-stone-300 font-medium truncate">
                        {game.playerBlack?.displayName ||
                          (game.mode === "human_vs_ai" ? "AI" : "Black")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs font-semibold ${result.color}`}>
                        {result.text}
                      </span>
                      <span className="text-stone-600 text-xs">·</span>
                      <span className="text-stone-500 text-xs">
                        {game.moveCount} moves
                      </span>
                      <span className="text-stone-600 text-xs">·</span>
                      <span className="text-stone-500 text-xs">
                        {MODE_LABELS[game.mode] || game.mode}
                      </span>
                      {game.aiDifficulty && (
                        <>
                          <span className="text-stone-600 text-xs">·</span>
                          <span className="text-stone-500 text-xs capitalize">
                            {game.aiDifficulty}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Date + analyze badge */}
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="text-stone-600 text-xs">{date}</span>
                    {game.isAnalyzed && (
                      <span className="text-xs text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded">
                        Analyzed
                      </span>
                    )}
                  </div>

                  {/* Arrow */}
                  <span className="text-stone-700 group-hover:text-amber-400 transition-colors text-lg">
                    →
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
