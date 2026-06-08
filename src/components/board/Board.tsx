"use client";

import { useRef, useEffect, useCallback } from "react";
import { Board as BoardType, Color, Position, PIECE_UNICODE, BOARD_ROWS, BOARD_COLS } from "@/lib/game/types";

export interface HintArrow {
  from: Position;
  to: Position;
  score: number;
  /** 1=best (green), 2=second (yellow), 3=third (blue) */
  rank: number;
}

interface BoardProps {
  board: BoardType;
  flipped?: boolean;
  selectedPos?: Position | null;
  legalMoves?: Position[];
  onCellClick?: (pos: Position) => void;
  /** MultiPV hint arrows — colored arrows showing top engine suggestions */
  hintArrows?: HintArrow[];
  /** When true, click-to-move is disabled (review mode) */
  readonly?: boolean;
  /** Highlight the from/to squares of the most recent move */
  lastMove?: { from: Position; to: Position } | null;
}

const PADDING = 40;
const CELL_SIZE = 58;

export default function Board({ board, flipped = false, selectedPos, legalMoves = [], onCellClick, hintArrows, readonly = false, lastMove }: BoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const gridToPixel = useCallback(
    (row: number, col: number): { x: number; y: number } => {
      const r = flipped ? 9 - row : row;
      const c = flipped ? 8 - col : col;
      return {
        x: PADDING + c * CELL_SIZE,
        y: PADDING + r * CELL_SIZE,
      };
    },
    [flipped]
  );

  const pixelToGrid = useCallback(
    (x: number, y: number): Position | null => {
      const col = Math.round((x - PADDING) / CELL_SIZE);
      const row = Math.round((y - PADDING) / CELL_SIZE);
      const actualCol = flipped ? 8 - col : col;
      const actualRow = flipped ? 9 - row : row;
      if (actualCol < 0 || actualCol > 8 || actualRow < 0 || actualRow > 9) return null;
      return { row: actualRow, col: actualCol };
    },
    [flipped]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = PADDING * 2 + 8 * CELL_SIZE;
    const height = PADDING * 2 + 9 * CELL_SIZE;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // ─── Background ──────────────────────────────────────
    ctx.fillStyle = "#f5deb3"; // wheat/wood color
    ctx.fillRect(0, 0, width, height);

    // ─── Grid ────────────────────────────────────────────
    ctx.strokeStyle = "#3a2a1a";
    ctx.lineWidth = 1.2;

    // Horizontal lines
    for (let r = 0; r < BOARD_ROWS; r++) {
      const left = gridToPixel(r, 0);
      const right = gridToPixel(r, 8);
      ctx.beginPath();
      ctx.moveTo(left.x, left.y);
      ctx.lineTo(right.x, right.y);
      ctx.stroke();
    }

    // Vertical lines (split at river for cols 1–7)
    for (let c = 0; c < BOARD_COLS; c++) {
      if (c === 0 || c === 8) {
        // Edge columns: continuous
        const top = gridToPixel(0, c);
        const bottom = gridToPixel(9, c);
        ctx.beginPath();
        ctx.moveTo(top.x, top.y);
        ctx.lineTo(bottom.x, bottom.y);
        ctx.stroke();
      } else {
        // Inner columns: split at river (between rows 4 and 5)
        const top = gridToPixel(0, c);
        const midTop = gridToPixel(4, c);
        const midBottom = gridToPixel(5, c);
        const bottom = gridToPixel(9, c);
        ctx.beginPath();
        ctx.moveTo(top.x, top.y);
        ctx.lineTo(midTop.x, midTop.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(midBottom.x, midBottom.y);
        ctx.lineTo(bottom.x, bottom.y);
        ctx.stroke();
      }
    }

    // ─── Palace diagonals ────────────────────────────────
    ctx.strokeStyle = "#3a2a1a";
    ctx.lineWidth = 1;
    const drawPalace = (topRow: number, bottomRow: number) => {
      const tl = gridToPixel(topRow, 3);
      const tr = gridToPixel(topRow, 5);
      const bl = gridToPixel(bottomRow, 3);
      const br = gridToPixel(bottomRow, 5);
      ctx.beginPath(); ctx.moveTo(tl.x, tl.y); ctx.lineTo(br.x, br.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(tr.x, tr.y); ctx.lineTo(bl.x, bl.y); ctx.stroke();
    };
    drawPalace(0, 2);   // Black palace
    drawPalace(7, 9);   // Red palace

    // ─── River text ──────────────────────────────────────
    ctx.fillStyle = "#3a2a1a";
    ctx.font = "bold 22px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const riverY = (gridToPixel(4, 4).y + gridToPixel(5, 4).y) / 2;
    ctx.fillText("楚  河", gridToPixel(4, 2).x, riverY);
    ctx.fillText("漢  界", gridToPixel(4, 6).x, riverY);

    // ─── Position markers (star points) ──────────────────
    const markerPositions = [
      // Black side
      { row: 2, col: 1 }, { row: 2, col: 7 }, // cannon markers
      { row: 3, col: 0 }, { row: 3, col: 2 }, { row: 3, col: 4 }, { row: 3, col: 6 }, { row: 3, col: 8 }, // soldier markers
      // Red side
      { row: 6, col: 0 }, { row: 6, col: 2 }, { row: 6, col: 4 }, { row: 6, col: 6 }, { row: 6, col: 8 }, // soldier markers
      { row: 7, col: 1 }, { row: 7, col: 7 }, // cannon markers
    ];
    const markerSize = 4;
    for (const { row, col } of markerPositions) {
      const { x, y } = gridToPixel(row, col);
      // Draw cross markers (corner ticks)
      const d = 5;
      const m = markerSize;
      ctx.strokeStyle = "#3a2a1a";
      ctx.lineWidth = 1;
      const drawArm = (dx: number, dy: number, mx: number, my: number) => {
        if (dx === 0 && dy === 0) return;
        ctx.beginPath();
        ctx.moveTo(x + dx * d, y + dy * d);
        ctx.lineTo(x + dx * d + mx * m, y + dy * d);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + dx * d, y + dy * d);
        ctx.lineTo(x + dx * d, y + dy * d + my * m);
        ctx.stroke();
      };
      // Check which edges are on the board edge
      // For each corner marker, draw the L-shape
      // Simplified: just draw small cross marks
      if (col > 0 && row > 0) { drawArm(-1, -1, -1, -1); }
      if (col < 8 && row > 0) { drawArm(1, -1, 1, -1); }
      if (col > 0 && row < 9) { drawArm(-1, 1, -1, 1); }
      if (col < 8 && row < 9) { drawArm(1, 1, 1, 1); }
    }

    // ─── Legal move indicators ───────────────────────────
    for (const pos of legalMoves) {
      const { x, y } = gridToPixel(pos.row, pos.col);
      const piece = board[pos.row][pos.col];
      if (piece) {
        // Capture indicator: ring around the piece
        ctx.strokeStyle = "rgba(220, 38, 38, 0.8)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, CELL_SIZE / 2 - 2, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // Move indicator: small dot
        ctx.fillStyle = "rgba(34, 197, 94, 0.6)";
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // ─── Hint arrows (MultiPV suggestions) ────────────────
    if (hintArrows && hintArrows.length > 0) {
      // Arrow color by rank
      const arrowColors: Record<number, string> = {
        1: "#22c55e", // green — best
        2: "#eab308", // yellow — second best
        3: "#3b82f6", // blue — defensive/stable
      };

      for (const arrow of hintArrows) {
        const color = arrowColors[arrow.rank] ?? "#6b7280";
        const from = gridToPixel(arrow.from.row, arrow.from.col);
        const to = gridToPixel(arrow.to.row, arrow.to.col);

        // Calculate direction and shorten the arrow so it doesn't overlap pieces
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 1) continue;

        const unitX = dx / len;
        const unitY = dy / len;

        // Start outside the source piece circle, end before the target piece
        const startOffset = CELL_SIZE / 2 + 2;
        const endOffset = CELL_SIZE / 2 + 4;
        const sx = from.x + unitX * startOffset;
        const sy = from.y + unitY * startOffset;
        const ex = to.x - unitX * endOffset;
        const ey = to.y - unitY * endOffset;

        // Draw shadow first for depth
        ctx.save();
        ctx.strokeStyle = "rgba(0,0,0,0.3)";
        ctx.lineWidth = 5;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(sx + 1, sy + 1);
        ctx.lineTo(ex + 1, ey + 1);
        ctx.stroke();
        ctx.restore();

        // Draw main arrow line
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 3.5;
        ctx.lineCap = "round";
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        ctx.restore();

        // Draw arrowhead
        const arrowAngle = Math.atan2(dy, dx);
        const headLen = 14;
        const headAngle = Math.PI / 6; // 30 degrees

        ctx.save();
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(
          ex - headLen * Math.cos(arrowAngle - headAngle),
          ey - headLen * Math.sin(arrowAngle - headAngle)
        );
        ctx.lineTo(
          ex - headLen * Math.cos(arrowAngle + headAngle),
          ey - headLen * Math.sin(arrowAngle + headAngle)
        );
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Draw score badge near midpoint of arrow
        const midX = (sx + ex) / 2;
        const midY = (sy + ey) / 2;
        const scoreText = (arrow.score / 100).toFixed(1);
        const badgeWidth = scoreText.length > 3 ? 40 : 32;
        const badgeHeight = 18;

        ctx.save();
        // Badge background
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        roundRect(ctx, midX - badgeWidth / 2, midY - badgeHeight / 2, badgeWidth, badgeHeight, 9);
        ctx.fill();
        ctx.stroke();
        // Badge text
        ctx.fillStyle = "#fff";
        ctx.font = "bold 10px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(scoreText, midX, midY);
        ctx.restore();
      }
    }

    // ─── Last move highlight (review mode) ──────────────
    if (lastMove) {
      for (const pos of [lastMove.from, lastMove.to]) {
        const { x, y } = gridToPixel(pos.row, pos.col);
        ctx.fillStyle = "rgba(245, 158, 11, 0.25)";
        ctx.beginPath();
        ctx.arc(x, y, CELL_SIZE / 2 - 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // ─── Pieces ──────────────────────────────────────────
    for (let r = 0; r < BOARD_ROWS; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        const piece = board[r][c];
        if (!piece) continue;
        const { x, y } = gridToPixel(r, c);
        const isSelected = selectedPos && selectedPos.row === r && selectedPos.col === c;

        // Piece circle
        const radius = CELL_SIZE / 2 - 4;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);

        // Fill
        const grad = ctx.createRadialGradient(x - 3, y - 3, 2, x, y, radius);
        grad.addColorStop(0, "#fef3c7");
        grad.addColorStop(1, "#d4a853");
        ctx.fillStyle = grad;
        ctx.fill();

        // Border
        ctx.strokeStyle = piece.color === Color.Red ? "#b91c1c" : "#1e293b";
        ctx.lineWidth = 2;
        if (isSelected) {
          ctx.strokeStyle = "#f59e0b";
          ctx.lineWidth = 3;
          ctx.shadowColor = "rgba(245, 158, 11, 0.6)";
          ctx.shadowBlur = 12;
        }
        ctx.stroke();
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;

        // Inner ring
        ctx.beginPath();
        ctx.arc(x, y, radius - 4, 0, Math.PI * 2);
        ctx.strokeStyle = piece.color === Color.Red ? "#dc2626" : "#334155";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Text
        const unicode = PIECE_UNICODE[piece.color][piece.type];
        ctx.fillStyle = piece.color === Color.Red ? "#b91c1c" : "#1e293b";
        ctx.font = `bold ${Math.floor(CELL_SIZE * 0.45)}px "KaiTi", "SimSun", serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(unicode, x, y + 1);
      }
    }
  }, [board, flipped, selectedPos, legalMoves, gridToPixel, hintArrows, lastMove]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onCellClick || readonly) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    // Map CSS click coordinates to logical board coordinates (0..544, 0..602)
    // canvas.width includes devicePixelRatio scaling, rect.width is CSS pixels
    const logicalWidth = PADDING * 2 + 8 * CELL_SIZE;
    const logicalHeight = PADDING * 2 + 9 * CELL_SIZE;
    const x = ((e.clientX - rect.left) / rect.width) * logicalWidth;
    const y = ((e.clientY - rect.top) / rect.height) * logicalHeight;
    const pos = pixelToGrid(x, y);
    if (pos) onCellClick(pos);
  };

  const width = PADDING * 2 + 8 * CELL_SIZE;
  const height = PADDING * 2 + 9 * CELL_SIZE;

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height, cursor: readonly ? "default" : onCellClick ? "pointer" : "default" }}
      onClick={handleClick}
      className="rounded-lg shadow-lg"
    />
  );
}

/** Helper: draw a rounded rectangle on a canvas 2D context */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
