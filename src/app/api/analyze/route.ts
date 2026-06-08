import { NextRequest, NextResponse } from "next/server";
import { getPikafishEngine } from "@/server/pikafish";
import { Board, Color } from "@/lib/game/types";

interface AnalyzeRequest {
  board: Board;
  color: Color;
  depth?: number;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AnalyzeRequest;
    const { board, color, depth = 12 } = body;

    if (!board || !color) {
      return NextResponse.json(
        { error: "Missing board or color" },
        { status: 400 }
      );
    }

    const engine = getPikafishEngine();
    const available = await engine.probe();
    if (!available) {
      return NextResponse.json(
        { error: "Pikafish engine not available" },
        { status: 503 }
      );
    }

    const result = await engine.analyze(board, color, depth);

    return NextResponse.json({
      score: result.score,
      bestMove: result.bestMove,
      depth: result.depth,
      pv: result.pv,
    });
  } catch (err: unknown) {
    console.error("[api/analyze]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Analysis failed" },
      { status: 500 }
    );
  }
}
