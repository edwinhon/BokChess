import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getPikafishEngine } from "@/server/pikafish";
import { Board, Color, Move, PieceType } from "@/lib/game/types";
import { createInitialBoard, getPieceAt } from "@/lib/game/board";
import { applyMove } from "@/lib/game/moves";
import { encodeMove } from "@/lib/game/notation";

interface MoveNotation {
  moveNumber: number;
  from: { row: number; col: number };
  to: { row: number; col: number };
  captured: { type: string; color: string } | null;
  notation: string;
  evaluation?: {
    score: number;
    bestMove: { row: number; col: number } | null;
    bestMoveNotation: string | null;
    depth: number;
  };
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const game = await prisma.gameRecord.findUnique({
      where: { id },
    });

    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    const moves: MoveNotation[] = JSON.parse(game.moveHistory);
    if (moves.length === 0) {
      return NextResponse.json({ message: "No moves to analyze" });
    }

    const engine = getPikafishEngine();
    const available = await engine.probe();
    if (!available) {
      return NextResponse.json(
        { error: "Pikafish engine not available" },
        { status: 503 }
      );
    }

    // Replay the game, analyzing after each move
    const replayBoard = createInitialBoard();
    const analysisDepth = 12;

    for (let i = 0; i < moves.length; i++) {
      const m = moves[i];

      // Apply the move first
      const move: Move = {
        from: { row: m.from.row, col: m.from.col },
        to: { row: m.to.row, col: m.to.col },
        captured: m.captured
          ? { type: m.captured.type as PieceType, color: m.captured.color as Color }
          : null,
      };
      applyMove(replayBoard, move);

      // Determine whose turn it was (the side that just moved)
      const sideThatMoved: Color = i % 2 === 0 ? Color.Red : Color.Black;

      try {
        const analysis = await engine.analyze(replayBoard, sideThatMoved, analysisDepth);

        // Compute notation for Pikafish's suggested best move
        let bestMoveNotation: string | null = null;
        if (analysis.bestMove) {
          const bestPiece = getPieceAt(replayBoard, analysis.bestMove.from);
          if (bestPiece) {
            bestMoveNotation = encodeMove(analysis.bestMove, bestPiece, replayBoard);
          }
        }

        moves[i].evaluation = {
          score: analysis.score,
          bestMove: analysis.bestMove
            ? { row: analysis.bestMove.to.row, col: analysis.bestMove.to.col }
            : null,
          bestMoveNotation,
          depth: analysis.depth,
        };
      } catch (err) {
        console.error(`[analyze] Failed to analyze move ${i + 1}:`, err);
        moves[i].evaluation = {
          score: 0,
          bestMove: null,
          bestMoveNotation: null,
          depth: 0,
        };
      }
    }

    // Save analysis results back to the game record
    await prisma.gameRecord.update({
      where: { id },
      data: {
        moveHistory: JSON.stringify(moves),
        isAnalyzed: true,
        analyzedAt: new Date(),
      },
    });

    return NextResponse.json({
      message: "Analysis complete",
      movesAnalyzed: moves.length,
      moves,
    });
  } catch (error) {
    console.error("[games/[id]/analyze]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Analysis failed" },
      { status: 500 }
    );
  }
}
