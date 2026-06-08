"use client";

import { create } from "zustand";

export interface PlayerInfo {
  id: string;
  username: string;
  displayName: string;
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  gamesDrawn: number;
}

interface PlayerStore {
  player: PlayerInfo | null;
  isLoading: boolean;
  error: string | null;

  /** Register or login with a username. Returns the player info. */
  login: (username: string) => Promise<PlayerInfo>;
  /** Load player from localStorage and verify with server. */
  loadFromStorage: () => Promise<void>;
  /** Clear current player (logout). */
  logout: () => void;
}

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  player: null,
  isLoading: false,
  error: null,

  login: async (username: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch("/api/player/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to register");
      }
      const player: PlayerInfo = await res.json();
      localStorage.setItem("bokchess-username", player.username);
      set({ player, isLoading: false });
      return player;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      set({ isLoading: false, error: msg });
      throw e;
    }
  },

  loadFromStorage: async () => {
    const saved = localStorage.getItem("bokchess-username");
    if (!saved) {
      set({ isLoading: false });
      return;
    }
    set({ isLoading: true });
    try {
      const res = await fetch(`/api/player/${encodeURIComponent(saved)}`);
      if (!res.ok) throw new Error("Player not found");
      const player: PlayerInfo = await res.json();
      set({ player, isLoading: false });
    } catch {
      // If server can't find the player, clear localStorage
      localStorage.removeItem("bokchess-username");
      set({ player: null, isLoading: false });
    }
  },

  logout: () => {
    localStorage.removeItem("bokchess-username");
    set({ player: null, error: null });
  },
}));
