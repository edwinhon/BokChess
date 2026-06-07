// AI Web Worker — runs search in a separate thread to avoid blocking UI

import { Board, Color, Move } from "@/lib/game/types";
import { search } from "@/lib/ai/search";
import { getBookMove, isInBook } from "@/lib/ai/opening";
import { transpositionTable } from "@/lib/ai/transposition";

interface WorkerMessage {
  type: "search" | "clear";
  id?: number;
  board?: Board;
  color?: Color;
  moveNumber?: number;
  maxDepth?: number;
  timeLimitMs?: number;
}

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data;

  if (msg.type === "clear") {
    transpositionTable.clear();
    return;
  }

  if (msg.type === "search" && msg.board && msg.color !== undefined) {
    const sendId = msg.id;
    try {
      // Check opening book first (validates legality against current board)
      const moveNum = msg.moveNumber ?? 0;
      if (isInBook(moveNum)) {
        const bookMove = getBookMove(moveNum, msg.board, msg.color);
        if (bookMove) {
          self.postMessage({
            id: sendId,
            type: "result",
            move: bookMove,
            score: 0,
            nodesSearched: 0,
            depthReached: 0,
            fromBook: true,
          });
          return;
        }
      }

      // Run search
      const result = search(msg.board, msg.color, {
        maxDepth: msg.maxDepth ?? 4,
        timeLimitMs: msg.timeLimitMs ?? 3000,
      });

      self.postMessage({
        id: sendId,
        type: "result",
        move: result.move,
        score: result.score,
        nodesSearched: result.nodesSearched,
        depthReached: result.depthReached,
        fromBook: false,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      self.postMessage({ id: sendId, type: "error", error: message });
    }
  }
};
