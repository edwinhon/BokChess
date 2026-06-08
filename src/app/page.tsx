"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GameMode, AIDifficulty, AI_DIFFICULTY_CONFIG } from "@/lib/game/types";
import { usePlayerStore } from "@/hooks/usePlayer";

export default function Home() {
  const router = useRouter();
  const { player, isLoading, login, logout } = usePlayerStore();
  const [usernameInput, setUsernameInput] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [selectedMode, setSelectedMode] = useState<GameMode | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<AIDifficulty>(
    AIDifficulty.Medium
  );

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameInput.trim()) return;
    setIsLoggingIn(true);
    setLoginError("");
    try {
      await login(usernameInput.trim());
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleStart = () => {
    if (selectedMode === GameMode.HumanVsHuman) {
      router.push("/game/local?mode=human");
    } else if (selectedMode === GameMode.HumanVsAI) {
      router.push(`/game/local?mode=ai&difficulty=${selectedDifficulty}`);
    }
  };

  const handleOnline = () => {
    router.push("/game/online");
  };

  // ── Loading state ───────────────────────────────────────────
  if (isLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-stone-950">
        <p className="text-stone-400 text-lg">Loading...</p>
      </main>
    );
  }

  // ── Login screen (no player yet) ────────────────────────────
  if (!player) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-stone-950">
        <h1 className="text-5xl font-bold text-amber-400 mb-2">BokChess</h1>
        <p className="text-xl text-stone-400 mb-10">Chinese Chess • 象棋</p>

        <form onSubmit={handleLogin} className="flex flex-col gap-4 w-72">
          <label className="text-stone-300 text-sm font-medium">
            Enter a username to get started
          </label>
          <input
            type="text"
            value={usernameInput}
            onChange={(e) => setUsernameInput(e.target.value)}
            placeholder="Your username"
            maxLength={20}
            minLength={2}
            className="rounded-xl bg-stone-800 border-2 border-stone-600 px-4 py-3 text-stone-200 placeholder-stone-500 focus:outline-none focus:border-amber-500 transition-colors"
            autoFocus
            disabled={isLoggingIn}
          />
          {loginError && (
            <p className="text-red-400 text-sm">{loginError}</p>
          )}
          <button
            type="submit"
            disabled={isLoggingIn || usernameInput.trim().length < 2}
            className="rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 px-6 py-3 text-lg font-bold text-white hover:from-amber-500 hover:to-amber-400 transition-all shadow-lg shadow-amber-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoggingIn ? "Signing in..." : "Enter"}
          </button>
        </form>
      </main>
    );
  }

  // ── Main menu (logged in) ───────────────────────────────────
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-stone-950">
      {/* Player header */}
      <div className="absolute top-4 right-4 flex items-center gap-3">
        <button
          onClick={() => router.push(`/profile/${player.username}`)}
          className="text-stone-400 hover:text-amber-400 transition-colors text-sm"
        >
          {player.username}
        </button>
        <button
          onClick={() => router.push("/history")}
          className="text-stone-500 hover:text-stone-300 transition-colors text-sm"
        >
          History
        </button>
        <button
          onClick={logout}
          className="text-stone-600 hover:text-red-400 transition-colors text-xs"
        >
          Logout
        </button>
      </div>

      <h1 className="text-5xl font-bold text-amber-400 mb-2">BokChess</h1>
      <p className="text-xl text-stone-400 mb-10">Chinese Chess • 象棋</p>

      {/* Mode Selection */}
      <div className="flex flex-col gap-3 w-72">
        {/* Human vs Human */}
        <button
          onClick={() => setSelectedMode(GameMode.HumanVsHuman)}
          className={`rounded-xl px-6 py-5 text-lg font-semibold transition-all border-2 ${
            selectedMode === GameMode.HumanVsHuman
              ? "bg-amber-600/20 border-amber-500 text-amber-400 shadow-lg shadow-amber-500/20"
              : "bg-stone-800 border-stone-700 text-stone-300 hover:border-stone-500"
          }`}
        >
          <span className="text-2xl block mb-1">👥</span>
          Human vs Human
          <span className="block text-xs text-stone-500 mt-1">
            Two players on one device
          </span>
        </button>

        {/* Human vs AI */}
        <button
          onClick={() => setSelectedMode(GameMode.HumanVsAI)}
          className={`rounded-xl px-6 py-5 text-lg font-semibold transition-all border-2 ${
            selectedMode === GameMode.HumanVsAI
              ? "bg-amber-600/20 border-amber-500 text-amber-400 shadow-lg shadow-amber-500/20"
              : "bg-stone-800 border-stone-700 text-stone-300 hover:border-stone-500"
          }`}
        >
          <span className="text-2xl block mb-1">🤖</span>
          Human vs AI
          <span className="block text-xs text-stone-500 mt-1">
            Play against the computer
          </span>
        </button>

        {/* AI Difficulty Selector */}
        {selectedMode === GameMode.HumanVsAI && (
          <div className="flex gap-2 mt-1">
            {Object.values(AIDifficulty).map((diff) => {
              const config = AI_DIFFICULTY_CONFIG[diff];
              const isSelected = selectedDifficulty === diff;
              return (
                <button
                  key={diff}
                  onClick={() => setSelectedDifficulty(diff)}
                  className={`flex-1 rounded-lg px-3 py-3 text-sm font-semibold transition-all border-2 ${
                    isSelected
                      ? "bg-amber-500/20 border-amber-400 text-amber-300"
                      : "bg-stone-800 border-stone-600 text-stone-400 hover:border-stone-500"
                  }`}
                >
                  <span className="block text-lg">{config.label.replace(/ .*/, "")}</span>
                  <span className="text-xs opacity-70">{config.label.match(/[🟢🟡🔴]/)?.[0]}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Start Button */}
        {selectedMode && (
          <button
            onClick={handleStart}
            className="rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 px-6 py-4 text-lg font-bold text-white hover:from-amber-500 hover:to-amber-400 transition-all shadow-lg shadow-amber-600/30 mt-2"
          >
            {selectedMode === GameMode.HumanVsAI
              ? `Start Game — ${AI_DIFFICULTY_CONFIG[selectedDifficulty].label}`
              : "Start Game"}
          </button>
        )}

        {/* Divider */}
        <div className="flex items-center gap-3 my-2">
          <div className="flex-1 h-px bg-stone-700" />
          <span className="text-stone-500 text-xs">or</span>
          <div className="flex-1 h-px bg-stone-700" />
        </div>

        {/* Online */}
        <button
          onClick={handleOnline}
          className="rounded-xl bg-stone-800 border-2 border-stone-700 px-6 py-4 text-lg font-semibold text-stone-400 hover:border-stone-500 hover:text-stone-300 transition-all"
        >
          <span className="text-xl block mb-1">🌐</span>
          Play Online
        </button>
      </div>
    </main>
  );
}
