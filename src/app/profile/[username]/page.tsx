"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { PlayerInfo } from "@/hooks/usePlayer";

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const username = params.username as string;
  const [player, setPlayer] = useState<PlayerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchPlayer() {
      try {
        const res = await fetch(`/api/player/${encodeURIComponent(username)}`);
        if (!res.ok) throw new Error("Player not found");
        const data = await res.json();
        setPlayer(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load profile");
      } finally {
        setLoading(false);
      }
    }
    fetchPlayer();
  }, [username]);

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-stone-950">
        <p className="text-stone-400">Loading profile...</p>
      </main>
    );
  }

  if (error || !player) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-stone-950">
        <p className="text-red-400 mb-4">{error || "Player not found"}</p>
        <button
          onClick={() => router.push("/")}
          className="text-amber-400 hover:underline"
        >
          Back to Home
        </button>
      </main>
    );
  }

  const winRate =
    player.gamesPlayed > 0
      ? Math.round((player.gamesWon / player.gamesPlayed) * 100)
      : 0;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-stone-950">
      <Link href="/" className="absolute top-4 left-4 text-stone-500 hover:text-amber-400 transition-colors text-sm">
        ← Home
      </Link>

      <div className="bg-stone-900 border border-stone-700 rounded-2xl p-8 w-80">
        {/* Avatar placeholder */}
        <div className="w-20 h-20 rounded-full bg-amber-600/20 border-2 border-amber-500 flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl font-bold text-amber-400">
            {player.username.charAt(0).toUpperCase()}
          </span>
        </div>

        <h1 className="text-2xl font-bold text-amber-400 text-center mb-1">
          {player.displayName}
        </h1>
        <p className="text-stone-500 text-sm text-center mb-6">
          @{player.username}
        </p>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-stone-800 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-stone-200">{player.gamesPlayed}</p>
            <p className="text-xs text-stone-500">Games</p>
          </div>
          <div className="bg-stone-800 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-stone-200">{winRate}%</p>
            <p className="text-xs text-stone-500">Win Rate</p>
          </div>
          <div className="bg-stone-800 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-green-400">{player.gamesWon}</p>
            <p className="text-xs text-stone-500">Wins</p>
          </div>
          <div className="bg-stone-800 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-red-400">{player.gamesLost}</p>
            <p className="text-xs text-stone-500">Losses</p>
          </div>
          <div className="bg-stone-800 rounded-xl p-3 text-center col-span-2">
            <p className="text-2xl font-bold text-stone-400">{player.gamesDrawn}</p>
            <p className="text-xs text-stone-500">Draws</p>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex gap-3">
          <Link
            href="/history"
            className="flex-1 text-center rounded-xl bg-stone-800 border border-stone-600 px-4 py-2 text-sm text-stone-300 hover:border-amber-500 hover:text-amber-400 transition-all"
          >
            Game History
          </Link>
          <Link
            href="/"
            className="flex-1 text-center rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500 transition-all"
          >
            Play
          </Link>
        </div>
      </div>
    </main>
  );
}
