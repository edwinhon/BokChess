import {
  Board,
  Piece,
  PieceType,
  Color,
  Position,
  Move,
  BOARD_ROWS,
  BOARD_COLS,
} from "./types";
import {
  getPieceAt,
  isValidPosition,
  isInPalace,
  isOnOwnSide,
  hasCrossedRiver,
} from "./board";

// ─── Direction helpers ──────────────────────────────────────────
const ORTHOGONAL_DIRS = [
  { dr: -1, dc: 0 },
  { dr: 1, dc: 0 },
  { dr: 0, dc: -1 },
  { dr: 0, dc: 1 },
];

const DIAGONAL_DIRS = [
  { dr: -1, dc: -1 },
  { dr: -1, dc: 1 },
  { dr: 1, dc: -1 },
  { dr: 1, dc: 1 },
];

// Horse moves: first step orthogonal, then diagonal
const HORSE_STEPS: { dr: number; dc: number; legR: number; legC: number }[] = [
  { dr: -2, dc: -1, legR: -1, legC: 0 },  // up-up-left
  { dr: -2, dc: 1, legR: -1, legC: 0 },   // up-up-right
  { dr: 2, dc: -1, legR: 1, legC: 0 },    // down-down-left
  { dr: 2, dc: 1, legR: 1, legC: 0 },     // down-down-right
  { dr: -1, dc: -2, legR: 0, legC: -1 },  // left-left-up
  { dr: 1, dc: -2, legR: 0, legC: -1 },   // left-left-down
  { dr: -1, dc: 2, legR: 0, legC: 1 },    // right-right-up
  { dr: 1, dc: 2, legR: 0, legC: 1 },     // right-right-down
];

// Elephant moves: 2 steps diagonal, checked at midpoint
const ELEPHANT_STEPS: { dr: number; dc: number; eyeR: number; eyeC: number }[] = [
  { dr: -2, dc: -2, eyeR: -1, eyeC: -1 },
  { dr: -2, dc: 2, eyeR: -1, eyeC: 1 },
  { dr: 2, dc: -2, eyeR: 1, eyeC: -1 },
  { dr: 2, dc: 2, eyeR: 1, eyeC: 1 },
];

// ─── Core movement generators ───────────────────────────────────

/**
 * Generate pseudo-legal moves for a single piece.
 * "Pseudo-legal" = obeys piece movement rules, but may leave own king in check.
 */
export function generatePieceMoves(
  board: Board,
  pos: Position,
  piece: Piece
): Position[] {
  const destinations: Position[] = [];

  switch (piece.type) {
    case PieceType.General:
      generateGeneralMoves(board, pos, piece.color, destinations);
      break;
    case PieceType.Advisor:
      generateAdvisorMoves(board, pos, piece.color, destinations);
      break;
    case PieceType.Elephant:
      generateElephantMoves(board, pos, piece.color, destinations);
      break;
    case PieceType.Horse:
      generateHorseMoves(board, pos, piece.color, destinations);
      break;
    case PieceType.Chariot:
      generateSlidingMoves(board, pos, piece.color, ORTHOGONAL_DIRS, destinations);
      break;
    case PieceType.Cannon:
      generateCannonMoves(board, pos, piece.color, destinations);
      break;
    case PieceType.Soldier:
      generateSoldierMoves(board, pos, piece.color, destinations);
      break;
  }

  return destinations;
}

// ─── General (將/帥) ────────────────────────────────────────────
function generateGeneralMoves(
  board: Board,
  pos: Position,
  color: Color,
  dests: Position[]
): void {
  for (const { dr, dc } of ORTHOGONAL_DIRS) {
    const to: Position = { row: pos.row + dr, col: pos.col + dc };
    if (!isValidPosition(to)) continue;
    if (!isInPalace(to, color)) continue;
    const target = getPieceAt(board, to);
    if (target && target.color === color) continue;
    dests.push(to);
  }

  // "Flying General" capture: if opposing generals face each other
  // on the same file with nothing between, a general can "fly" to capture.
  // This is handled separately — we add it as a special capture.
  const opponentColor = color === Color.Red ? Color.Black : Color.Red;
  const opponentGeneralPos = findGeneral(board, opponentColor);
  if (opponentGeneralPos && opponentGeneralPos.col === pos.col) {
    // Check if the file between them is empty
    const minRow = Math.min(pos.row, opponentGeneralPos.row);
    const maxRow = Math.max(pos.row, opponentGeneralPos.row);
    let blocked = false;
    for (let r = minRow + 1; r < maxRow; r++) {
      if (board[r][pos.col] !== null) {
        blocked = true;
        break;
      }
    }
    if (!blocked) {
      dests.push(opponentGeneralPos);
    }
  }
}

// ─── Advisor (士/仕) ────────────────────────────────────────────
function generateAdvisorMoves(
  board: Board,
  pos: Position,
  color: Color,
  dests: Position[]
): void {
  for (const { dr, dc } of DIAGONAL_DIRS) {
    const to: Position = { row: pos.row + dr, col: pos.col + dc };
    if (!isValidPosition(to)) continue;
    if (!isInPalace(to, color)) continue;
    const target = getPieceAt(board, to);
    if (target && target.color === color) continue;
    dests.push(to);
  }
}

// ─── Elephant (象/相) ─────────────────────────────────────────────
function generateElephantMoves(
  board: Board,
  pos: Position,
  color: Color,
  dests: Position[]
): void {
  for (const { dr, dc, eyeR, eyeC } of ELEPHANT_STEPS) {
    const to: Position = { row: pos.row + dr, col: pos.col + dc };
    const eye: Position = { row: pos.row + eyeR, col: pos.col + eyeC };

    if (!isValidPosition(to)) continue;
    // Elephant cannot cross the river
    if (!isOnOwnSide(to, color)) continue;
    // Blocked at the "eye" (midpoint)
    if (getPieceAt(board, eye) !== null) continue;

    const target = getPieceAt(board, to);
    if (target && target.color === color) continue;
    dests.push(to);
  }
}

// ─── Horse (馬) ────────────────────────────────────────────────
function generateHorseMoves(
  board: Board,
  pos: Position,
  color: Color,
  dests: Position[]
): void {
  for (const { dr, dc, legR, legC } of HORSE_STEPS) {
    const to: Position = { row: pos.row + dr, col: pos.col + dc };
    const leg: Position = { row: pos.row + legR, col: pos.col + legC };

    if (!isValidPosition(to)) continue;
    // Blocked at the "leg" (first orthogonal step)
    if (getPieceAt(board, leg) !== null) continue;

    const target = getPieceAt(board, to);
    if (target && target.color === color) continue;
    dests.push(to);
  }
}

// ─── Sliding moves (Chariot / Cannon movement without capture) ─
function generateSlidingMoves(
  board: Board,
  pos: Position,
  color: Color,
  dirs: { dr: number; dc: number }[],
  dests: Position[]
): void {
  for (const { dr, dc } of dirs) {
    let r = pos.row + dr;
    let c = pos.col + dc;
    while (isValidPosition({ row: r, col: c })) {
      const target = getPieceAt(board, { row: r, col: c });
      if (target) {
        if (target.color !== color) {
          dests.push({ row: r, col: c }); // capture
        }
        break; // blocked by any piece
      }
      dests.push({ row: r, col: c });
      r += dr;
      c += dc;
    }
  }
}

// ─── Cannon (炮/砲) ────────────────────────────────────────────
function generateCannonMoves(
  board: Board,
  pos: Position,
  color: Color,
  dests: Position[]
): void {
  for (const { dr, dc } of ORTHOGONAL_DIRS) {
    let r = pos.row + dr;
    let c = pos.col + dc;

    // Movement (no capture): slide until blocked
    while (isValidPosition({ row: r, col: c })) {
      const target = getPieceAt(board, { row: r, col: c });
      if (target) break; // stop at first piece (the "screen")
      dests.push({ row: r, col: c });
      r += dr;
      c += dc;
    }

    // Skip past the screen piece to look for a capture target
    r += dr;
    c += dc;

    // Capture: must jump exactly one piece (the screen)
    while (isValidPosition({ row: r, col: c })) {
      const target = getPieceAt(board, { row: r, col: c });
      if (target) {
        if (target.color !== color) {
          dests.push({ row: r, col: c }); // capture after jumping screen
        }
        break; // stop after first piece beyond screen
      }
      r += dr;
      c += dc;
    }
  }
}

// ─── Soldier (兵/卒) ───────────────────────────────────────────
function generateSoldierMoves(
  board: Board,
  pos: Position,
  color: Color,
  dests: Position[]
): void {
  // Forward direction depends on color
  const forward = color === Color.Red ? -1 : 1;

  // Forward move
  const fwd: Position = { row: pos.row + forward, col: pos.col };
  if (isValidPosition(fwd)) {
    const target = getPieceAt(board, fwd);
    if (!target || target.color !== color) {
      dests.push(fwd);
    }
  }

  // If crossed river, can also move sideways
  if (hasCrossedRiver(pos, color)) {
    const sideways = [
      { row: pos.row, col: pos.col - 1 },
      { row: pos.row, col: pos.col + 1 },
    ];
    for (const to of sideways) {
      if (!isValidPosition(to)) continue;
      const target = getPieceAt(board, to);
      if (!target || target.color !== color) {
        dests.push(to);
      }
    }
  }
}

// ─── Helpers ────────────────────────────────────────────────────

/** Find the position of a general of the given color. */
export function findGeneral(board: Board, color: Color): Position | null {
  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      const piece = board[r][c];
      if (piece && piece.type === PieceType.General && piece.color === color) {
        return { row: r, col: c };
      }
    }
  }
  return null;
}

/** Get all pieces of a given color. */
export function getAllPieces(
  board: Board,
  color: Color
): { piece: Piece; pos: Position }[] {
  const pieces: { piece: Piece; pos: Position }[] = [];
  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      const piece = board[r][c];
      if (piece && piece.color === color) {
        pieces.push({ piece, pos: { row: r, col: c } });
      }
    }
  }
  return pieces;
}

/** Apply a move to the board (mutates the board in place). */
export function applyMove(board: Board, move: Move): void {
  board[move.to.row][move.to.col] = board[move.from.row][move.from.col];
  board[move.from.row][move.from.col] = null;
}
