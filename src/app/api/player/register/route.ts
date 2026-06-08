import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function POST(req: NextRequest) {
  try {
    const { username } = await req.json();

    if (!username || typeof username !== "string") {
      return NextResponse.json({ error: "Username is required" }, { status: 400 });
    }

    const trimmed = username.trim();
    if (trimmed.length < 2 || trimmed.length > 20) {
      return NextResponse.json(
        { error: "Username must be 2-20 characters" },
        { status: 400 }
      );
    }

    // Only allow alphanumeric and underscore
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      return NextResponse.json(
        { error: "Username can only contain letters, numbers, and underscores" },
        { status: 400 }
      );
    }

    // Upsert: create if not exists, otherwise just return existing
    const player = await prisma.player.upsert({
      where: { username: trimmed },
      update: { updatedAt: new Date() },
      create: {
        username: trimmed,
        displayName: trimmed,
      },
    });

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
    console.error("[player/register]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
