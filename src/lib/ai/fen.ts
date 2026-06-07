import { Board, Color, PieceType, PIECE_CHARS } from "@/lib/game/types";

/**
 * Convert our internal board representation to Pikafish-compatible Xiangqi FEN.
 *
 * Pikafish piece letters in FEN:
 *   K = General (King), A = Advisor, B = Elephant, N = Horse (Knight),
 *   R = Chariot (Rook), C = Cannon, P = Soldier (Pawn)
 *   Uppercase = Red, lowercase = Black
 *
 * FEN format: <board> <side> - - <halfmove> <fullmove>
 *   side: "w" = Red to move, "b" = Black to move (Pikafish follows
 *   the international convention where the first-moving side is "white").
 *
 * Board rows are top-to-bottom (row 0 = Black's back rank).
 */
export function boardToFen(
  board: Board,
  sideToMove: Color,
  halfmove: number = 0,
  fullmove: number = 1
): string {
  // Map our piece types to Pikafish FEN letters
  const PIECE_TO_FEN: Record<PieceType, string> = {
    [PieceType.General]: "K",
    [PieceType.Advisor]: "A",
    [PieceType.Elephant]: "B",
    [PieceType.Horse]: "N",
    [PieceType.Chariot]: "R",
    [PieceType.Cannon]: "C",
    [PieceType.Soldier]: "P",
  };

  const rows: string[] = [];

  for (let row = 0; row < 10; row++) {
    let rowStr = "";
    let emptyCount = 0;

    for (let col = 0; col < 9; col++) {
      const piece = board[row][col];

      if (piece === null) {
        emptyCount++;
      } else {
        if (emptyCount > 0) {
          rowStr += String(emptyCount);
          emptyCount = 0;
        }
        const letter = PIECE_TO_FEN[piece.type];
        rowStr += piece.color === Color.Red ? letter.toUpperCase() : letter.toLowerCase();
      }
    }

    if (emptyCount > 0) {
      rowStr += String(emptyCount);
    }

    rows.push(rowStr);
  }

  // Pikafish convention: "w" = Red (first-moving side), "b" = Black
  const side = sideToMove === Color.Red ? "w" : "b";

  return `${rows.join("/")} ${side} - - ${halfmove} ${fullmove}`;
}

/**
 * Parse a Pikafish move string (e.g., "b0e2") into our internal format.
 *
 * Pikafish uses long algebraic notation from **Red's** perspective:
 *   Files: a-i = Red's left to right = our col 0 to col 8
 *   Ranks: 0-9 = Red's back rank to Black's back rank (0=our row 9, 9=our row 0)
 */
export function parsePikafishMove(
  moveStr: string
): { from: { row: number; col: number }; to: { row: number; col: number } } | null {
  if (moveStr.length < 4) return null;

  // Pikafish files are from Red's perspective: a=Red's left=our col 0
  const fromCol = moveStr.charCodeAt(0) - 97; // 'a'=97 → col 0
  const fromRow = 9 - parseInt(moveStr[1], 10); // pikafish rank 0=our row 9
  const toCol = moveStr.charCodeAt(2) - 97;
  const toRow = 9 - parseInt(moveStr[3], 10);

  if (
    isNaN(fromRow) || isNaN(toRow) ||
    fromCol < 0 || fromCol > 8 ||
    toCol < 0 || toCol > 8 ||
    fromRow < 0 || fromRow > 9 ||
    toRow < 0 || toRow > 9
  ) {
    return null;
  }

  return {
    from: { row: fromRow, col: fromCol },
    to: { row: toRow, col: toCol },
  };
}

/**
 * Convert our internal move to Pikafish coordinate notation (Red's perspective).
 */
export function moveToPikafish(
  from: { row: number; col: number },
  to: { row: number; col: number }
): string {
  // Red's perspective: our col 0 = Pikafish file 'a', our row 9 = Pikafish rank 0
  const fileFrom = String.fromCharCode(97 + from.col);
  const fileTo = String.fromCharCode(97 + to.col);
  return `${fileFrom}${9 - from.row}${fileTo}${9 - to.row}`;
}
