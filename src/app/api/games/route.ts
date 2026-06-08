import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

// GET /api/games?username=xxx - list games for a player
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const username = searchParams.get("username");

    if (!username) {
      return NextResponse.json(
        { error: "username query parameter is required" },
        { status: 400 }
      );
    }

    const player = await prisma.player.findUnique({
      where: { username },
    });

    if (!player) {
      return NextResponse.json(
        { error: "Player not found" },
        { status: 404 }
      );
    }

    const games = await prisma.gameRecord.findMany({
      where: {
        OR: [
          { playerRedId: player.id },
          { playerBlackId: player.id },
        ],
      },
      include: {
        playerRed: { select: { username: true, displayName: true } },
        playerBlack: { select: { username: true, displayName: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const result = games.map((g) => ({
      id: g.id,
      createdAt: g.createdAt.toISOString(),
      playerRed: g.playerRed,
      playerBlack: g.playerBlack,
      mode: g.mode,
      aiDifficulty: g.aiDifficulty,
      result: g.result,
      moveCount: JSON.parse(g.moveHistory).length,
      isAnalyzed: g.isAnalyzed,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("[games]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
