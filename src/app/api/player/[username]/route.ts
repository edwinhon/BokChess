import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;

    const player = await prisma.player.findUnique({
      where: { username },
    });

    if (!player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: player.id,
      username: player.username,
      displayName: player.displayName,
      gamesPlayed: player.gamesPlayed,
      gamesWon: player.gamesWon,
      gamesLost: player.gamesLost,
      gamesDrawn: player.gamesDrawn,
    });
  } catch (error) {
    console.error("[player/[username]]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
