"use client";

import { useRef, useCallback, useState } from "react";
import { Board, Color, Move } from "@/lib/game/types";

interface AIResult {
  move: Move | null;
  score: number;
  nodesSearched: number;
  depthReached: number;
  fromBook: boolean;
  error?: string;
}

export interface AIRequestResult {
  move: Move | null;
  score: number;
  depth: number;
  nodesSearched: number;
  fromBook: boolean;
}

export interface HintEntry {
  move: Move | null;
  score: number;
  depth: number;
  pv: string[];
  rank: number; // 1 = best, 2 = second, 3 = third
}

export interface HintResult {
  hints: HintEntry[];
  nodesSearched: number;
  timeMs: number;
}

interface UseAIResult {
  isThinking: boolean;
  lastResult: AIResult | null;
  lastError: string | null;
  /** Whether a hint request is currently in flight */
  isHintLoading: boolean;
  /** Last hint result */
  lastHint: HintResult | null;
  requestMove: (
    board: Board,
    color: Color,
    moveNumber: number,
    options?: { skillLevel?: number; moveTime?: number; depth?: number }
  ) => Promise<AIRequestResult | null>;
  /** Request top 3 moves from Pikafish (MultiPV mode) */
  requestHint: (
    board: Board,
    color: Color,
    moveNumber: number,
    moveTime?: number
  ) => Promise<HintResult | null>;
  clearCache: () => void;
  clearHint: () => void;
}

/**
 * AI hook that calls the server-side Pikafish engine via the /api/ai endpoint.
 *
 * Pikafish is a UCI-compatible Chinese Chess engine (C++) spawned as a
 * child_process on the Next.js server. The API route communicates with it
 * via the UCI protocol, converting our internal board representation to
 * Xiangqi FEN format.
 */
export function useAI(): UseAIResult {
  const [isThinking, setIsThinking] = useState(false);
  const [lastResult, setLastResult] = useState<AIResult | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [isHintLoading, setIsHintLoading] = useState(false);
  const [lastHint, setLastHint] = useState<HintResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const activeRef = useRef(0);

  const requestMove = useCallback(
    async (
      board: Board,
      color: Color,
      moveNumber: number,
      options?: { skillLevel?: number; moveTime?: number; depth?: number }
    ): Promise<AIRequestResult | null> => {
      // Abort any previous in-flight request
      if (abortRef.current) {
        abortRef.current.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;

      setIsThinking(true);
      activeRef.current++;

      try {
        const res = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            board,
            color,
            moveNumber,
            skillLevel: options?.skillLevel ?? 10,
            moveTime: options?.moveTime ?? 3000,
            depth: options?.depth,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          const msg = (body as { error?: string }).error ?? `Server error (${res.status})`;
          setLastError(msg);
          return null;
        }

        const data = (await res.json()) as {
          move: Move | null;
          score: number;
          depth: number;
          nodesSearched: number;
          fromBook: boolean;
          error?: string;
        };

        console.log(
          "[ai] API response: move=" +
            (data.move
              ? "(" + data.move.from.row + "," + data.move.from.col + ")->(" +
                data.move.to.row + "," + data.move.to.col + ")"
              : String(data.move)) +
            " score=" + data.score +
            " depth=" + data.depth +
            " error=" + (data.error ?? "none")
        );

        if (data.error) {
          setLastError(data.error);
          console.error("[ai] API returned error:", data.error);
          return null;
        }

        const result: AIRequestResult = {
          move: data.move,
          score: data.score,
          nodesSearched: data.nodesSearched,
          depth: data.depth,
          fromBook: data.fromBook,
        };

        setLastResult({
          move: data.move,
          score: data.score,
          nodesSearched: data.nodesSearched,
          depthReached: data.depth,
          fromBook: data.fromBook,
        });
        setLastError(null);

        return result;
      } catch (err: unknown) {
        if ((err as Error).name === "AbortError") return null;
        const msg = err instanceof Error ? err.message : String(err);
        setLastError(msg);
        return null;
      } finally {
        activeRef.current--;
        if (activeRef.current <= 0) {
          activeRef.current = 0;
          setIsThinking(false);
        }
      }
    },
    []
  );

  const clearCache = useCallback(() => {
    // Pikafish cache is cleared server-side via "ucinewgame" between searches
    // This is a no-op on the client side
  }, []);

  const clearHint = useCallback(() => {
    setLastHint(null);
  }, []);

  const requestHint = useCallback(
    async (
      board: Board,
      color: Color,
      moveNumber: number,
      moveTime?: number
    ): Promise<HintResult | null> => {
      // Abort any previous in-flight request
      if (abortRef.current) {
        abortRef.current.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;

      setIsHintLoading(true);

      try {
        const res = await fetch("/api/ai/hint", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            board,
            color,
            moveNumber,
            moveTime: moveTime ?? 3000,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          const msg = (body as { error?: string }).error ?? `Server error (${res.status})`;
          setLastError(msg);
          return null;
        }

        const data = (await res.json()) as HintResult & { error?: string };

        if (data.error) {
          setLastError(data.error);
          return null;
        }

        setLastHint(data);
        setLastError(null);

        console.log(
          "[ai] Hint response: " + data.hints.length + " PVs, nodes=" + data.nodesSearched
        );
        for (const h of data.hints) {
          console.log(
            "[ai]   PV#" + h.rank +
            " move=" + (h.move
              ? "(" + h.move.from.row + "," + h.move.from.col + ")->(" + h.move.to.row + "," + h.move.to.col + ")"
              : "null") +
            " score=" + h.score
          );
        }

        return data;
      } catch (err: unknown) {
        if ((err as Error).name === "AbortError") return null;
        const msg = err instanceof Error ? err.message : String(err);
        setLastError(msg);
        return null;
      } finally {
        setIsHintLoading(false);
      }
    },
    []
  );

  return { isThinking, lastResult, lastError, isHintLoading, lastHint, requestMove, requestHint, clearCache, clearHint };
}
