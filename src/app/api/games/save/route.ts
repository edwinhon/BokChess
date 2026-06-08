import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

interface SaveGameBody {
  playerRedId: string;
  playerBlackId?: string;
  mode: string; // "human_vs_human" | "human_vs_ai" | "online"
  aiDifficulty?: string; // "easy" | "medium" | "hard"
  result: string; // "red_wins" | "black_wins" | "stalemate"
  initialFen?: string;
  moveHistory: Array<{
    moveNumber: number;
    from: { row: number; col: number };
    to: { row: number; col: number };
    captured: { type: string; color: string } | null;
    notation: string;
  }>;
}

export async function POST(req: NextRequest) {
  try {
    const body: SaveGameBody = await req.json();

    // Validate required fields
    if (!body.playerRedId || !body.mode || !body.result || !body.moveHistory) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate result
    if (!["red_wins", "black_wins", "stalemate"].includes(body.result)) {
      return NextResponse.json(
        { error: "Invalid result value" },
        { status: 400 }
      );
    }

    // Create the game record
    const game = await prisma.gameRecord.create({
      data: {
        playerRedId: body.playerRedId,
        playerBlackId: body.playerBlackId || null,
        mode: body.mode,
        aiDifficulty: body.aiDifficulty || null,
        result: body.result,
        initialFen: body.initialFen || "",
        moveHistory: JSON.stringify(body.moveHistory),
      },
    });

    // Update player stats
    await updatePlayerStats(body.playerRedId, body.result, "red");
    if (body.playerBlackId) {
      await updatePlayerStats(body.playerBlackId, body.result, "black");
    }

    return NextResponse.json({ id: game.id }, { status: 201 });
  } catch (error) {
    console.error("[games/save]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function updatePlayerStats(
  playerId: string,
  result: string,
  side: "red" | "black"
) {
  const isWin =
    (side === "red" && result === "red_wins") ||
    (side === "black" && result === "black_wins");
  const isLoss =
    (side === "red" && result === "black_wins") ||
    (side === "black" && result === "red_wins");
  const isDraw = result === "stalemate";

  await prisma.player.update({
    where: { id: playerId },
    data: {
      gamesPlayed: { increment: 1 },
      gamesWon: isWin ? { increment: 1 } : undefined,
      gamesLost: isLoss ? { increment: 1 } : undefined,
      gamesDrawn: isDraw ? { increment: 1 } : undefined,
    },
  });
}
