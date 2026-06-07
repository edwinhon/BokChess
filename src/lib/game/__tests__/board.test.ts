import { describe, it, expect } from "vitest";
import { createInitialBoard, cloneBoard, getPieceAt, setPieceAt, isValidPosition, isInPalace, isOnOwnSide, hasCrossedRiver, posEqual, boardToString } from "@/lib/game/board";
import { findGeneral } from "@/lib/game/moves";
import { PieceType, Color, Board, Position } from "@/lib/game/types";

describe("Board", () => {
  it("creates initial board with 32 pieces", () => {
    const board = createInitialBoard();
    let count = 0;
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 9; c++) {
        if (board[r][c] !== null) count++;
      }
    }
    expect(count).toBe(32);
  });

  it("has generals in correct palace positions", () => {
    const board = createInitialBoard();
    expect(board[0][4]).toEqual({ type: PieceType.General, color: Color.Black });
    expect(board[9][4]).toEqual({ type: PieceType.General, color: Color.Red });
  });

  it("clones board without shared references", () => {
    const board = createInitialBoard();
    const cloned = cloneBoard(board);
    cloned[0][0] = null;
    expect(board[0][0]).not.toBeNull();
    expect(getPieceAt(board, { row: 0, col: 0 })!.type).toBe(PieceType.Chariot);
  });

  it("getPieceAt returns null for empty square", () => {
    const board = createInitialBoard();
    expect(getPieceAt(board, { row: 1, col: 0 })).toBeNull();
  });

  it("getPieceAt returns null for out-of-bounds", () => {
    const board = createInitialBoard();
    expect(getPieceAt(board, { row: -1, col: 0 })).toBeNull();
    expect(getPieceAt(board, { row: 10, col: 0 })).toBeNull();
  });

  it("isValidPosition checks bounds", () => {
    expect(isValidPosition({ row: 0, col: 0 })).toBe(true);
    expect(isValidPosition({ row: 9, col: 8 })).toBe(true);
    expect(isValidPosition({ row: -1, col: 0 })).toBe(false);
    expect(isValidPosition({ row: 10, col: 0 })).toBe(false);
  });

  it("isInPalace works for both colors", () => {
    // Black palace: rows 0-2, cols 3-5
    expect(isInPalace({ row: 0, col: 3 }, Color.Black)).toBe(true);
    expect(isInPalace({ row: 2, col: 5 }, Color.Black)).toBe(true);
    expect(isInPalace({ row: 3, col: 4 }, Color.Black)).toBe(false);
    // Red palace: rows 7-9, cols 3-5
    expect(isInPalace({ row: 7, col: 3 }, Color.Red)).toBe(true);
    expect(isInPalace({ row: 9, col: 5 }, Color.Red)).toBe(true);
    expect(isInPalace({ row: 6, col: 4 }, Color.Red)).toBe(false);
  });

  it("hasCrossedRiver works correctly", () => {
    // Red soldiers start at row 6; cross at row <= 4
    expect(hasCrossedRiver({ row: 6, col: 0 }, Color.Red)).toBe(false);
    expect(hasCrossedRiver({ row: 4, col: 0 }, Color.Red)).toBe(true);
    expect(hasCrossedRiver({ row: 0, col: 0 }, Color.Red)).toBe(true);
    // Black soldiers start at row 3; cross at row >= 5
    expect(hasCrossedRiver({ row: 3, col: 0 }, Color.Black)).toBe(false);
    expect(hasCrossedRiver({ row: 5, col: 0 }, Color.Black)).toBe(true);
    expect(hasCrossedRiver({ row: 9, col: 0 }, Color.Black)).toBe(true);
  });

  it("findGeneral locates both generals", () => {
    const board = createInitialBoard();
    const redGen = findGeneral(board, Color.Red);
    const blackGen = findGeneral(board, Color.Black);
    expect(redGen).toEqual({ row: 9, col: 4 });
    expect(blackGen).toEqual({ row: 0, col: 4 });
  });

  it("boardToString produces readable output", () => {
    const board = createInitialBoard();
    const str = boardToString(board);
    expect(str).toContain(".");
    expect(str).toContain("G"); // Red general (first char of "general")
    expect(str).toContain("g"); // Black general
  });
});
