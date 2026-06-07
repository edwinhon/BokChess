export {
  PieceType,
  Color,
  GameStatus,
  GameMode,
  AIDifficulty,
  AI_DIFFICULTY_CONFIG,
  PIECE_CHARS,
  PIECE_UNICODE,
  PIECE_VALUES,
  BOARD_ROWS,
  BOARD_COLS,
  oppositeColor,
} from "./types";

export type {
  Piece,
  Board,
  Position,
  Move,
  GameState,
} from "./types";

export {
  createInitialBoard,
  cloneBoard,
  getPieceAt,
  setPieceAt,
  isValidPosition,
  isInPalace,
  isOnOwnSide,
  hasCrossedRiver,
  posEqual,
  boardToString,
} from "./board";

export {
  generatePieceMoves,
  getAllPieces,
  applyMove,
  findGeneral,
} from "./moves";

export {
  isInCheck,
  isMoveLegal,
  getAllLegalMoves,
  isCheckmate,
  isStalemate,
  getGameStatus,
  executeMove,
  generalsAreFacing,
} from "./rules";

export { encodeMove } from "./notation";
