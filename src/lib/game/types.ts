// ─── Piece Types ────────────────────────────────────────────────
export enum PieceType {
  General = "general",   // 將/帥
  Advisor = "advisor",   // 士/仕
  Elephant = "elephant", // 象/相
  Horse = "horse",       // 馬
  Chariot = "chariot",   // 車/俥
  Cannon = "cannon",     // 炮/砲
  Soldier = "soldier",   // 兵/卒
}

// ─── Colors ─────────────────────────────────────────────────────
export enum Color {
  Red = "red",
  Black = "black",
}

// ─── Position on the 9×10 board ─────────────────────────────────
// row 0 = black's back rank, row 9 = red's back rank
// col 0 = leftmost file (from red's perspective), col 8 = rightmost
export interface Position {
  row: number; // 0–9
  col: number; // 0–8
}

// ─── A single piece ─────────────────────────────────────────────
export interface Piece {
  type: PieceType;
  color: Color;
}

// ─── The board: 10 rows × 9 columns ─────────────────────────────
// board[row][col] — null means empty square
export type Board = (Piece | null)[][];

// ─── A move ─────────────────────────────────────────────────────
export interface Move {
  from: Position;
  to: Position;
  captured: Piece | null; // piece that was captured (null if none)
}

// ─── Game state ─────────────────────────────────────────────────
export enum GameStatus {
  Playing = "playing",
  RedWins = "red_wins",
  BlackWins = "black_wins",
  Stalemate = "stalemate",
}

export interface GameState {
  board: Board;
  currentTurn: Color;
  moveHistory: Move[];
  status: GameStatus;
  isInCheck: boolean;
}

// ─── Constants ──────────────────────────────────────────────────
export const BOARD_ROWS = 10;
export const BOARD_COLS = 9;

// Piece internal representation for array-based board
export const PIECE_CHARS: Record<Color, Record<PieceType, string>> = {
  [Color.Red]: {
    [PieceType.General]: "K",    // 帥
    [PieceType.Advisor]: "A",    // 仕
    [PieceType.Elephant]: "E",   // 相
    [PieceType.Horse]: "H",      // 馬 → 傌
    [PieceType.Chariot]: "R",    // 車 → 俥
    [PieceType.Cannon]: "C",     // 炮
    [PieceType.Soldier]: "S",    // 兵
  },
  [Color.Black]: {
    [PieceType.General]: "k",    // 將
    [PieceType.Advisor]: "a",    // 士
    [PieceType.Elephant]: "e",   // 象
    [PieceType.Horse]: "h",      // 馬
    [PieceType.Chariot]: "r",    // 車
    [PieceType.Cannon]: "c",     // 砲
    [PieceType.Soldier]: "s",    // 卒
  },
};

// Unicode display characters
export const PIECE_UNICODE: Record<Color, Record<PieceType, string>> = {
  [Color.Red]: {
    [PieceType.General]: "帥",
    [PieceType.Advisor]: "仕",
    [PieceType.Elephant]: "相",
    [PieceType.Horse]: "傌",
    [PieceType.Chariot]: "俥",
    [PieceType.Cannon]: "炮",
    [PieceType.Soldier]: "兵",
  },
  [Color.Black]: {
    [PieceType.General]: "將",
    [PieceType.Advisor]: "士",
    [PieceType.Elephant]: "象",
    [PieceType.Horse]: "馬",
    [PieceType.Chariot]: "車",
    [PieceType.Cannon]: "砲",
    [PieceType.Soldier]: "卒",
  },
};

// Material values for evaluation
export const PIECE_VALUES: Record<PieceType, number> = {
  [PieceType.General]: 10000,
  [PieceType.Advisor]: 200,
  [PieceType.Elephant]: 200,
  [PieceType.Horse]: 400,
  [PieceType.Chariot]: 900,
  [PieceType.Cannon]: 450,
  [PieceType.Soldier]: 100,
};

export function oppositeColor(color: Color): Color {
  return color === Color.Red ? Color.Black : Color.Red;
}

// ─── Game Mode ─────────────────────────────────────────────────
export enum GameMode {
  HumanVsHuman = "human_vs_human",
  HumanVsAI = "human_vs_ai",
}

// ─── AI Difficulty ─────────────────────────────────────────────
export enum AIDifficulty {
  Easy = "easy",
  Medium = "medium",
  Hard = "hard",
}

export const AI_DIFFICULTY_CONFIG: Record<
  AIDifficulty,
  { skillLevel: number; moveTime: number; depth?: number; label: string }
> = {
  [AIDifficulty.Easy]: {
    skillLevel: 3,
    moveTime: 1500,
    label: "Easy 🟢",
  },
  [AIDifficulty.Medium]: {
    skillLevel: 10,
    moveTime: 3000,
    label: "Medium 🟡",
  },
  [AIDifficulty.Hard]: {
    skillLevel: 20,
    moveTime: 5000,
    label: "Hard 🔴",
  },
};
