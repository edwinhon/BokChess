import { NextRequest, NextResponse } from "next/server";
import { getPikafishEngine } from "@/server/pikafish";
import { Board, Color, Move, Piece, PieceType } from "@/lib/game/types";

interface AIRequest {
  board: Board;
  color: Color;
  moveNumber: number;
  skillLevel: number;
  moveTime: number;
  depth?: number;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AIRequest;

    const { board, color, skillLevel, moveTime, depth } = body;

    if (!board || !color) {
      return NextResponse.json(
        { error: "Missing board or color" },
        { status: 400 }
      );
    }

    // Validate board structure
    if (!Array.isArray(board) || board.length !== 10) {
      return NextResponse.json(
        { error: "Invalid board: expected 10 rows" },
        { status: 400 }
      );
    }

    const engine = getPikafishEngine();

    // Probe engine availability
    const available = await engine.probe();
    if (!available) {
      return NextResponse.json(
        {
          error:
            "Pikafish engine is not available. Make sure pikafish is installed and the PIKAFISH_PATH environment variable is set correctly.",
        },
        { status: 503 }
      );
    }

    const result = await engine.search(board, color, {
      skillLevel,
      moveTime,
      depth,
      hashSize: 64,
      threads: 1,
    });

    const ts = new Date().toISOString();
    console.log(
      "[api/ai] [" + ts + "] move=" +
        (result.move
          ? "(" + result.move.from.row + "," + result.move.from.col + ")->(" +
            result.move.to.row + "," + result.move.to.col + ")"
          : "null") +
        " score=" + result.score +
        " depth=" + result.depth +
        " nodes=" + result.nodes +
        " time=" + result.timeMs + "ms" +
        " pv=[" + (result.pv ?? []).join(",") + "]"
    );

    return NextResponse.json({
      move: result.move,
      score: result.score,
      depth: result.depth,
      nodesSearched: result.nodes,
      timeMs: result.timeMs,
      pv: result.pv,
      fromBook: result.fromBook,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[api/ai] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
