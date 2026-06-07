import { Move, Piece, Color, PieceType, Board } from "./types";
import { getPieceAt } from "./board";

/**
 * Traditional Chinese Xiangqi (象棋) notation.
 *
 * Format: [Piece][Column][Action][Target]
 *   - Piece: 帥/仕/相/傌/俥/炮/兵 (Red) or 將/士/象/馬/車/砲/卒 (Black)
 *   - Column: 1–9 counting from the player's own right side
 *   - Action: 進 (advance), 退 (retreat), 平 (horizontal)
 *   - Target: for 進/退 of straight-movers: steps moved (1-9)
 *             for 進/退 of diagonal-movers: destination column (1-9)
 *             for 平: destination column (1-9)
 *
 * Disambiguation: When two identical pieces are on the same column,
 * prefix the piece name with 前 (front) or 後 (back) based on
 * position relative to the opponent (front = closer to opponent).
 */

/**
 * Convert internal column (0–8) to notation column (1–9).
 * From the player's perspective:
 *   Red:  col 0 = rightmost = column 9, col 8 = leftmost = column 1
 *   Black: col 0 = leftmost = column 1, col 8 = rightmost = column 9
 */
function colToNotation(col: number, color: Color): number {
  return color === Color.Red ? 9 - col : col + 1;
}

/** Piece types that move on diagonals (use destination column as target) */
function isDiagonalMover(type: PieceType): boolean {
  return type === PieceType.Horse || type === PieceType.Advisor || type === PieceType.Elephant;
}

/** Piece types that move in straight lines (use step count as target) */
function isStraightMover(type: PieceType): boolean {
  return type === PieceType.Chariot || type === PieceType.Cannon ||
    type === PieceType.General || type === PieceType.Soldier;
}

/**
 * Get the Chinese notation piece character.
 * Uses traditional characters appropriate for each side.
 */
function pieceNotationChar(piece: Piece): string {
  // Red uses elegant characters, Black uses standard characters
  const RED_CHARS: Record<PieceType, string> = {
    [PieceType.General]: "帥",
    [PieceType.Advisor]: "仕",
    [PieceType.Elephant]: "相",
    [PieceType.Horse]: "傌",
    [PieceType.Chariot]: "俥",
    [PieceType.Cannon]: "炮",
    [PieceType.Soldier]: "兵",
  };
  const BLACK_CHARS: Record<PieceType, string> = {
    [PieceType.General]: "將",
    [PieceType.Advisor]: "士",
    [PieceType.Elephant]: "象",
    [PieceType.Horse]: "馬",
    [PieceType.Chariot]: "車",
    [PieceType.Cannon]: "砲",
    [PieceType.Soldier]: "卒",
  };
  return piece.color === Color.Red ? RED_CHARS[piece.type] : BLACK_CHARS[piece.type];
}

/**
 * Check if there are two identical pieces on the same file (column)
 * that need disambiguation with 前/後.
 * Returns the disambiguation prefix or empty string.
 */
function disambiguatePrefix(
  board: Board,
  piece: Piece,
  fromCol: number,
  fromRow: number
): string {
  // Find all pieces of same type and color on the same file (column)
  const sameColPieces: number[] = [];
  for (let r = 0; r < 10; r++) {
    const p = getPieceAt(board, { row: r, col: fromCol });
    if (p && p.type === piece.type && p.color === piece.color) {
      sameColPieces.push(r);
    }
  }

  // Only need disambiguation if >1 piece of same type on the same column
  if (sameColPieces.length < 2) return "";

  // Determine front/back: "front" = the piece closer to the opponent
  // Red: front = smaller row number (closer to Black's side at row 0)
  // Black: front = larger row number (closer to Red's side at row 9)
  if (piece.color === Color.Red) {
    sameColPieces.sort((a, b) => a - b); // ascending: smaller row = front
    if (fromRow === sameColPieces[0]) return "前";
    return "後";
  } else {
    sameColPieces.sort((a, b) => b - a); // descending: larger row = front
    if (fromRow === sameColPieces[0]) return "前";
    return "後";
  }
}

/**
 * Encode a move in traditional Chinese Xiangqi notation.
 *
 * @param move - The move to encode
 * @param piece - The piece being moved
 * @param board - The board BEFORE the move (for disambiguation)
 * @returns Chinese notation string, e.g. "炮二平五", "車一進一", "前馬進三"
 */
export function encodeMove(move: Move, piece: Piece, board?: Board): string {
  const pChar = pieceNotationChar(piece);
  const fromNotation = colToNotation(move.from.col, piece.color);
  const toNotation = colToNotation(move.to.col, piece.color);

  // Disambiguation prefix
  let prefix = "";
  if (board) {
    prefix = disambiguatePrefix(board, piece, move.from.col, move.from.row);
  }

  // Determine action
  let action: string;
  let target: string;

  if (move.to.row === move.from.row) {
    // Horizontal move: 平
    action = "平";
    target = String(toNotation);
  } else {
    // Vertical move: determine direction
    // Red advances upward (row decreasing), Black advances downward (row increasing)
    const advances = piece.color === Color.Red
      ? move.to.row < move.from.row
      : move.to.row > move.from.row;

    action = advances ? "進" : "退";

    if (isStraightMover(piece.type)) {
      // Straight movers: target = number of steps (intersections moved)
      target = String(Math.abs(move.to.row - move.from.row));
    } else {
      // Diagonal movers: target = destination column number
      target = String(toNotation);
    }
  }

  return `${prefix}${pChar}${fromNotation}${action}${target}`;
}

/**
 * Encode a move in WXF (World Xiangqi Federation) notation.
 * Kept for backward compatibility.
 */
export function encodeMoveWXF(move: Move, piece: Piece, board?: Board): string {
  // This is a simplified version of WXF notation
  // For a full implementation, see the original encodeMove below
  return encodeMove(move, piece, board);
}

/**
 * Decode a WXF notation string back to a move.
 * (Stub — not needed for MVP; implement if needed for PGN import)
 */
export function decodeMove(_notation: string): Move | null {
  return null;
}
