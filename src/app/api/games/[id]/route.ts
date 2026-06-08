import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const game = await prisma.gameRecord.findUnique({
      where: { id },
      include: {
        playerRed: { select: { id: true, username: true, displayName: true } },
        playerBlack: { select: { id: true, username: true, displayName: true } },
      },
    });

    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: game.id,
      createdAt: game.createdAt.toISOString(),
      playerRed: game.playerRed,
      playerBlack: game.playerBlack,
      mode: game.mode,
      aiDifficulty: game.aiDifficulty,
      result: game.result,
      initialFen: game.initialFen,
      moveHistory: JSON.parse(game.moveHistory),
      isAnalyzed: game.isAnalyzed,
      analyzedAt: game.analyzedAt?.toISOString() || null,
    });
  } catch (error) {
    console.error("[games/[id]]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
