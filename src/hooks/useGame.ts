"use client";

import { create } from "zustand";
import {
  Board as BoardType,
  Color,
  Move,
  Position,
  GameStatus,
  oppositeColor,
  Piece,
} from "@/lib/game/types";
import { createInitialBoard, cloneBoard, getPieceAt } from "@/lib/game/board";
import {
  applyMove,
} from "@/lib/game/moves";
import {
  isMoveLegal,
  getAllLegalMoves,
  isInCheck,
  getGameStatus,
} from "@/lib/game/rules";
import { encodeMove } from "@/lib/game/notation";

// ─── Notation record for each move ─────────────────────────────
interface MoveNotation {
  moveNumber: number;
  from: { row: number; col: number };
  to: { row: number; col: number };
  captured: { type: string; color: string } | null;
  notation: string;
}

interface GameStore {
  // Board state
  board: BoardType;
  currentTurn: Color;
  moveHistory: Move[];
  status: GameStatus;
  isInCheck: boolean;
  selectedPos: Position | null;
  legalMoves: Position[];

  // Game metadata
  playerRedId: string | null;
  playerBlackId: string | null;
  mode: string | null; // "human_vs_human" | "human_vs_ai" | "online"
  aiDifficulty: string | null;
  isSaved: boolean;
  savedGameId: string | null;

  // Actions
  selectPiece: (pos: Position) => void;
  movePiece: (to: Position) => void;
  applyAIMove: (move: Move) => boolean;
  undoMove: () => void;
  /** Initialize a new game with metadata. */
  initGame: (options: {
    playerRedId?: string;
    playerBlackId?: string;
    mode?: string;
    aiDifficulty?: string;
  }) => void;
  /** Save the current game record to the server. Returns the game ID. */
  saveGameRecord: () => Promise<string | null>;
}

export const useGameStore = create<GameStore>((set, get) => ({
  board: createInitialBoard(),
  currentTurn: Color.Red,
  moveHistory: [],
  status: GameStatus.Playing,
  isInCheck: false,
  selectedPos: null,
  legalMoves: [],
  playerRedId: null,
  playerBlackId: null,
  mode: null,
  aiDifficulty: null,
  isSaved: false,
  savedGameId: null,

  selectPiece: (pos: Position) => {
    const { board, currentTurn, status, selectedPos } = get();
    if (status !== GameStatus.Playing) return;

    const piece = getPieceAt(board, pos);

    if (piece && piece.color === currentTurn) {
      if (selectedPos && selectedPos.row === pos.row && selectedPos.col === pos.col) {
        set({ selectedPos: null, legalMoves: [] });
        return;
      }
      const moves = getAllLegalMoves(board, currentTurn)
        .filter((m) => m.from.row === pos.row && m.from.col === pos.col)
        .map((m) => m.to);
      set({ selectedPos: pos, legalMoves: moves });
      return;
    }

    if (selectedPos) {
      const isLegalTarget = get().legalMoves.some(
        (m) => m.row === pos.row && m.col === pos.col
      );
      if (isLegalTarget) {
        get().movePiece(pos);
        return;
      }
    }

    set({ selectedPos: null, legalMoves: [] });
  },

  movePiece: (to: Position) => {
    const { board, currentTurn, moveHistory, status, selectedPos } = get();
    if (status !== GameStatus.Playing || !selectedPos) return;

    if (!isMoveLegal(board, selectedPos, to, currentTurn)) return;

    const captured = board[to.row][to.col];
    const move: Move = {
      from: { ...selectedPos },
      to: { ...to },
      captured: captured ? { ...captured } : null,
    };

    const newBoard = cloneBoard(board);
    applyMove(newBoard, move);

    const nextTurn = oppositeColor(currentTurn);
    const inCheck = isInCheck(newBoard, nextTurn);
    const newStatus = getGameStatus(newBoard, currentTurn);

    set({
      board: newBoard,
      currentTurn: nextTurn,
      moveHistory: [...moveHistory, move],
      status: newStatus,
      isInCheck: inCheck,
      selectedPos: null,
      legalMoves: [],
    });

    // Auto-save if game just ended
    if (newStatus !== GameStatus.Playing && !get().isSaved) {
      get().saveGameRecord();
    }
  },

  /** Directly apply a pre-validated move from the AI engine. */
  applyAIMove: (move: Move): boolean => {
    const { board, currentTurn, status, moveHistory } = get();
    if (status !== GameStatus.Playing) {
      console.warn("[store] applyAIMove: game not playing (status=" + status + ")");
      return false;
    }

    const piece = getPieceAt(board, move.from);
    if (!piece || piece.color !== currentTurn) {
      console.warn(
        "[store] applyAIMove: piece mismatch at (" +
          move.from.row + "," + move.from.col +
          ") expected=" + currentTurn +
          " found=" + (piece ? piece.color + "/" + piece.type : "empty")
      );
    }

    const newBoard = cloneBoard(board);
    applyMove(newBoard, move);

    const nextTurn = oppositeColor(currentTurn);
    const inCheck = isInCheck(newBoard, nextTurn);
    const newStatus = getGameStatus(newBoard, currentTurn);

    set({
      board: newBoard,
      currentTurn: nextTurn,
      moveHistory: [...moveHistory, move],
      status: newStatus,
      isInCheck: inCheck,
      selectedPos: null,
      legalMoves: [],
    });

    // Auto-save if game just ended
    if (newStatus !== GameStatus.Playing && !get().isSaved) {
      get().saveGameRecord();
    }

    return true;
  },

  undoMove: () => {
    const { moveHistory } = get();
    if (moveHistory.length === 0) return;

    const newBoard = createInitialBoard();
    const moves = moveHistory.slice(0, -1);

    for (const move of moves) {
      applyMove(newBoard, move);
    }

    const nextTurn = moves.length % 2 === 0 ? Color.Red : Color.Black;
    const inCheck = isInCheck(newBoard, nextTurn);

    set({
      board: newBoard,
      currentTurn: nextTurn,
      moveHistory: moves,
      status: GameStatus.Playing,
      isInCheck: inCheck,
      selectedPos: null,
      legalMoves: [],
      isSaved: false,
    });
  },

  initGame: (options) => {
    set({
      board: createInitialBoard(),
      currentTurn: Color.Red,
      moveHistory: [],
      status: GameStatus.Playing,
      isInCheck: false,
      selectedPos: null,
      legalMoves: [],
      playerRedId: options.playerRedId || null,
      playerBlackId: options.playerBlackId || null,
      mode: options.mode || null,
      aiDifficulty: options.aiDifficulty || null,
      isSaved: false,
      savedGameId: null,
    });
  },

  /** Generate notation for all moves and save the game record. */
  saveGameRecord: async (): Promise<string | null> => {
    const state = get();
    if (state.isSaved || state.status === GameStatus.Playing) return null;
    if (!state.playerRedId || !state.mode) return null;

    // Generate notation by replaying from initial board
    const replayBoard = createInitialBoard();
    const notations: MoveNotation[] = [];

    for (let i = 0; i < state.moveHistory.length; i++) {
      const move = state.moveHistory[i];
      const piece = getPieceAt(replayBoard, move.from);
      if (piece) {
        const notation = encodeMove(move, piece, replayBoard);
        notations.push({
          moveNumber: i + 1,
          from: { row: move.from.row, col: move.from.col },
          to: { row: move.to.row, col: move.to.col },
          captured: move.captured
            ? { type: move.captured.type, color: move.captured.color }
            : null,
          notation,
        });
      }
      applyMove(replayBoard, move);
    }

    try {
      const res = await fetch("/api/games/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerRedId: state.playerRedId,
          playerBlackId: state.playerBlackId || undefined,
          mode: state.mode,
          aiDifficulty: state.aiDifficulty || undefined,
          result: state.status,
          moveHistory: notations,
        }),
      });

      if (!res.ok) {
        console.error("[useGame] save failed:", await res.text());
        return null;
      }

      const data = await res.json();
      set({ isSaved: true, savedGameId: data.id });
      return data.id;
    } catch (err) {
      console.error("[useGame] save error:", err);
      return null;
    }
  },
}));
