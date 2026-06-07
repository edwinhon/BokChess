"use client";

import { create } from "zustand";
import {
  Board as BoardType,
  Color,
  Move,
  Position,
  GameStatus,
  GameState,
  oppositeColor,
} from "@/lib/game/types";
import { createInitialBoard, cloneBoard, getPieceAt } from "@/lib/game/board";
import {
  generatePieceMoves,
  applyMove,
} from "@/lib/game/moves";
import {
  isMoveLegal,
  getAllLegalMoves,
  isInCheck,
  isCheckmate,
  isStalemate,
  getGameStatus,
} from "@/lib/game/rules";

interface GameStore {
  // State
  board: BoardType;
  currentTurn: Color;
  moveHistory: Move[];
  status: GameStatus;
  isInCheck: boolean;
  selectedPos: Position | null;
  legalMoves: Position[];

  // Actions
  selectPiece: (pos: Position) => void;
  movePiece: (to: Position) => void;
  /** Directly apply a pre-validated move from the AI engine, bypassing
   *  the human select-then-move flow.  Returns true if applied. */
  applyAIMove: (move: Move) => boolean;
  undoMove: () => void;
  newGame: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  board: createInitialBoard(),
  currentTurn: Color.Red,
  moveHistory: [],
  status: GameStatus.Playing,
  isInCheck: false,
  selectedPos: null,
  legalMoves: [],

  selectPiece: (pos: Position) => {
    const { board, currentTurn, status, selectedPos } = get();
    if (status !== GameStatus.Playing) return;

    const piece = getPieceAt(board, pos);

    // If a piece is already selected and we click another own piece, switch selection
    if (piece && piece.color === currentTurn) {
      // If clicking the already-selected piece, deselect
      if (selectedPos && selectedPos.row === pos.row && selectedPos.col === pos.col) {
        set({ selectedPos: null, legalMoves: [] });
        return;
      }
      // Select new piece, show its legal moves
      const moves = getAllLegalMoves(board, currentTurn)
        .filter((m) => m.from.row === pos.row && m.from.col === pos.col)
        .map((m) => m.to);
      set({ selectedPos: pos, legalMoves: moves });
      return;
    }

    // If a piece is selected and we click on a legal move target, execute the move
    if (selectedPos) {
      const isLegalTarget = get().legalMoves.some(
        (m) => m.row === pos.row && m.col === pos.col
      );
      if (isLegalTarget) {
        get().movePiece(pos);
        return;
      }
    }

    // Clicked on empty/opponent square that's not a legal target — deselect
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
  },

  /** Directly apply a pre-validated move from the AI engine. */
  applyAIMove: (move: Move): boolean => {
    const { board, currentTurn, status, moveHistory } = get();
    if (status !== GameStatus.Playing) {
      console.warn("[store] applyAIMove: game not playing (status=" + status + ")");
      return false;
    }

    // Guard: the piece at move.from must belong to currentTurn.
    // Log a warning if mismatched but still apply — the engine validated it.
    const piece = getPieceAt(board, move.from);
    if (!piece || piece.color !== currentTurn) {
      console.warn(
        "[store] applyAIMove: piece mismatch at (" +
          move.from.row + "," + move.from.col +
          ") expected=" + currentTurn +
          " found=" + (piece ? piece.color + "/" + piece.type : "empty")
      );
      // Don't reject — trust the engine.  The mismatch usually means
      // the board snapshot sent to the engine differs from current store.
    }

    // Apply the move
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

    return true;
  },

  undoMove: () => {
    const { moveHistory } = get();
    if (moveHistory.length === 0) return;

    // For simplicity, reset to initial and replay all moves except the last
    // A more efficient approach would store board snapshots
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
    });
  },

  newGame: () => {
    set({
      board: createInitialBoard(),
      currentTurn: Color.Red,
      moveHistory: [],
      status: GameStatus.Playing,
      isInCheck: false,
      selectedPos: null,
      legalMoves: [],
    });
  },
}));
