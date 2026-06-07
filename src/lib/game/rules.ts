import {
  Board,
  Piece,
  Color,
  Position,
  Move,
  GameState,
  GameStatus,
} from "./types";
import { cloneBoard } from "./board";
import {
  generatePieceMoves,
  getAllPieces,
  applyMove,
  findGeneral,
} from "./moves";
import { oppositeColor } from "./types";

/**
 * Check if the given color's general is in check.
 */
export function isInCheck(board: Board, color: Color): boolean {
  const generalPos = findGeneral(board, color);
  if (!generalPos) return true; // general captured = in check

  const opponent = oppositeColor(color);
  const opponentPieces = getAllPieces(board, opponent);

  for (const { pos } of opponentPieces) {
    const piece = board[pos.row][pos.col]!;
    const targets = generatePieceMoves(board, pos, piece);
    if (targets.some((t) => t.row === generalPos.row && t.col === generalPos.col)) {
      return true;
    }
  }

  return false;
}

/**
 * Simulate a move on a cloned board and check if it leaves own king in check.
 */
export function leavesKingInCheck(
  board: Board,
  move: Move,
  color: Color
): boolean {
  const cloned = cloneBoard(board);
  applyMove(cloned, move);
  return isInCheck(cloned, color);
}

/**
 * The "Flying General" rule check:
 * Opposing generals must not face each other on the same file
 * with no pieces between them.
 */
export function generalsAreFacing(board: Board): boolean {
  const redGen = findGeneral(board, Color.Red);
  const blackGen = findGeneral(board, Color.Black);
  if (!redGen || !blackGen) return false;
  if (redGen.col !== blackGen.col) return false;

  const minRow = Math.min(redGen.row, blackGen.row);
  const maxRow = Math.max(redGen.row, blackGen.row);
  for (let r = minRow + 1; r < maxRow; r++) {
    if (board[r][redGen.col] !== null) return false;
  }
  return true; // generals face each other
}

/**
 * Test if a move is fully legal:
 * 1. Piece belongs to current player
 * 2. Destination is in the piece's pseudo-legal moves
 * 3. Move does not leave own king in check
 * 4. After the move, Flying General rule is not violated
 */
export function isMoveLegal(
  board: Board,
  from: Position,
  to: Position,
  currentTurn: Color
): boolean {
  const piece = board[from.row][from.col];
  if (!piece) return false;
  if (piece.color !== currentTurn) return false;

  const pseudoMoves = generatePieceMoves(board, from, piece);
  if (!pseudoMoves.some((m) => m.row === to.row && m.col === to.col)) {
    return false;
  }

  const captured = board[to.row][to.col];
  const move: Move = { from, to, captured: captured ? { ...captured } : null };

  if (leavesKingInCheck(board, move, currentTurn)) return false;

  // Simulate move to check Flying General rule
  const cloned = cloneBoard(board);
  applyMove(cloned, move);
  if (generalsAreFacing(cloned)) return false;

  return true;
}

/**
 * Get all fully legal moves for the given color.
 */
export function getAllLegalMoves(
  board: Board,
  color: Color
): Move[] {
  const legalMoves: Move[] = [];
  const pieces = getAllPieces(board, color);

  for (const { piece, pos } of pieces) {
    const targets = generatePieceMoves(board, pos, piece);
    for (const to of targets) {
      if (isMoveLegal(board, pos, to, color)) {
        const captured = board[to.row][to.col];
        legalMoves.push({
          from: pos,
          to,
          captured: captured ? { ...captured } : null,
        });
      }
    }
  }

  return legalMoves;
}

/**
 * Check if the given color is in checkmate
 * (in check and no legal moves).
 */
export function isCheckmate(board: Board, color: Color): boolean {
  if (!isInCheck(board, color)) return false;
  return getAllLegalMoves(board, color).length === 0;
}

/**
 * Check if the given color is in stalemate
 * (not in check but no legal moves).
 */
export function isStalemate(board: Board, color: Color): boolean {
  if (isInCheck(board, color)) return false;
  return getAllLegalMoves(board, color).length === 0;
}

/**
 * Determine game status after a move.
 */
export function getGameStatus(board: Board, currentTurn: Color): GameStatus {
  const opponent = oppositeColor(currentTurn);

  if (isCheckmate(board, opponent)) {
    return currentTurn === Color.Red ? GameStatus.RedWins : GameStatus.BlackWins;
  }

  if (isStalemate(board, opponent)) {
    return GameStatus.Stalemate;
  }

  return GameStatus.Playing;
}

/**
 * Execute a move and return the new game state.
 */
export function executeMove(
  board: Board,
  move: Move,
  currentTurn: Color,
  moveHistory: Move[]
): GameState {
  const newBoard = cloneBoard(board);
  applyMove(newBoard, move);

  const nextTurn = oppositeColor(currentTurn);
  const inCheck = isInCheck(newBoard, nextTurn);
  const status = getGameStatus(newBoard, currentTurn);

  return {
    board: newBoard,
    currentTurn: nextTurn,
    moveHistory: [...moveHistory, move],
    status,
    isInCheck: inCheck,
  };
}
