import { Board, Color, PieceType, BOARD_ROWS, BOARD_COLS } from "@/lib/game/types";

// Zobrist hashing for board positions.
// Pre-generates random 64-bit numbers for each (pieceType, color, position) combination.

const PIECE_TYPES = Object.values(PieceType);
const COLORS = Object.values(Color);
const TOTAL_ENTRIES = PIECE_TYPES.length * COLORS.length * BOARD_ROWS * BOARD_COLS;

// Generate a random 64-bit BigInt
function randomBigInt(): bigint {
  const high = BigInt(Math.floor(Math.random() * 0x100000000));
  const low = BigInt(Math.floor(Math.random() * 0x100000000));
  return (high << BigInt(32)) | low;
}

// Pre-computed Zobrist table
const zobristTable: bigint[] = [];

function initTable(): void {
  if (zobristTable.length > 0) return;
  for (let i = 0; i < TOTAL_ENTRIES; i++) {
    zobristTable.push(randomBigInt());
  }
}

function getIndex(type: PieceType, color: Color, row: number, col: number): number {
  const typeIdx = PIECE_TYPES.indexOf(type);
  const colorIdx = COLORS.indexOf(color);
  return (typeIdx * COLORS.length + colorIdx) * BOARD_ROWS * BOARD_COLS + row * BOARD_COLS + col;
}

/** Compute the Zobrist hash for a board position. */
export function computeHash(board: Board): bigint {
  initTable();
  let hash = BigInt(0);
  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      const piece = board[r][c];
      if (piece) {
        const idx = getIndex(piece.type, piece.color, r, c);
        hash ^= zobristTable[idx];
      }
    }
  }
  return hash;
}

/** Update hash incrementally for a move. */
export function updateHash(
  oldHash: bigint,
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number,
  pieceType: PieceType,
  pieceColor: Color,
  capturedType: PieceType | null,
  capturedColor: Color | null
): bigint {
  initTable();
  let hash = oldHash;

  // Remove piece from source
  hash ^= zobristTable[getIndex(pieceType, pieceColor, fromRow, fromCol)];

  // Remove captured piece if any
  if (capturedType && capturedColor) {
    hash ^= zobristTable[getIndex(capturedType, capturedColor, toRow, toCol)];
  }

  // Add piece at destination
  hash ^= zobristTable[getIndex(pieceType, pieceColor, toRow, toCol)];

  return hash;
}
