import { Board, Color, Move } from "@/lib/game/types";
import { isMoveLegal } from "@/lib/game/rules";

/**
 * Simple opening book — common Chinese Chess opening moves.
 * Moves are defined as: [fromRow, fromCol, toRow, toCol]
 *
 * Common openings included:
 * - 中炮 (Central Cannon): Cannon to center
 * - 屏风马 (Screen Horses): Two horses protecting center
 * - 仙人指路 (Fairy's Guide): Advance soldier on file 7
 * - 飞相局 (Flying Elephant): Elephant to center
 */

type BookMove = [number, number, number, number];

// Opening book: sequence of moves for both sides
// First move is Red, second is Black, etc.
const OPENING_LINES: BookMove[][] = [
  // ─── Central Cannon vs Screen Horses (中炮对屏风马) ───
  [
    [7, 1, 7, 4], // 1. C2-5 (Red cannon to center file)
    [0, 7, 2, 6], // 1... H8+7 (Black left horse develops)
    [9, 7, 7, 6], // 2. H2+3 (Red right horse develops)
    [0, 8, 2, 8], // 2... R9=8 (Black left chariot out)
    [9, 8, 8, 8], // 3. R1=2 (Red right chariot out)
    [3, 4, 4, 4], // 3... S5+1 (Black center soldier advances)
    [9, 0, 8, 0], // 4. R9=1 (Red left chariot out)
    [0, 1, 2, 2], // 4... H2+3 (Black right horse develops)
  ],
  // ─── Same-direction Cannon (顺炮直车对横车) ───
  [
    [7, 1, 7, 4], // 1. C2-5
    [2, 7, 2, 4], // 1... c8-5
    [9, 7, 7, 6], // 2. H2+3
    [0, 8, 1, 8], // 2... R9+1 (cross chariot)
    [9, 8, 8, 8], // 3. R1=2
    [0, 7, 2, 6], // 3... H8+7
    [9, 0, 8, 0], // 4. R9=1
    [0, 1, 2, 2], // 4... H2+3
  ],
  // ─── Fairy's Guide (仙人指路) ───
  [
    [6, 6, 5, 6], // 1. S3+1 (advance right soldier)
    [3, 2, 4, 2], // 1... s7+1
    [9, 7, 7, 6], // 2. H2+3
    [0, 7, 2, 6], // 2... H8+7
  ],
  // ─── Flying Elephant (飞相局) ───
  [
    [9, 6, 7, 4], // 1. E3+5 (elephant to center)
    [0, 2, 2, 4], // 1... e7+5
    [9, 7, 7, 6], // 2. H2+3
    [0, 1, 2, 2], // 2... H2+3
  ],
  // ─── Pawn Opening (起兵局) ───
  [
    [6, 4, 5, 4], // 1. S5+1 (advance center soldier)
    [3, 4, 4, 4], // 1... s5+1
  ],
];

/**
 * Look up a book move for the current move number.
 * Returns the first legal book move that matches the board state,
 * or null if no legal book move is available.
 */
export function getBookMove(moveNumber: number, board: Board, color: Color): Move | null {
  // Try each opening line at this move number
  for (const line of OPENING_LINES) {
    if (moveNumber < line.length) {
      const [fr, fc, tr, tc] = line[moveNumber];
      const from = { row: fr, col: fc };
      const to = { row: tr, col: tc };
      if (isMoveLegal(board, from, to, color)) {
        return { from, to, captured: board[tr][tc] ? { ...board[tr][tc]! } : null };
      }
    }
  }

  // Fallback: try the main line
  const mainLine = OPENING_LINES[0];
  if (moveNumber < mainLine.length) {
    const [fr, fc, tr, tc] = mainLine[moveNumber];
    const from = { row: fr, col: fc };
    const to = { row: tr, col: tc };
    if (isMoveLegal(board, from, to, color)) {
      return { from, to, captured: board[tr][tc] ? { ...board[tr][tc]! } : null };
    }
  }

  return null;
}

export function isInBook(moveNumber: number): boolean {
  return moveNumber < OPENING_LINES[0].length;
}
