import { NextRequest, NextResponse } from "next/server";
import { getPikafishEngine } from "@/server/pikafish";
import { Board, Color, Move } from "@/lib/game/types";

interface HintRequest {
  board: Board;
  color: Color;
  moveNumber: number;
  moveTime?: number;
}

export interface HintResponse {
  hints: Array<{
    move: Move | null;
    score: number;
    depth: number;
    pv: string[];
    rank: number; // 1 = best, 2 = second, 3 = third
  }>;
  nodesSearched: number;
  timeMs: number;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as HintRequest;

    const { board, color, moveTime } = body;

    if (!board || !color) {
      return NextResponse.json(
        { error: "Missing board or color" },
        { status: 400 }
      );
    }

    if (!Array.isArray(board) || board.length !== 10) {
      return NextResponse.json(
        { error: "Invalid board: expected 10 rows" },
        { status: 400 }
      );
    }

    const engine = getPikafishEngine();

    const available = await engine.probe();
    if (!available) {
      return NextResponse.json(
        {
          error:
            "Pikafish engine is not available.",
        },
        { status: 503 }
      );
    }

    const result = await engine.searchMultiPV(board, color, {
      skillLevel: 20,
      moveTime: moveTime ?? 3000,
      hashSize: 64,
      threads: 1,
    });

    const ts = new Date().toISOString();
    console.log(
      "[api/ai/hint] [" + ts + "] entries=" + result.entries.length +
        " nodes=" + result.nodes +
        " time=" + result.timeMs + "ms"
    );
    for (const e of result.entries) {
      console.log(
        "[api/ai/hint] [" + ts + "]   PV#" + e.multipv +
        " move=" + (e.move
          ? "(" + e.move.from.row + "," + e.move.from.col + ")->(" + e.move.to.row + "," + e.move.to.col + ")"
          : "null") +
        " score=" + e.score
      );
    }

    return NextResponse.json({
      hints: result.entries.map((e) => ({
        move: e.move,
        score: e.score,
        depth: e.depth,
        pv: e.pv,
        rank: e.multipv,
      })),
      nodesSearched: result.nodes,
      timeMs: result.timeMs,
    } satisfies HintResponse);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[api/ai/hint] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
