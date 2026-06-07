import { Board, Color, PieceType, Position, BOARD_ROWS, BOARD_COLS, PIECE_VALUES } from "@/lib/game/types";
import { getAllPieces } from "@/lib/game/moves";
import { isInCheck } from "@/lib/game/rules";
import { oppositeColor } from "@/lib/game/types";

// ─── Piece-Square Tables ──────────────────────────────────────
// Positive values favor the evaluating side.
// These tables are from Red's perspective (row 0 = opponent's back rank, row 9 = own back rank).
// For Black, the table is flipped vertically.

// General: stay in palace center
const GENERAL_TABLE: number[][] = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 1, 1, 1, 0, 0, 0],
  [0, 0, 0, 2, 2, 2, 0, 0, 0],
  [0, 0, 0, 2, 3, 2, 0, 0, 0],
];

// Advisor: stay near center of palace
const ADVISOR_TABLE: number[][] = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 2, 0, 0, 0, 0],
  [0, 0, 0, 1, 0, 1, 0, 0, 0],
  [0, 0, 0, 0, 3, 0, 0, 0, 0],
];

// Elephant: center-ish, avoid edges
const ELEPHANT_TABLE: number[][] = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 2, 0, 0, 0, 2, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 2, 0, 2, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
];

// Horse: center is better, avoid edges where mobility is limited
const HORSE_TABLE: number[][] = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 1, 2, 2, 2, 2, 2, 1, 0],
  [0, 1, 2, 3, 3, 3, 2, 1, 0],
  [0, 1, 2, 3, 4, 3, 2, 1, 0],
  [0, 1, 2, 3, 4, 3, 2, 1, 0],
  [0, 1, 2, 3, 3, 3, 2, 1, 0],
  [0, 1, 2, 2, 2, 2, 2, 1, 0],
  [0, 0, 1, 1, 1, 1, 1, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
];

// Chariot: open files, center
const CHARIOT_TABLE: number[][] = [
  [1, 2, 2, 2, 2, 2, 2, 2, 1],
  [1, 2, 2, 3, 3, 3, 2, 2, 1],
  [1, 2, 3, 4, 4, 4, 3, 2, 1],
  [1, 2, 3, 4, 5, 4, 3, 2, 1],
  [1, 2, 3, 4, 5, 4, 3, 2, 1],
  [1, 2, 3, 4, 5, 4, 3, 2, 1],
  [1, 2, 3, 4, 4, 4, 3, 2, 1],
  [1, 2, 3, 3, 3, 3, 3, 2, 1],
  [1, 2, 2, 2, 2, 2, 2, 2, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1],
];

// Cannon: similar to chariot but slightly different
const CANNON_TABLE: number[][] = [
  [1, 2, 2, 3, 3, 3, 2, 2, 1],
  [1, 2, 2, 3, 4, 3, 2, 2, 1],
  [1, 2, 3, 4, 5, 4, 3, 2, 1],
  [1, 2, 3, 4, 5, 4, 3, 2, 1],
  [1, 2, 3, 4, 5, 4, 3, 2, 1],
  [1, 2, 3, 4, 5, 4, 3, 2, 1],
  [1, 2, 3, 4, 5, 4, 3, 2, 1],
  [1, 2, 3, 4, 4, 4, 3, 2, 1],
  [1, 2, 2, 3, 3, 3, 2, 2, 1],
  [1, 1, 1, 2, 2, 2, 1, 1, 1],
];

// Soldier: values increase as they advance
const SOLDIER_TABLE_RED: number[][] = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [2, 3, 4, 5, 6, 5, 4, 3, 2],
  [1, 2, 3, 4, 5, 4, 3, 2, 1],
  [0, 1, 2, 3, 3, 3, 2, 1, 0],
  [0, 0, 1, 2, 2, 2, 1, 0, 0],
  [0, 0, 0, 1, 1, 1, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
];

// Positional bonus table map
const PST: Record<PieceType, number[][]> = {
  [PieceType.General]: GENERAL_TABLE,
  [PieceType.Advisor]: ADVISOR_TABLE,
  [PieceType.Elephant]: ELEPHANT_TABLE,
  [PieceType.Horse]: HORSE_TABLE,
  [PieceType.Chariot]: CHARIOT_TABLE,
  [PieceType.Cannon]: CANNON_TABLE,
  [PieceType.Soldier]: SOLDIER_TABLE_RED,
};

// PST weights (how much positional value matters relative to material)
const PST_WEIGHT = 5; // each PST point = 5 centipawns

// ─── Core Evaluation ───────────────────────────────────────────

/**
 * Evaluate the board from Red's perspective.
 * Positive = Red is better, Negative = Black is better.
 * Returns value in centipawns (100 = 1 pawn).
 */
export function evaluate(board: Board): number {
  let score = 0;

  const pieces = getAllPieces(board, Color.Red);
  const blackPieces = getAllPieces(board, Color.Black);

  // ─── Material ──────────────────────────────────────────
  for (const { piece, pos } of pieces) {
    score += PIECE_VALUES[piece.type] * 100;
    // Positional bonus (from Red's perspective)
    const table = PST[piece.type];
    if (table) {
      score += table[pos.row][pos.col] * PST_WEIGHT;
    }
  }

  for (const { piece, pos } of blackPieces) {
    score -= PIECE_VALUES[piece.type] * 100;
    // Positional bonus (flip rows for Black's perspective)
    const table = PST[piece.type];
    if (table && table[9 - pos.row]) {
      score -= table[9 - pos.row][pos.col] * PST_WEIGHT;
    }
  }

  // ─── Check bonus ────────────────────────────────────────
  if (isInCheck(board, Color.Black)) {
    score += 30;
  }
  if (isInCheck(board, Color.Red)) {
    score -= 30;
  }

  // ─── Passed soldier bonus ──────────────────────────────
  for (const { piece, pos } of pieces) {
    if (piece.type !== PieceType.Soldier) continue;
    // Soldiers that have crossed the river get extra value
    if (pos.row <= 4) {
      // Red soldier crossed river
      score += 50 + (4 - pos.row) * 20; // further advanced = more valuable
    }
  }
  for (const { piece, pos } of blackPieces) {
    if (piece.type !== PieceType.Soldier) continue;
    // Black soldier crossed river
    if (pos.row >= 5) {
      score -= 50 + (pos.row - 5) * 20;
    }
  }

  // ─── Mobility (lightweight) ─────────────────────────────
  // Give a small bonus for each legal move (traded off against performance)
  // Omitted for performance — full mobility eval is expensive

  return score;
}
