import {
  Board,
  Piece,
  PieceType,
  Color,
  Position,
  BOARD_ROWS,
  BOARD_COLS,
} from "./types";

/**
 * Create the standard Chinese Chess starting position.
 * Board is indexed as board[row][col]:
 *   row 0 = black's back rank (top of display)
 *   row 9 = red's back rank (bottom of display)
 */
export function createInitialBoard(): Board {
  // Initialize empty 10×9 board
  const board: Board = Array.from({ length: BOARD_ROWS }, () =>
    Array.from({ length: BOARD_COLS }, () => null)
  );

  const B = Color.Black;
  const R = Color.Red;

  // ─── Black pieces (rows 0–4) ───
  // Row 0: back rank
  board[0][0] = { type: PieceType.Chariot, color: B };
  board[0][1] = { type: PieceType.Horse, color: B };
  board[0][2] = { type: PieceType.Elephant, color: B };
  board[0][3] = { type: PieceType.Advisor, color: B };
  board[0][4] = { type: PieceType.General, color: B };
  board[0][5] = { type: PieceType.Advisor, color: B };
  board[0][6] = { type: PieceType.Elephant, color: B };
  board[0][7] = { type: PieceType.Horse, color: B };
  board[0][8] = { type: PieceType.Chariot, color: B };

  // Row 2: cannons
  board[2][1] = { type: PieceType.Cannon, color: B };
  board[2][7] = { type: PieceType.Cannon, color: B };

  // Row 3: soldiers
  board[3][0] = { type: PieceType.Soldier, color: B };
  board[3][2] = { type: PieceType.Soldier, color: B };
  board[3][4] = { type: PieceType.Soldier, color: B };
  board[3][6] = { type: PieceType.Soldier, color: B };
  board[3][8] = { type: PieceType.Soldier, color: B };

  // ─── Red pieces (rows 5–9) ───
  // Row 9: back rank
  board[9][0] = { type: PieceType.Chariot, color: R };
  board[9][1] = { type: PieceType.Horse, color: R };
  board[9][2] = { type: PieceType.Elephant, color: R };
  board[9][3] = { type: PieceType.Advisor, color: R };
  board[9][4] = { type: PieceType.General, color: R };
  board[9][5] = { type: PieceType.Advisor, color: R };
  board[9][6] = { type: PieceType.Elephant, color: R };
  board[9][7] = { type: PieceType.Horse, color: R };
  board[9][8] = { type: PieceType.Chariot, color: R };

  // Row 7: cannons
  board[7][1] = { type: PieceType.Cannon, color: R };
  board[7][7] = { type: PieceType.Cannon, color: R };

  // Row 6: soldiers
  board[6][0] = { type: PieceType.Soldier, color: R };
  board[6][2] = { type: PieceType.Soldier, color: R };
  board[6][4] = { type: PieceType.Soldier, color: R };
  board[6][6] = { type: PieceType.Soldier, color: R };
  board[6][8] = { type: PieceType.Soldier, color: R };

  return board;
}

/** Deep-clone a board. */
export function cloneBoard(board: Board): Board {
  return board.map((row) =>
    row.map((cell) => (cell ? { ...cell } : null))
  );
}

/** Get piece at position (or null). */
export function getPieceAt(board: Board, pos: Position): Piece | null {
  if (!isValidPosition(pos)) return null;
  return board[pos.row][pos.col];
}

/** Set piece at position. */
export function setPieceAt(
  board: Board,
  pos: Position,
  piece: Piece | null
): void {
  if (isValidPosition(pos)) {
    board[pos.row][pos.col] = piece;
  }
}

/** Check if a position is within board bounds. */
export function isValidPosition(pos: Position): boolean {
  return pos.row >= 0 && pos.row < BOARD_ROWS && pos.col >= 0 && pos.col < BOARD_COLS;
}

/** Check if a position is within the palace (3×3 area). */
export function isInPalace(pos: Position, color: Color): boolean {
  if (pos.col < 3 || pos.col > 5) return false;
  if (color === Color.Black) return pos.row >= 0 && pos.row <= 2;
  return pos.row >= 7 && pos.row <= 9;
}

/** Check if a position is on the owning side of the river. */
export function isOnOwnSide(pos: Position, color: Color): boolean {
  if (color === Color.Black) return pos.row >= 0 && pos.row <= 4;
  return pos.row >= 5 && pos.row <= 9;
}

/**
 * Check if a soldier has crossed the river.
 * Red soldiers start at row 6 and cross upward (row < 5).
 * Black soldiers start at row 3 and cross downward (row > 4).
 */
export function hasCrossedRiver(pos: Position, color: Color): boolean {
  if (color === Color.Red) return pos.row <= 4;
  return pos.row >= 5;
}

/** Positions are equal. */
export function posEqual(a: Position, b: Position): boolean {
  return a.row === b.row && a.col === b.col;
}

/**
 * Debug: convert board to a compact string representation.
 * Red = uppercase, Black = lowercase, empty = "."
 */
export function boardToString(board: Board): string {
  return board
    .map((row) =>
      row
        .map((cell) => {
          if (!cell) return ".";
          const ch = cell.type[0].toUpperCase();
          return cell.color === Color.Red ? ch : ch.toLowerCase();
        })
        .join(" ")
    )
    .join("\n");
}
